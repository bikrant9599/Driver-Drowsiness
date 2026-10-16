/* ==========================================================================
   STATE MANAGEMENT
   Single-screen Driver Drowsiness Detection state
   ========================================================================== */

class StateManager {
  constructor() {
    this.isMonitoring = false;
    this.status = "IDLE"; // "ALERT", "DROWSY", "NO_FACE", "CAMERA_UNAVAILABLE", "IDLE"
    this.statusText = "";
    this.cameraError = null;
    this.activeWarning = false;

    // Session timing and event counting
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
    this.sessionStartTime = Date.now();
    this.sessionDurationSec = 0;
    this.drowsinessEventsCount = 0;
    this.lastSession = null;
    this.setStatus("NO_FACE");
  }

  recordDrowsinessEvent() {
    this.drowsinessEventsCount++;
    this.notify();
  }

  stopSession() {
    if (!this.isMonitoring) return null;

    const summary = {
      durationSeconds: this.sessionDurationSec,
      drowsinessEventsCount: this.drowsinessEventsCount
    };

    this.lastSession = summary;
    this.isMonitoring = false;
    this.status = "IDLE";
    this.statusText = "";
    this.activeWarning = false;
    this.notify();
    return summary;
  }
}

export const appState = new StateManager();
