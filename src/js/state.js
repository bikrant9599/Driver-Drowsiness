/* ==========================================================================
   STATE MANAGEMENT & PERSISTENT SAFETY AUDIT HISTORY
   Driver Drowsiness, Seat Belt, Phone & Attention Detection state engine
   ========================================================================== */

const STORAGE_KEY_HISTORY = "drowsiness_session_history";
const STORAGE_KEY_SETTINGS = "drowsiness_detection_settings";
const STORAGE_KEY_VIOLATION_HISTORY = "driver_safety_violations_history";

export const DEFAULT_SETTINGS = {
  // Drowsiness & EAR
  earThreshold: 0.21,
  drowsinessThresholdSec: 2.0,
  eyeClosureWarningSec: 0.5,
  calibratedBaselineEAR: null,
  useBlendshapes: true,

  // Seat Belt Detection
  seatBeltWarningSec: 5.0, // seconds unbuckled before triggering Stage 1

  // Mobile Phone Detection
  phoneWarningSec: 3.0, // seconds phone detected before triggering Stage 1

  // Driver Attention Detection
  distractionWarningSec: 10.0, // seconds looking away before triggering Stage 1 (user spec)

  // Three-Stage Warning Timing
  stage1DurationSec: 2.5, // Stage 1 initial warning duration before escalating
  stage2DurationSec: 3.5, // Stage 2 critical warning duration before escalating
  alarmCooldownSec: 3.0   // Cooldown after violation clears
};

class StateManager {
  constructor() {
    this.currentView = "main"; // "main" | "monitoring" | "summary" | "history"
    this.previousView = "main";

    this.isMonitoring = false;
    this.status = "IDLE"; // "ALERT", "DROWSY", "NO_FACE", "CAMERA_UNAVAILABLE", "IDLE"
    this.statusText = "";
    this.cameraError = null;
    this.activeWarning = false;

    // Load persisted settings
    this.settings = this.loadSettings();

    // Active session timing and event tracking
    this.sessionStartTime = null;
    this.sessionDurationSec = 0;
    this.drowsinessEventsCount = 0;
    this.lastSession = null;

    // Warning Violation History for current session & persistence
    this.sessionViolations = [];

    // Real-Time Computer-Vision Telemetry
    this.telemetry = {
      // General Vision
      faceDetected: false,
      eyeTrackingStatus: "STANDBY", // "ACTIVE" | "LOST" | "STANDBY" | "CALIBRATING"
      confidence: 0,
      fps: 0,

      // 1. Drowsiness & Eyes
      leftEyeState: "OPEN",         // "OPEN" | "CLOSING" | "CLOSED" | "BLINKING"
      rightEyeState: "OPEN",        // "OPEN" | "CLOSING" | "CLOSED" | "BLINKING"
      leftEAR: 0.28,
      rightEAR: 0.28,
      avgEAR: 0.28,
      closureDurationSec: 0.0,
      blinkCount: 0,
      blinkRate: 0,                 // BPM
      drowsinessRisk: "NORMAL",     // "NORMAL" | "WARNING" | "HIGH_RISK"
      isBlinkingLive: false,

      // 2. Seat Belt Detection
      seatBeltStatus: "DETECTED",   // "DETECTED" | "NOT DETECTED" | "DETECTION UNCERTAIN"
      seatBeltConfidence: 85,
      seatBeltUnwornSec: 0.0,
      seatBeltReason: "Monitoring active",
      seatBeltCoordinates: null,   // { x1, y1, x2, y2 } for canvas overlay

      // 3. Mobile Phone Detection
      phoneStatus: "NO PHONE",       // "NO PHONE" | "POSSIBLE PHONE USE" | "PHONE DETECTED"
      phoneConfidence: 0,
      phoneUsageSec: 0.0,
      phoneBox: null,               // { x, y, width, height, score }

      // 4. Driver Attention Detection
      attentionStatus: "FOCUSED",   // "FOCUSED" | "DISTRACTED" | "FACE NOT DETECTED" | "DETECTION UNCERTAIN"
      headYaw: 0,                   // degrees (- is left, + is right)
      headPitch: 0,                 // degrees (- is down, + is up)
      headRoll: 0,
      distractedSec: 0.0,
      attentionReason: "Forward road focus",

      // Unified Three-Stage Warning System
      activeViolation: null,        // null | "DROWSINESS" | "DISTRACTION" | "PHONE_USE" | "SEAT_BELT"
      warningStage: 0,              // 0: None, 1: Initial, 2: Critical, 3: Emergency
      warningMessage: "",
      stage1FlashCount: 0,
      cooldownActive: false
    };

    // Subscribed listeners
    this.subscribers = new Set();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn("Error loading detection settings:", e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
    } catch (e) {
      console.warn("Error persisting settings:", e);
    }
    this.notify();
  }

  resetSettings() {
    this.settings = { ...DEFAULT_SETTINGS };
    try {
      localStorage.removeItem(STORAGE_KEY_SETTINGS);
    } catch (e) {
      console.warn("Error resetting settings:", e);
    }
    this.notify();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    for (const callback of this.subscribers) {
      try {
        callback(this);
      } catch (e) {
        console.error("State subscriber error:", e);
      }
    }
  }

  setView(newView) {
    if (this.currentView !== newView) {
      this.previousView = this.currentView;
      this.currentView = newView;
      this.notify();
    }
  }

