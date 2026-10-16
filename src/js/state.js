/* ==========================================================================
   STATE MANAGEMENT & LOCAL STORAGE PERSISTENCE
   Simplified, reliable driver attentiveness telematics state
   ========================================================================== */

const STORAGE_KEYS = {
  SETTINGS: "vigildrive_settings_v2",
  SESSIONS: "vigildrive_sessions_v2",
  THEME: "vigildrive_theme_v2"
};

const DEFAULT_SETTINGS = {
  alarmSound: "buzzer", // buzzer, chime, siren
  volume: 85,
  alarmEnabled: true,
  earThreshold: 0.22,
  drowsinessDurationSec: 2.0,
  preferredCameraId: ""
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
    this.cameraConnected = false;

    // Core Statuses: "Alert", "Possible Drowsiness", "Unable to Assess"
    this.driverStatus = "Unable to Assess";
    this.eyeState = "Unable to Assess"; // "Eyes Detected", "Eyes Closed", "Unable to Assess"
    this.activeWarningType = "";
    this.cameraError = null;
    this.audioBlocked = false;

    this.faceDetected = false;
    this.currentEar = 0.28;
    this.closureSeconds = 0.0;

    // Session Statistics
    this.sessionStartTime = null;
    this.sessionEndTime = null;
    this.sessionDurationSec = 0;
    this.sessionWarningsCount = 0;
    this.currentSessionEvents = [];
    this.lastCompletedSession = null;
    this.currentSessionId = null;

    this.subscribers = new Set();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.warn("Could not load settings, using defaults:", e);
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

  loadSessions() {
    try {
      // First try v2 storage, then migrate clean real sessions from v1 if present
      let saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (!saved) {
        saved = localStorage.getItem("vigildrive_sessions_v1");
      }
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];

      // Filter out any legacy sample/benchmark fake records
      return parsed
        .filter((item) => item && typeof item === "object" && !item.isSample && !String(item.id).startsWith("sess_sample_"))
        .map((s) => ({
          id: s.id || `sess_${Date.now()}`,
          startTime: s.startTime || new Date().toISOString(),
          endTime: s.endTime || new Date().toISOString(),
          durationSeconds: typeof s.durationSeconds === "number" ? Math.max(0, Math.round(s.durationSeconds)) : 0,
          warningEventsCount: typeof s.warningEventsCount === "number" ? Math.max(0, s.warningEventsCount) : (s.events || []).length,
          events: Array.isArray(s.events)
            ? s.events.map((ev, idx) => ({
                id: ev.id || `ev_${idx}`,
                timestamp: ev.timestamp || "00:00:00",
                type: ev.type || "Possible Drowsiness",
                typeLabel: ev.typeLabel || "Prolonged Eye Closure",
                duration: typeof ev.duration === "number" ? `${ev.duration.toFixed(1)}s` : String(ev.duration || "0.0s")
              }))
            : []
        }));
    } catch (e) {
      console.warn("Could not load sessions, starting empty:", e);
      return [];
    }
  }

  saveSessions() {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(this.sessions));
    } catch (e) {
      console.error("Failed to save sessions:", e);
    }
    this.notify("sessions");
  }

  setTheme(theme) {
    this.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (e) {}
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

  startSession() {
    this.isMonitoring = true;
    this.isPaused = false;
    this.sessionSaved = false;
    this.driverStatus = "Unable to Assess";
    this.eyeState = "Unable to Assess";
    this.activeWarningType = "";
    this.sessionStartTime = new Date().toISOString();
    this.sessionEndTime = null;
    this.sessionDurationSec = 0;
    this.sessionWarningsCount = 0;
    this.currentSessionEvents = [];
    this.closureSeconds = 0.0;
    this.currentSessionId = `sess_${Date.now()}`;
    this.notify("session_started");
  }

  pauseSession() {
    if (!this.isMonitoring || this.isPaused) return;
    this.isPaused = true;
    this.driverStatus = "Unable to Assess";
    this.notify("session_paused");
  }

  resumeSession() {
    if (!this.isMonitoring || !this.isPaused) return;
    this.isPaused = false;
    this.driverStatus = this.faceDetected ? "Alert" : "Unable to Assess";
    this.notify("session_resumed");
  }

  recordWarningEvent({ typeLabel = "Prolonged Eye Closure", duration = 0 }) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour12: true });
    const durSec = typeof duration === "number" ? duration : parseFloat(duration) || 0;

    const event = {
      id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: timeStr,
      isoTimestamp: now.toISOString(),
      type: "Possible Drowsiness",
      typeLabel: typeLabel,
      duration: `${durSec.toFixed(1)}s`
    };

    this.sessionWarningsCount++;
    this.currentSessionEvents.push(event);
    this.notify("warning_recorded");
    return event;
  }

  stopSession() {
    if (!this.isMonitoring || this.sessionSaved) return;

    this.sessionSaved = true;
    this.sessionEndTime = new Date().toISOString();

    const completedSession = {
      id: this.currentSessionId || `sess_${Date.now()}`,
      startTime: this.sessionStartTime || new Date(Date.now() - this.sessionDurationSec * 1000).toISOString(),
      endTime: this.sessionEndTime,
      durationSeconds: this.sessionDurationSec,
      warningEventsCount: this.sessionWarningsCount,
      events: [...this.currentSessionEvents]
    };

    // Save session if monitoring lasted at least 1 second or if any warning occurred
    if (this.sessionDurationSec >= 1 || this.currentSessionEvents.length > 0) {
      this.sessions.unshift(completedSession);
      this.saveSessions();
    }

    this.lastCompletedSession = completedSession;
    this.isMonitoring = false;
    this.isPaused = false;
    this.driverStatus = "Unable to Assess";
    this.eyeState = "Unable to Assess";
    this.activeWarningType = "";
    this.closureSeconds = 0.0;
    this.notify("session_stopped");
  }

  clearSessions() {
    this.sessions = [];
    this.lastCompletedSession = null;
    this.saveSessions();
    this.notify("sessions_cleared");
  }
}

export const appState = new StateManager();
