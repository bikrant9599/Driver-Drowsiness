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
  highContrast: false
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
      { timestamp: "14:22:10", type: "DROWSY_ALERT", duration: "2.3s", ear: 0.17, severity: "High" },
      { timestamp: "14:38:45", type: "DROWSY_ALERT", duration: "2.4s", ear: 0.18, severity: "High" }
    ]
  },
  {
    id: "sess_sample_102",
    isSample: true,
    startTime: new Date(Date.now() - 3600000 * 18).toISOString(),
    durationSeconds: 1540, // 25 mins
    warningEventsCount: 0,
    avgEar: 0.31,
    maxClosureSec: 0.6,
    status: "Completed",
    notes: "Daytime Urban Test",
    events: []
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
      { timestamp: "19:10:02", type: "DROWSY_ALERT", duration: "2.2s", ear: 0.19, severity: "Medium" },
      { timestamp: "19:28:14", type: "DROWSY_ALERT", duration: "2.7s", ear: 0.16, severity: "Critical" },
      { timestamp: "19:45:50", type: "DROWSY_ALERT", duration: "2.8s", ear: 0.15, severity: "Critical" }
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
    this.monitoringMode = "real"; // "real" (webcam) or "sample" (benchmark simulation)
    this.cameraConnected = false;
    this.driverStatus = "IDLE"; // IDLE, ATTENTIVE, POSSIBLE DROWSINESS, ALERT, FACE NOT DETECTED, CAMERA ERROR
    this.cameraError = null; // null or error message string
    this.faceDetected = false;
    this.eyeState = "UNDETECTED"; // OPEN, CLOSED, BLINKING, UNDETECTED
    this.currentEar = 0.28;
    this.leftEar = 0.28;
    this.rightEar = 0.28;
    this.blinkScore = 0;
    this.blinkCount = 0;
    this.closureSeconds = 0.0;
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
    this.monitoringMode = mode;
    this.driverStatus = "ATTENTIVE";
    this.sessionDurationSec = 0;
    this.sessionWarningsCount = 0;
    this.currentSessionEvents = [];
    this.closureSeconds = 0.0;
    this.currentSessionId = `sess_${Date.now()}`;
    this.notify("session_started");
  }

  recordWarningEvent(duration, earValue) {
    const timeStr = new Date().toLocaleTimeString("en-US", { hour12: false });
    const event = {
      timestamp: timeStr,
      type: "ALERT",
      duration: `${duration.toFixed(1)}s`,
      ear: Number(earValue.toFixed(2)),
      severity: duration > 3.0 ? "Critical" : "High",
      isSample: this.monitoringMode === "sample"
    };

    this.sessionWarningsCount++;
    this.currentSessionEvents.push(event);
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > 15) this.recentEvents.pop();

    this.notify("warning_recorded");
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
        status: "Completed",
        notes: this.monitoringMode === "sample" ? "Benchmark Simulation Test" : "Live Camera Driver Session",
        events: [...this.currentSessionEvents]
      };
      this.sessions.unshift(newSession);
      this.saveSessions();
    }

    this.isMonitoring = false;
    this.driverStatus = "IDLE";
    this.closureSeconds = 0.0;
    this.eyeState = "UNDETECTED";
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
