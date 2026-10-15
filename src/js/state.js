/* ==========================================================================
   STATE MANAGEMENT & LOCAL STORAGE PERSISTENCE
   ========================================================================== */

const STORAGE_KEYS = {
  SETTINGS: "vigildrive_settings_v1",
  SESSIONS: "vigildrive_sessions_v1",
  THEME: "vigildrive_theme_v1"
};

const DEFAULT_SETTINGS = {
  alarmSound: "buzzer", // buzzer, chime, siren
  speechAlert: true,
  volume: 85,
  alarmEnabled: true,
  earThreshold: 0.22,
  drowsinessDurationSec: 2.0,
  preferredCameraId: "",
  highContrast: false,

  // Yawning detection settings
  yawnDetectionEnabled: true,
  marThreshold: 0.60,
  yawnDurationSec: 1.8,

  // Head pose / position monitoring settings
  headPoseEnabled: true,
  headDropThreshold: 0.65,
  headDropDurationSec: 1.2,

  // Sensitivity Presets & Privacy Preferences
  sensitivityPreset: "balanced", // high, balanced, low, custom
  retentionPolicy: "persistent", // persistent, session_only
  anonymousReports: true
};

class StateManager {
  constructor() {
    this.currentPage = "home";
    this.theme = localStorage.getItem(STORAGE_KEYS.THEME) || "dark";
    this.settings = this.loadSettings();
    this.sessions = this.loadSessions();

    // Live Monitoring Telemetry State
    this.isMonitoring = false;
    this.isPaused = false;
    this.sessionSaved = false;
    this.monitoringMode = "real"; // "real" (webcam) or "sample" (benchmark simulation)
    this.cameraConnected = false;
    this.driverStatus = "IDLE"; // IDLE, ATTENTIVE, POSSIBLE DROWSINESS, ALERT, FACE NOT DETECTED, CAMERA ERROR, PAUSED
    this.activeWarningType = ""; // "PROLONGED EYE CLOSURE", "FREQUENT YAWNING", "HEAD DROP / NOD OFF", etc.
    this.cameraError = null; // null or error message string
    this.audioBlocked = false; // true if browser blocked audioContext autoplay

    this.faceDetected = false;
    this.eyeState = "UNDETECTED"; // OPEN, CLOSED, BLINKING, UNDETECTED
    this.currentEar = 0.28;
    this.leftEar = 0.28;
    this.rightEar = 0.28;
    this.blinkScore = 0;
    this.blinkCount = 0;
    this.closureSeconds = 0.0;

    // Yawning Telemetry
    this.currentMar = 0.18; // Mouth Aspect Ratio
    this.yawnCount = 0;
    this.isYawning = false;
    this.yawnDurationSec = 0.0;

    // Head Pose Telemetry
    this.headPitch = 1.05; // Upright ~ 1.0 - 1.25, Downward < 0.65
    this.isHeadDrop = false;
    this.headDropDurationSec = 0.0;

    // Session Statistics
    this.sessionStartTime = null;
    this.sessionEndTime = null;
    this.sessionDurationSec = 0;
    this.sessionWarningsCount = 0;
    this.currentSessionEvents = [];
    this.sessionEarHistory = [];
    this.currentSessionId = null;
    this.recentEvents = [];

    this.subscribers = new Set();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.warn("Corrupted settings found, loading defaults:", e);
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
    this.notify("settings");
  }

