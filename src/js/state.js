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
  headDropDurationSec: 1.2
};

// Initial realistic sample sessions clearly labeled as sample previews
const INITIAL_SAMPLE_SESSIONS = [
  {
    id: "sess_sample_101",
    isSample: true,
    startTime: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    durationSeconds: 2480, // 41 mins
    warningEventsCount: 2,
    avgEar: 0.28,
    maxClosureSec: 2.4,
    status: "Completed",
    notes: "Highway Night Benchmark",
    events: [
      { timestamp: "14:22:10", type: "ALERT", typeLabel: "Prolonged Eye Closure", duration: "2.3s", ear: 0.17, mar: 0.18, severity: "Critical" },
      { timestamp: "14:38:45", type: "ALERT", typeLabel: "Prolonged Eye Closure", duration: "2.4s", ear: 0.18, mar: 0.19, severity: "Critical" }
    ]
  },
  {
    id: "sess_sample_102",
    isSample: true,
    startTime: new Date(Date.now() - 3600000 * 18).toISOString(),
    durationSeconds: 1540, // 25 mins
    warningEventsCount: 1,
    avgEar: 0.31,
    maxClosureSec: 0.6,
    status: "Completed",
    notes: "Daytime Urban Test",
    events: [
      { timestamp: "10:14:05", type: "YAWN_DETECTED", typeLabel: "Frequent Yawning", duration: "2.1s", ear: 0.29, mar: 0.68, severity: "Caution" }
    ]
  },
  {
    id: "sess_sample_103",
    isSample: true,
    startTime: new Date(Date.now() - 3600000 * 5).toISOString(),
    durationSeconds: 3720, // 62 mins
    warningEventsCount: 3,
    avgEar: 0.26,
    maxClosureSec: 2.8,
    status: "Completed",
    notes: "Long Haul Fatigue Benchmark",
    events: [
      { timestamp: "19:10:02", type: "HEAD_DROP", typeLabel: "Downward Head Nod", duration: "1.4s", ear: 0.23, mar: 0.21, severity: "Caution" },
      { timestamp: "19:28:14", type: "ALERT", typeLabel: "Prolonged Eye Closure", duration: "2.7s", ear: 0.16, mar: 0.22, severity: "Critical" },
      { timestamp: "19:45:50", type: "DROWSY_NOD_OFF", typeLabel: "Head Drop + Eye Closure", duration: "2.8s", ear: 0.15, mar: 0.25, severity: "Critical" }
    ]
  }
];

class StateManager {
  constructor() {
    this.currentPage = "home";
    this.theme = localStorage.getItem(STORAGE_KEYS.THEME) || "dark";
    this.settings = this.loadSettings();
    this.sessions = this.loadSessions();

    // Live Monitoring Telemetry State
    this.isMonitoring = false;
    this.isPaused = false;
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
    this.sessionDurationSec = 0;
    this.sessionWarningsCount = 0;
    this.currentSessionEvents = [];
    this.currentSessionId = null;
    this.recentEvents = [];

    this.subscribers = new Set();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    this.notify("settings");
  }

  loadSessions() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      return saved ? JSON.parse(saved) : [...INITIAL_SAMPLE_SESSIONS];
    } catch (e) {
      return [...INITIAL_SAMPLE_SESSIONS];
    }
  }

  saveSessions() {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(this.sessions));
    this.notify("sessions");
  }

  setTheme(theme) {
    this.theme = theme;
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
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
    this.monitoringMode = mode;
    this.driverStatus = "ATTENTIVE";
    this.activeWarningType = "";
    this.sessionDurationSec = 0;
    this.sessionWarningsCount = 0;
    this.currentSessionEvents = [];
    this.closureSeconds = 0.0;
    this.blinkCount = 0;
    this.yawnCount = 0;
    this.isYawning = false;
    this.isHeadDrop = false;
    this.currentSessionId = `sess_${Date.now()}`;
    this.notify("session_started");
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
    this.activeWarningType = "";
    this.notify("session_reset");
  }

  recordWarningEvent({ type = "ALERT", typeLabel = "Prolonged Eye Closure", duration = 0, earValue, marValue, severity = "Warning" }) {
    const timeStr = new Date().toLocaleTimeString("en-US", { hour12: false });
    const event = {
      id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: timeStr,
      type: type,
      typeLabel: typeLabel,
      duration: typeof duration === "number" ? `${duration.toFixed(1)}s` : duration,
      ear: earValue !== undefined ? Number(earValue.toFixed(2)) : Number(this.currentEar.toFixed(2)),
      mar: marValue !== undefined ? Number(marValue.toFixed(2)) : Number(this.currentMar.toFixed(2)),
      severity: severity, // "Caution" (Yellow), "Warning" (Orange), "Critical" (Red)
      isSample: this.monitoringMode === "sample"
    };

    this.sessionWarningsCount++;
    this.currentSessionEvents.push(event);
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > 25) this.recentEvents.pop();

    this.notify("warning_recorded");
    return event;
  }

  stopSession() {
    if (!this.isMonitoring) return;

    if (this.sessionDurationSec > 5) {
      const newSession = {
        id: this.currentSessionId || `sess_${Date.now()}`,
        isSample: this.monitoringMode === "sample",
        startTime: new Date().toISOString(),
        durationSeconds: this.sessionDurationSec,
        warningEventsCount: this.sessionWarningsCount,
        avgEar: Number(this.currentEar.toFixed(2)),
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
    this.saveSessions();
    this.notify("sessions_cleared");
  }

  resetAll() {
    this.settings = { ...DEFAULT_SETTINGS };
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    this.sessions = [...INITIAL_SAMPLE_SESSIONS];
    this.saveSessions();
    this.notify("reset_all");
  }
}

export const appState = new StateManager();
