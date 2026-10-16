/* ==========================================================================
   DRIVER DROWSINESS DETECTION - SINGLE SCREEN APPLICATION
   Clean, simple, intuitive interface with zero unnecessary complexity
   ========================================================================== */

import { ICONS, formatDurationText } from "./utils.js";
import { appState } from "./state.js";
import { visionEngine } from "./vision.js";

class SingleScreenApp {
  constructor() {
    this.root = document.getElementById("app-root");
    this.timerInterval = null;
  }

  init() {
    // Apply saved theme (default dark)
    const savedTheme = localStorage.getItem("drowsiness_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);

    // Initial render
    this.render();

    // Subscribe to state changes
    appState.subscribe(() => {
      this.updateStatusAndUI();
    });

    // Duration timer ticker
    this.timerInterval = setInterval(() => {
      if (appState.isMonitoring) {
        appState.sessionDurationSec++;
      }
    }, 1000);
  }

  render() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";

    this.root.innerHTML = `
      <div class="app-container">
        <!-- Top Utility Bar (Theme toggle only) -->
        <header class="app-top-bar">
          <button class="theme-toggle-btn" id="theme-toggle-btn" aria-label="Toggle Dark and Light Mode" title="Toggle Theme">
            ${isDark ? ICONS.sun : ICONS.moon}
          </button>
        </header>

        <!-- Main Screen Card -->
        <main class="main-card" id="main-card">
          ${this.getMainCardContent()}
        </main>

        <!-- Safety Notice -->
        <footer class="app-safety-notice">
          Safety Notice: This application is a prototype assistive tool and must not replace proper rest or safe driving decisions. Always stop and rest if you feel tired.
        </footer>
      </div>
    `;

    this.bindEvents();
  }

  getMainCardContent() {
    // 1. Session Summary State (Shown right after stopping)
    if (!appState.isMonitoring && appState.lastSession) {
      return `
        <h1 class="app-title">Driver Drowsiness Detection</h1>
        <p class="app-instruction">Session Summary</p>

        <div class="summary-box">
          <div class="summary-item">
            <span class="summary-label">Monitoring Duration</span>
            <span class="summary-value">${formatDurationText(appState.lastSession.durationSeconds)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Possible Drowsiness Events Detected</span>
            <span class="summary-value ${appState.lastSession.drowsinessEventsCount > 0 ? 'text-danger' : 'text-safe'}">
              ${appState.lastSession.drowsinessEventsCount}
            </span>
          </div>
        </div>

        <button class="btn btn-primary btn-large" id="start-again-btn">
          ${ICONS.play} START AGAIN
        </button>
      `;
    }

    // 2. Monitoring Active State
    if (appState.isMonitoring) {
      const statusClass = this.getStatusClass();

      return `
        <h1 class="app-title">Driver Drowsiness Detection</h1>
        <p class="app-instruction">Monitor your eyes to detect signs of drowsiness.</p>

        <!-- One Large Status Message -->
        <div class="status-banner ${statusClass}" id="main-status-banner">
          <span class="status-indicator-dot"></span>
          <span class="status-text" id="status-text">${appState.statusText || 'Starting camera...'}</span>
        </div>

        <!-- Camera Preview -->
        <div class="camera-preview-wrapper ${appState.activeWarning ? 'alert-flashing' : ''}" id="camera-preview-wrapper">
          <video id="webcam-video" autoplay playsinline muted></video>
          <canvas id="overlay-canvas"></canvas>
          <div class="camera-unavailable-overlay" id="camera-unavailable-overlay" style="display: ${appState.status === 'CAMERA_UNAVAILABLE' ? 'flex' : 'none'};">
            <p><strong>Camera Unavailable</strong></p>
            <p class="error-detail">${appState.cameraError || 'Please allow camera permissions and ensure no other application is using your webcam.'}</p>
          </div>
        </div>

        <!-- One STOP MONITORING Button -->
        <button class="btn btn-danger btn-large" id="stop-monitoring-btn">
          ${ICONS.stop} STOP MONITORING
        </button>
      `;
    }

    // 3. Ready / Initial State
    return `
      <h1 class="app-title">Driver Drowsiness Detection</h1>
      <p class="app-instruction">Monitor your eyes to detect signs of drowsiness.</p>

      <div class="start-wrapper">
        <button class="btn btn-primary btn-large" id="start-monitoring-btn">
          ${ICONS.play} START MONITORING
        </button>
      </div>
    `;
  }

  getStatusClass() {
    if (appState.status === "ALERT") return "status-alert-green";
    if (appState.status === "DROWSY") return "status-drowsy-red";
    if (appState.status === "NO_FACE") return "status-noface-grey";
    if (appState.status === "CAMERA_UNAVAILABLE") return "status-unavailable-grey";
    return "status-noface-grey";
  }

  bindEvents() {
    // Theme toggle
    const themeBtn = document.getElementById("theme-toggle-btn");
    if (themeBtn) {
      themeBtn.onclick = () => {
        const cur = document.documentElement.getAttribute("data-theme") || "dark";
        const next = cur === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("drowsiness_theme", next);
        themeBtn.innerHTML = next === "dark" ? ICONS.sun : ICONS.moon;
      };
    }

    // Start Monitoring button
    const startBtn = document.getElementById("start-monitoring-btn");
    if (startBtn) {
      startBtn.onclick = () => this.startMonitoringFlow();
    }

    // Start Again button (from summary)
    const startAgainBtn = document.getElementById("start-again-btn");
    if (startAgainBtn) {
      startAgainBtn.onclick = () => this.startMonitoringFlow();
    }

    // Stop Monitoring button
    const stopBtn = document.getElementById("stop-monitoring-btn");
    if (stopBtn) {
      stopBtn.onclick = () => this.stopMonitoringFlow();
    }
  }

  async startMonitoringFlow() {
    appState.startSession();
    this.render();

    const video = document.getElementById("webcam-video");
    const canvas = document.getElementById("overlay-canvas");

    if (video && canvas) {
      await visionEngine.startCamera(video, canvas);
    }
  }

  stopMonitoringFlow() {
    visionEngine.stopCamera();
    appState.stopSession();
    this.render();
  }

  updateStatusAndUI() {
    if (!appState.isMonitoring) return;

    // Fast-path DOM update for real-time video tracking
    const statusBanner = document.getElementById("main-status-banner");
    const statusText = document.getElementById("status-text");
    const previewWrapper = document.getElementById("camera-preview-wrapper");
    const unavailOverlay = document.getElementById("camera-unavailable-overlay");

    if (statusBanner && statusText) {
      statusBanner.className = `status-banner ${this.getStatusClass()}`;
      statusText.textContent = appState.statusText;
    }

    if (previewWrapper) {
      if (appState.activeWarning) {
        previewWrapper.classList.add("alert-flashing");
      } else {
        previewWrapper.classList.remove("alert-flashing");
      }
    }

    if (unavailOverlay) {
      unavailOverlay.style.display = appState.status === "CAMERA_UNAVAILABLE" ? "flex" : "none";
      const errDetail = unavailOverlay.querySelector(".error-detail");
      if (errDetail && appState.cameraError) {
        errDetail.textContent = appState.cameraError;
      }
    }
  }
}

// Bootstrap single-screen application
function bootstrapApp() {
  const app = new SingleScreenApp();
  app.init();

  // Safely stop session on unexpected window close
  window.addEventListener("beforeunload", () => {
    if (appState.isMonitoring) {
      visionEngine.stopCamera();
      appState.stopSession();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapApp);
} else {
  bootstrapApp();
}