  /**
   * Validates and sanitizes a single stored session record
   */
  sanitizeSessionRecord(raw) {
    if (!raw || typeof raw !== "object") return null;

    // Ensure session ID is valid string
    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `sess_${Date.now()}`;
    const isSample = Boolean(raw.isSample);

    // Validate timestamps
    let startTime = raw.startTime;
    if (!startTime || typeof startTime !== "string" || isNaN(Date.parse(startTime))) {
      startTime = new Date().toISOString();
    }

    const durationSeconds = typeof raw.durationSeconds === "number" && !isNaN(raw.durationSeconds) && raw.durationSeconds >= 0
      ? Math.round(raw.durationSeconds)
      : 0;

    let endTime = raw.endTime;
    if (!endTime || typeof endTime !== "string" || isNaN(Date.parse(endTime))) {
      endTime = new Date(new Date(startTime).getTime() + durationSeconds * 1000).toISOString();
    }

    // Validate warning counts and events
    const rawEvents = Array.isArray(raw.events) ? raw.events : [];
    const events = rawEvents
      .filter((ev) => ev && typeof ev === "object")
      .map((ev, idx) => ({
        id: typeof ev.id === "string" ? ev.id : `ev_${idx}`,
        timestamp: typeof ev.timestamp === "string" ? ev.timestamp : "00:00:00",
        isoTimestamp: typeof ev.isoTimestamp === "string" ? ev.isoTimestamp : startTime,
        type: typeof ev.type === "string" ? ev.type : "ALERT",
        typeLabel: typeof ev.typeLabel === "string" ? ev.typeLabel : "Drowsiness Warning",
        duration: typeof ev.duration === "string" ? ev.duration : typeof ev.duration === "number" ? `${ev.duration.toFixed(1)}s` : "0.0s",
        detectionDurationSec: typeof ev.detectionDurationSec === "number" ? ev.detectionDurationSec : parseFloat(ev.duration) || 0,
        ear: typeof ev.ear === "number" && !isNaN(ev.ear) ? Number(ev.ear.toFixed(2)) : 0.2,
        mar: typeof ev.mar === "number" && !isNaN(ev.mar) ? Number(ev.mar.toFixed(2)) : 0.2,
        severity: typeof ev.severity === "string" ? ev.severity : "Warning",
        isSample: Boolean(ev.isSample)
      }));

    const warningEventsCount = typeof raw.warningEventsCount === "number" && !isNaN(raw.warningEventsCount)
      ? Math.max(0, raw.warningEventsCount)
      : events.length;

    const avgEar = typeof raw.avgEar === "number" && !isNaN(raw.avgEar)
      ? Number(raw.avgEar.toFixed(2))
      : 0.28;

    const blinkCount = typeof raw.blinkCount === "number" && !isNaN(raw.blinkCount) ? raw.blinkCount : 0;
    const yawnCount = typeof raw.yawnCount === "number" && !isNaN(raw.yawnCount) ? raw.yawnCount : 0;
    const status = typeof raw.status === "string" ? raw.status : "Completed";
    const notes = typeof raw.notes === "string" ? raw.notes : isSample ? "Benchmark Simulation Test" : "Live Camera Driver Session";

    return {
      id,
      isSample,
      startTime,
      endTime,
      durationSeconds,
      warningEventsCount,
      avgEar,
      blinkCount,
      yawnCount,
      status,
      notes,
      events
    };
  }

