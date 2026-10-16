/* ==========================================================================
   STATE MANAGEMENT & PERSISTENT SESSION HISTORY
   Single-screen Driver Drowsiness Detection state & history engine
   ========================================================================== */

const STORAGE_KEY_HISTORY = "drowsiness_session_history";

class StateManager {
  constructor() {
    this.currentView = "main"; // "main" | "monitoring" | "summary" | "history"
    this.previousView = "main";

    this.isMonitoring = false;
    this.status = "IDLE"; // "ALERT", "DROWSY", "NO_FACE", "CAMERA_UNAVAILABLE", "IDLE"
    this.statusText = "";
    this.cameraError = null;
    this.activeWarning = false;

    // Active session timing and event tracking
    this.sessionStartTime = null;
    this.sessionDurationSec = 0;
    this.drowsinessEventsCount = 0;
    this.lastSession = null;

    // Subscribed listeners
    this.subscribers = new Set();
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
      this.statusText = "You appear alert.";
      this.activeWarning = false;
    } else if (status === "DROWSY") {
      this.statusText = "Possible drowsiness detected!";
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
    this.setStatus("NO_FACE");
  }

  recordDrowsinessEvent() {
    this.drowsinessEventsCount++;
    this.notify();
  }

  stopSession() {
    if (!this.isMonitoring) return null;

    const resultLabel =
      this.drowsinessEventsCount > 0
        ? "Possible drowsiness detected"
        : "No possible drowsiness events detected";

    const sessionRecord = {
      id: "sess_" + Date.now(),
      timestamp: this.sessionStartTime || Date.now(),
      durationSeconds: this.sessionDurationSec,
      drowsinessEventsCount: this.drowsinessEventsCount,
      resultLabel
    };

    // Save genuine completed sessions to persistent history
    if (this.sessionDurationSec >= 2) {
      this.saveSessionToHistory(sessionRecord);
    }

    this.lastSession = sessionRecord;
    this.isMonitoring = false;
    this.status = "IDLE";
    this.statusText = "";
    this.activeWarning = false;
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
      // Guard against duplicate records
      const exists = history.some((item) => item.id === sessionRecord.id);
      if (!exists) {
        history.unshift(sessionRecord);
        // Retain reasonable maximum history limit
        const trimmed = history.slice(0, 50);
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(trimmed));
      }
    } catch (e) {
      console.warn("Error saving session to history:", e);
    }
  }

  clearHistory() {
    try {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
      this.notify();
      return true;
    } catch (e) {
      console.warn("Error clearing history:", e);
      return false;
    }
  }
}

export const appState = new StateManager();