  setStatus(status, errorMsg = null) {
    this.status = status;
    this.cameraError = errorMsg;

    if (status === "ALERT") {
      this.statusText = "All safety checks normal. You appear alert.";
      this.activeWarning = false;
    } else if (status === "DROWSY") {
      this.statusText = this.telemetry.warningMessage || "Possible drowsiness detected!";
      this.activeWarning = true;
    } else if (status === "NO_FACE") {
      this.statusText = "Face or eyes not detected.";
      this.activeWarning = false;
    } else if (status === "CAMERA_UNAVAILABLE") {
      this.statusText = "Camera unavailable.";
      this.activeWarning = false;
    } else {
      this.statusText = "";
      this.activeWarning = false;
    }

    this.notify();
  }

  startSession() {
    this.isMonitoring = true;
    this.currentView = "monitoring";
    this.sessionStartTime = Date.now();
    this.sessionDurationSec = 0;
    this.drowsinessEventsCount = 0;
    this.sessionViolations = [];

    // Reset telemetry
    this.telemetry.faceDetected = false;
    this.telemetry.eyeTrackingStatus = "LOST";
    this.telemetry.leftEyeState = "OPEN";
    this.telemetry.rightEyeState = "OPEN";
    this.telemetry.leftEAR = 0.28;
    this.telemetry.rightEAR = 0.28;
    this.telemetry.avgEAR = 0.28;
    this.telemetry.closureDurationSec = 0.0;
    this.telemetry.blinkCount = 0;
    this.telemetry.blinkRate = 0;
    this.telemetry.drowsinessRisk = "NORMAL";
    this.telemetry.isBlinkingLive = false;

    this.telemetry.seatBeltStatus = "DETECTED";
    this.telemetry.seatBeltConfidence = 85;
    this.telemetry.seatBeltUnwornSec = 0.0;
    this.telemetry.seatBeltReason = "Initializing...";
    this.telemetry.seatBeltCoordinates = null;

    this.telemetry.phoneStatus = "NO PHONE";
    this.telemetry.phoneConfidence = 0;
    this.telemetry.phoneUsageSec = 0.0;
    this.telemetry.phoneBox = null;

    this.telemetry.attentionStatus = "FOCUSED";
    this.telemetry.headYaw = 0;
    this.telemetry.headPitch = 0;
    this.telemetry.distractedSec = 0.0;
    this.telemetry.attentionReason = "Initializing...";

    this.telemetry.activeViolation = null;
    this.telemetry.warningStage = 0;
    this.telemetry.warningMessage = "";
    this.telemetry.cooldownActive = false;

    this.setStatus("NO_FACE");
  }

  recordDrowsinessEvent() {
    this.drowsinessEventsCount++;
    this.recordViolation("DROWSINESS", "Prolonged Eye Closure / Drowsiness", 3);
    this.notify();
  }

  recordViolation(type, title, stageReached) {
    const existing = this.sessionViolations.find(
      (v) => v.type === type && (Date.now() - v.timestamp) < 4000
    );

    if (existing) {
      if (stageReached > existing.maxStage) {
        existing.maxStage = stageReached;
      }
      return;
    }

    const violation = {
      id: "viol_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      type, // "DROWSINESS" | "SEAT_BELT" | "PHONE_USE" | "DISTRACTION"
      title,
      timestamp: Date.now(),
      maxStage: stageReached, // 1: Initial, 2: Critical, 3: Emergency
      timeStr: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    };

    this.sessionViolations.unshift(violation);
    this.saveViolationToGlobal(violation);
  }

  stopSession() {
    if (!this.isMonitoring) return null;

    const totalViolations = this.sessionViolations.length;
    const resultLabel =
      this.drowsinessEventsCount > 0 || totalViolations > 0
        ? `${totalViolations} safety violation(s) detected`
        : "No safety violations detected · Full compliance";

    const sessionRecord = {
      id: "sess_" + Date.now(),
      timestamp: this.sessionStartTime || Date.now(),
      durationSeconds: this.sessionDurationSec,
      drowsinessEventsCount: this.drowsinessEventsCount,
      totalViolationsCount: totalViolations,
      violations: [...this.sessionViolations],
      blinkCount: this.telemetry.blinkCount,
      resultLabel
    };

    if (this.sessionDurationSec >= 2) {
      this.saveSessionToHistory(sessionRecord);
    }

    this.lastSession = sessionRecord;
    this.isMonitoring = false;
    this.status = "IDLE";
    this.statusText = "";
    this.activeWarning = false;
    this.telemetry.eyeTrackingStatus = "STANDBY";
    this.telemetry.warningStage = 0;
    this.telemetry.activeViolation = null;
    this.currentView = "summary";
    this.notify();

    return sessionRecord;
  }

  /* -------------------------------------------------------------------------
     Persistent Session History (localStorage)
     ------------------------------------------------------------------------- */
  getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn("Error reading session history:", e);
      return [];
    }
  }

  saveSessionToHistory(sessionRecord) {
    try {
      const history = this.getHistory();
      const exists = history.some((item) => item.id === sessionRecord.id);
      if (!exists) {
        history.unshift(sessionRecord);
        const trimmed = history.slice(0, 50);
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(trimmed));
      }
    } catch (e) {
      console.warn("Error saving session to history:", e);
    }
  }

  saveViolationToGlobal(violation) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_VIOLATION_HISTORY);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(violation);
      localStorage.setItem(STORAGE_KEY_VIOLATION_HISTORY, JSON.stringify(list.slice(0, 100)));
    } catch (e) {}
  }

  getRecentViolations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_VIOLATION_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  clearHistory() {
    try {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
      localStorage.removeItem(STORAGE_KEY_VIOLATION_HISTORY);
      this.sessionViolations = [];
      this.notify();
      return true;
    } catch (e) {
      console.warn("Error clearing history:", e);
      return false;
    }
  }
}

export const appState = new StateManager();