  loadSessions() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];

      // Filter out any legacy dummy sample placeholders from earlier builds (e.g. sess_sample_101)
      const valid = parsed
        .map((item) => this.sanitizeSessionRecord(item))
        .filter((sess) => sess !== null && !sess.id.startsWith("sess_sample_"));

      return valid;
    } catch (e) {
      console.warn("Corrupted session records in storage, resetting cleanly:", e);
      return [];
    }
  }

  saveSessions() {
    try {
      if (this.settings.retentionPolicy === "session_only") {
        localStorage.removeItem(STORAGE_KEYS.SESSIONS);
      } else {
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(this.sessions));
      }
    } catch (e) {
      console.error("Failed to persist sessions to localStorage:", e);
    }
    this.notify("sessions");
  }

  setTheme(theme) {
    this.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (e) {
      // ignore
    }
    document.documentElement.setAttribute("data-theme", theme);
    this.notify("theme");
  }

  setPage(page) {
    this.currentPage = page;
    window.location.hash = page;
    this.notify("page");
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(changeType) {
    for (const callback of this.subscribers) {
      try {
        callback(changeType, this);
      } catch (err) {
        console.error("State subscriber error:", err);
      }
    }
  }

  startSession(mode = "real") {
    this.isMonitoring = true;
    this.isPaused = false;
    this.sessionSaved = false;
    this.monitoringMode = mode;
    this.driverStatus = "ATTENTIVE";
    this.activeWarningType = "";
    this.sessionStartTime = new Date().toISOString();
    this.sessionEndTime = null;
    this.sessionDurationSec = 0;
    this.sessionWarningsCount = 0;
    this.currentSessionEvents = [];
    this.sessionEarHistory = [];
    this.closureSeconds = 0.0;
    this.blinkCount = 0;
    this.yawnCount = 0;
    this.isYawning = false;
    this.isHeadDrop = false;
    this.currentSessionId = `sess_${Date.now()}`;
    this.notify("session_started");
  }

  recordEarReading(earVal) {
    if (!this.isMonitoring || this.isPaused || typeof earVal !== "number" || isNaN(earVal)) return;
    this.sessionEarHistory.push(earVal);
    if (this.sessionEarHistory.length > 3600) {
      // Keep memory bounded for long sessions
      this.sessionEarHistory.shift();
    }
  }

  pauseSession() {
    if (!this.isMonitoring || this.isPaused) return;
    this.isPaused = true;
    this.driverStatus = "PAUSED";
    this.notify("session_paused");
  }

  resumeSession() {
    if (!this.isMonitoring || !this.isPaused) return;
    this.isPaused = false;
    this.driverStatus = "ATTENTIVE";
    this.notify("session_resumed");
  }

  resetSession() {
    this.sessionDurationSec = 0;
    this.sessionWarningsCount = 0;
    this.closureSeconds = 0.0;
    this.blinkCount = 0;
    this.yawnCount = 0;
    this.isYawning = false;
    this.isHeadDrop = false;
    this.currentSessionEvents = [];
    this.sessionEarHistory = [];
    this.activeWarningType = "";
    this.notify("session_reset");
  }

  recordWarningEvent({ type = "ALERT", typeLabel = "Prolonged Eye Closure", duration = 0, earValue, marValue, severity = "Warning" }) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour12: false });
    const durSec = typeof duration === "number" ? duration : parseFloat(duration) || 0;

    const event = {
      id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: timeStr,
      isoTimestamp: now.toISOString(),
      type: type,
      typeLabel: typeLabel,
      duration: `${durSec.toFixed(1)}s`,
      detectionDurationSec: Number(durSec.toFixed(2)),
      ear: earValue !== undefined ? Number(earValue.toFixed(2)) : Number(this.currentEar.toFixed(2)),
      mar: marValue !== undefined ? Number(marValue.toFixed(2)) : Number(this.currentMar.toFixed(2)),
      severity: severity, // "Caution" (Yellow), "Warning" (Orange), "Critical" (Red)
      isSample: this.monitoringMode === "sample"
    };

    this.sessionWarningsCount++;
    this.currentSessionEvents.push(event);
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > 30) this.recentEvents.pop();

    this.notify("warning_recorded");
    return event;
  }

  stopSession() {
    // Prevent duplicate saves if already stopped or saved
    if (!this.isMonitoring || this.sessionSaved) return;

    this.sessionSaved = true;
    this.sessionEndTime = new Date().toISOString();

    // Only save session if it has genuine monitoring duration (>= 1 sec) or recorded events
    if (this.sessionDurationSec >= 1 || this.currentSessionEvents.length > 0) {
      let avgEar = 0.28;
      if (this.sessionEarHistory.length > 0) {
        const sum = this.sessionEarHistory.reduce((a, b) => a + b, 0);
        avgEar = Number((sum / this.sessionEarHistory.length).toFixed(2));
      } else if (this.currentEar) {
        avgEar = Number(this.currentEar.toFixed(2));
      }

      const newSession = {
        id: this.currentSessionId || `sess_${Date.now()}`,
        isSample: this.monitoringMode === "sample",
        startTime: this.sessionStartTime || new Date(Date.now() - this.sessionDurationSec * 1000).toISOString(),
        endTime: this.sessionEndTime,
        durationSeconds: this.sessionDurationSec,
        warningEventsCount: this.sessionWarningsCount,
        avgEar: avgEar,
        blinkCount: this.blinkCount,
        yawnCount: this.yawnCount,
        status: "Completed",
        notes: this.monitoringMode === "sample" ? "Benchmark Simulation Test" : "Live Camera Driver Session",
        events: [...this.currentSessionEvents]
      };

      this.sessions.unshift(newSession);
      this.saveSessions();
    }

    this.isMonitoring = false;
    this.isPaused = false;
    this.driverStatus = "IDLE";
    this.activeWarningType = "";
    this.closureSeconds = 0.0;
    this.eyeState = "UNDETECTED";
    this.isYawning = false;
    this.isHeadDrop = false;
    this.notify("session_stopped");
  }

  clearSessions() {
    this.sessions = [];
    this.recentEvents = [];
    this.saveSessions();
    this.notify("sessions_cleared");
  }

  resetAll() {
    this.settings = { ...DEFAULT_SETTINGS };
    try {
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    } catch (e) {
      // ignore
    }
    this.sessions = [];
    this.recentEvents = [];
    this.saveSessions();
    this.notify("reset_all");
  }
}

export const appState = new StateManager();
