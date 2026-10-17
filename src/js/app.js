/* ==========================================================================
   DRIVER DROWSINESS DETECTION - APPLICATION CONTROLLER
   Full-screen modern computer-vision dashboard with Emergency Alert warning system
   ========================================================================== */

import { ICONS, formatDurationText, formatTimerDisplay, formatDateTime } from "./utils.js";
import { appState } from "./state.js";
import { visionEngine } from "./vision.js";
import { soundManager } from "./audio.js";

class SingleScreenApp {
  constructor() {
    this.root = document.getElementById("app-root");
    this.timerInterval = null;
    this.showDeleteModal = false;
  }

  init() {
    // Apply saved theme (default dark navy)
    const savedTheme = localStorage.getItem("drowsiness_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);

    // Initial render
    this.render();

    // Subscribe to application state changes
    appState.subscribe(() => {
      this.onStateChange();
    });

    // Duration timer ticker (increments sessionDurationSec during monitoring)
    this.timerInterval = setInterval(() => {
      if (appState.isMonitoring) {
        appState.sessionDurationSec++;
        // Fast-path clock update without re-rendering entire DOM
        const clockEl = document.getElementById("live-clock-val");
        if (clockEl) {
          clockEl.textContent = formatTimerDisplay(appState.sessionDurationSec);
        }
      }
    }, 1000);

    // Fullscreen change listener
    document.addEventListener("fullscreenchange", () => {
      this.updateFullscreenButton();
    });
  }

  onStateChange() {
    // Fast path: if monitoring is active and view is already 'monitoring', only update live detection overlay & banner
    if (appState.isMonitoring && appState.currentView === "monitoring") {
      this.updateMonitoringUI();
      return;
    }

    // View changed or session stopped: full re-render
    this.render();
  }

  render() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const isFs = Boolean(document.fullscreenElement);
    const currentView = appState.currentView;

    this.root.innerHTML = `
      <div class="app-container">
        <!-- Top Utility Header -->
        <header class="app-top-bar">
          <div class="top-bar-branding">
            <span class="system-pill">AI Vision Assist</span>
          </div>
          <div class="top-bar-actions">
            <!-- Fullscreen API Toggle -->
            <button class="icon-btn" id="fullscreen-toggle-btn" aria-label="Toggle Fullscreen Mode" title="Toggle Fullscreen">
              ${isFs ? ICONS.minimize : ICONS.maximize}
              <span>${isFs ? 'Exit Full Screen' : 'Full Screen'}</span>
            </button>

            <!-- History Button (when not already on history page and not actively monitoring) -->
            ${
              currentView !== "history" && !appState.isMonitoring
                ? `<button class="icon-btn" id="header-history-btn" aria-label="View Session History" title="View History">
                     ${ICONS.history}
                     <span>History</span>
                   </button>`
                : ""
            }

            <!-- Theme Toggle Button -->
            <button class="icon-btn" id="theme-toggle-btn" aria-label="Toggle Dark and Light Mode" title="Toggle Theme">
              ${isDark ? ICONS.sun : ICONS.moon}
            </button>
          </div>
        </header>

        <!-- Main Dashboard Card -->
        <main class="main-card" id="main-card">
          ${this.getMainCardContent()}
        </main>

        <!-- Safety & Privacy Notice Footer -->
        <footer class="app-safety-notice">
          Safety Notice: Video is processed locally in real time and is never uploaded or recorded. This assistive tool is a prototype and does not replace safe driving decisions or adequate rest.
        </footer>

        <!-- Confirmation Modal for Delete History -->
        ${this.renderDeleteModal()}
      </div>
    `;

    this.bindEvents();
  }

  getMainCardContent() {
    switch (appState.currentView) {
      case "monitoring":
        return this.renderMonitoringView();
      case "summary":
        return this.renderSummaryView();
      case "history":
        return this.renderHistoryView();
      case "main":
      default:
        return this.renderMainView();
    }
  }

  /* -------------------------------------------------------------------------
     1. Main Screen View (Ready State with Emergency Alert Controls)
     ------------------------------------------------------------------------- */
  renderMainView() {
    const isMuted = soundManager.isMuted;
    const vol = soundManager.volume;

    return `
      <h1 class="app-title">Driver Drowsiness Detection</h1>
      <p class="app-instruction">
        Real-time computer-vision monitoring for driver alertness and prolonged eye closure. Keep your eyes on the road.
      </p>

      <div class="start-wrapper">
        <button class="btn btn-primary btn-large" id="start-monitoring-btn">
          ${ICONS.play} START MONITORING
        </button>
      </div>

      <!-- Emergency Alert Sound & Volume Controls -->
      <div class="dashboard-controls-card">
        <div class="control-group">
          <span class="control-label">Emergency Alert</span>
          <button class="control-btn" id="mute-toggle-btn" title="${isMuted ? 'Unmute alert sound' : 'Mute alert sound'}">
            ${isMuted ? ICONS.volumeMute : ICONS.volumeUp}
            <span>${isMuted ? 'Muted' : 'Sound Active'}</span>
          </button>
          <button class="control-btn" id="test-sound-btn" title="Test Emergency Alert sound">
            ${ICONS.bell}
            <span>Test Sound</span>
          </button>
        </div>

        <div class="control-group">
          <span class="control-label">Volume</span>
          <div class="volume-slider-wrap">
            <input
              type="range"
              min="0"
              max="100"
              value="${vol}"
              class="volume-slider"
              id="volume-slider"
              aria-label="Alert Sound Volume"
            />
            <span class="volume-val" id="volume-val-display">${vol}%</span>
          </div>
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
     2. Live Monitoring View (Full-Screen Comfortable Layout)
     ------------------------------------------------------------------------- */
  renderMonitoringView() {
    const statusClass = this.getStatusClass();
    const isMuted = soundManager.isMuted;
    const clockStr = formatTimerDisplay(appState.sessionDurationSec);

    return `
      <div class="monitoring-container">
        <h1 class="app-title">Driver Drowsiness Detection</h1>
        <p class="app-instruction">Monitor your eyes to detect signs of drowsiness in real time.</p>

        <!-- One Clear Large Status Banner -->
        <div class="status-banner ${statusClass}" id="main-status-banner">
          <span class="status-indicator-dot"></span>
          <span class="status-text" id="status-text">${appState.statusText || 'Starting camera...'}</span>
        </div>

        <!-- Large Comfortable Camera Preview Wrapper -->
        <div class="camera-preview-wrapper ${appState.activeWarning ? 'alert-flashing' : ''}" id="camera-preview-wrapper">
          <video id="webcam-video" autoplay playsinline muted></video>
          <canvas id="overlay-canvas"></canvas>
          <div class="camera-unavailable-overlay" id="camera-unavailable-overlay" style="display: ${appState.status === 'CAMERA_UNAVAILABLE' ? 'flex' : 'none'};">
            <p><strong>Camera Unavailable</strong></p>
            <p class="error-detail">${appState.cameraError || 'Please allow camera permissions and ensure no other application is using your webcam.'}</p>
          </div>
        </div>

        <!-- Monitoring Telemetrics & Sound Bar -->
        <div class="monitoring-bar">
          <div class="session-live-clock">
            <span>Duration:</span>
            <span class="clock-val" id="live-clock-val">${clockStr}</span>
          </div>

          <div class="control-group">
            <button class="control-btn" id="live-mute-toggle-btn" title="${isMuted ? 'Unmute alert sound' : 'Mute alert sound'}">
              ${isMuted ? ICONS.volumeMute : ICONS.volumeUp}
              <span>${isMuted ? 'Muted' : 'Sound Active'}</span>
            </button>
            <button class="control-btn" id="live-test-sound-btn" title="Test Emergency Alert sound">
              ${ICONS.bell}
              <span>Test Sound</span>
            </button>
          </div>
        </div>

        <!-- Large STOP MONITORING Button -->
        <button class="btn btn-danger btn-large" id="stop-monitoring-btn">
          ${ICONS.stop} STOP MONITORING
        </button>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
     3. Session Summary View (Wide, Symmetrical & Balanced)
     ------------------------------------------------------------------------- */
  renderSummaryView() {
    const session = appState.lastSession || {
      durationSeconds: 0,
      drowsinessEventsCount: 0,
      timestamp: Date.now(),
      resultLabel: "No possible drowsiness events detected"
    };

    const isWarn = session.drowsinessEventsCount > 0;
    const resultClass = isWarn ? "summary-result-warn" : "summary-result-safe";
    const resultIcon = isWarn ? ICONS.alertTriangle : ICONS.check;

    return `
      <div class="summary-container">
        <h1 class="app-title">Driver Drowsiness Detection</h1>
        <p class="app-instruction">Session Summary</p>

        <!-- Symmetrical Result Status Banner -->
        <div class="summary-result-banner ${resultClass}">
          ${resultIcon}
          <span>${session.resultLabel}</span>
        </div>

        <!-- 3-Column Metrics Grid -->
        <div class="summary-metrics-grid">
          <div class="summary-card-cell">
            <span class="cell-label">Session Duration</span>
            <span class="cell-value">${formatDurationText(session.durationSeconds)}</span>
            <span class="cell-subtext">Active monitoring time</span>
          </div>

          <div class="summary-card-cell">
            <span class="cell-label">Drowsiness Events</span>
            <span class="cell-value" style="color: ${isWarn ? '#ef4444' : '#10b981'};">
              ${session.drowsinessEventsCount}
            </span>
            <span class="cell-subtext">${isWarn ? 'Prolonged eye closure detected' : 'Alert driver status maintained'}</span>
          </div>

          <div class="summary-card-cell">
            <span class="cell-label">Date & Time</span>
            <span class="cell-value" style="font-size: 1.25rem;">${formatDateTime(session.timestamp)}</span>
            <span class="cell-subtext">Actual completed session</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="summary-actions-row">
          <button class="btn btn-primary btn-large" id="start-new-session-btn">
            ${ICONS.play} START NEW SESSION
          </button>
          <button class="btn btn-secondary btn-large" id="view-history-btn">
            ${ICONS.history} VIEW HISTORY
          </button>
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
     4. Session History View (Full-Width Responsive List)
     ------------------------------------------------------------------------- */
  renderHistoryView() {
    const history = appState.getHistory();

    let listHtml = "";
    if (history.length === 0) {
      listHtml = `
        <div class="history-empty-card">
          ${ICONS.history}
          <div class="empty-title">No Previous Sessions</div>
          <p class="empty-desc">Completed monitoring sessions will automatically be recorded and displayed here.</p>
        </div>
      `;
    } else {
      listHtml = `
        <div class="history-list">
          ${history
            .map((item) => {
              const isWarn = item.drowsinessEventsCount > 0;
              const badgeClass = isWarn ? "badge-warn" : "badge-safe";
              return `
                <div class="history-item-card">
                  <div class="history-item-top">
                    <span class="history-date">${formatDateTime(item.timestamp)}</span>
                    <span class="history-result-badge ${badgeClass}">${item.resultLabel}</span>
                  </div>
                  <div class="history-item-metrics">
                    <span class="history-metric">Duration: <strong>${formatDurationText(item.durationSeconds)}</strong></span>
                    <span class="history-metric">Possible drowsiness events: <strong style="color: ${isWarn ? '#ef4444' : '#10b981'};">${item.drowsinessEventsCount}</strong></span>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    }

    return `
      <div class="history-container">
        <h1 class="app-title">Session History</h1>
        <p class="app-instruction">Review your past completed drowsiness monitoring sessions.</p>

        <div class="history-header-row">
          <span class="history-count-badge">${history.length} ${history.length === 1 ? 'Session Recorded' : 'Sessions Recorded'}</span>
        </div>

        ${listHtml}

        <div class="history-actions-row">
          <button class="btn btn-secondary btn-large" id="history-back-btn">
            ${ICONS.back} Back
          </button>
          ${
            history.length > 0
              ? `<button class="btn btn-secondary btn-large" id="clear-history-trigger-btn" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.35);">
                   ${ICONS.trash} Delete History
                 </button>`
              : ""
          }
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
     Confirmation Modal Dialog
     ------------------------------------------------------------------------- */
  renderDeleteModal() {
    if (!this.showDeleteModal) return "";

    return `
      <div class="modal-backdrop" id="delete-modal-backdrop">
        <div class="modal-dialog">
          <div class="modal-icon">
            ${ICONS.trash}
          </div>
          <div class="modal-title">Delete Session History?</div>
          <p class="modal-desc">Are you sure you want to delete all saved session records? This action cannot be undone.</p>
          <div class="modal-btn-row">
            <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
            <button class="btn btn-danger" id="modal-confirm-delete-btn">Confirm Delete</button>
          </div>
        </div>
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

  toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.warn("Fullscreen request error:", err);
          });
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch((err) => {
            console.warn("Exit fullscreen error:", err);
          });
        }
      }
    } catch (e) {
      console.warn("Fullscreen toggle error:", e);
    }
  }

  updateFullscreenButton() {
    const isFs = Boolean(document.fullscreenElement);
    const fsBtn = document.getElementById("fullscreen-toggle-btn");
    if (fsBtn) {
      fsBtn.innerHTML = `
        ${isFs ? ICONS.minimize : ICONS.maximize}
        <span>${isFs ? 'Exit Full Screen' : 'Full Screen'}</span>
      `;
    }
  }

  bindEvents() {
    // Fullscreen API toggle button
    const fsBtn = document.getElementById("fullscreen-toggle-btn");
    if (fsBtn) {
      fsBtn.onclick = () => this.toggleFullscreen();
    }

    // Theme toggle button
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

    // Header History button
    const headerHistBtn = document.getElementById("header-history-btn");
    if (headerHistBtn) {
      headerHistBtn.onclick = () => appState.setView("history");
    }

    // Start Monitoring button (Main view)
    const startBtn = document.getElementById("start-monitoring-btn");
    if (startBtn) {
      startBtn.onclick = () => this.startMonitoringFlow();
    }

    // Start New Session button (Summary view)
    const startNewBtn = document.getElementById("start-new-session-btn");
    if (startNewBtn) {
      startNewBtn.onclick = () => this.startMonitoringFlow();
    }

    // View History button (Summary view)
    const viewHistBtn = document.getElementById("view-history-btn");
    if (viewHistBtn) {
      viewHistBtn.onclick = () => appState.setView("history");
    }

    // Stop Monitoring button
    const stopBtn = document.getElementById("stop-monitoring-btn");
    if (stopBtn) {
      stopBtn.onclick = () => this.stopMonitoringFlow();
    }

    // History Back button
    const histBackBtn = document.getElementById("history-back-btn");
    if (histBackBtn) {
      histBackBtn.onclick = () => {
        const targetView = appState.previousView === "summary" ? "summary" : "main";
        appState.setView(targetView);
      };
    }

    // Clear History trigger
    const clearHistBtn = document.getElementById("clear-history-trigger-btn");
    if (clearHistBtn) {
      clearHistBtn.onclick = () => {
        this.showDeleteModal = true;
        this.render();
      };
    }

    // Modal Cancel
    const modalCancelBtn = document.getElementById("modal-cancel-btn");
    if (modalCancelBtn) {
      modalCancelBtn.onclick = () => {
        this.showDeleteModal = false;
        this.render();
      };
    }

    // Modal Backdrop click to cancel
    const backdrop = document.getElementById("delete-modal-backdrop");
    if (backdrop) {
      backdrop.onclick = (e) => {
        if (e.target === backdrop) {
          this.showDeleteModal = false;
          this.render();
        }
      };
    }

    // Modal Confirm Delete
    const modalConfirmBtn = document.getElementById("modal-confirm-delete-btn");
    if (modalConfirmBtn) {
      modalConfirmBtn.onclick = () => {
        appState.clearHistory();
        this.showDeleteModal = false;
        this.render();
      };
    }

    // Audio Mute toggle (Main view)
    const muteBtn = document.getElementById("mute-toggle-btn");
    if (muteBtn) {
      muteBtn.onclick = () => {
        soundManager.toggleMute();
        this.render();
      };
    }

    // Audio Mute toggle (Live monitoring view)
    const liveMuteBtn = document.getElementById("live-mute-toggle-btn");
    if (liveMuteBtn) {
      liveMuteBtn.onclick = () => {
        const isMuted = soundManager.toggleMute();
        liveMuteBtn.innerHTML = `
          ${isMuted ? ICONS.volumeMute : ICONS.volumeUp}
          <span>${isMuted ? 'Muted' : 'Sound Active'}</span>
        `;
      };
    }

    // Test Sound button (Main view)
    const testSoundBtn = document.getElementById("test-sound-btn");
    if (testSoundBtn) {
      testSoundBtn.onclick = () => soundManager.testAlertSound();
    }

    // Test Sound button (Live monitoring view)
    const liveTestSoundBtn = document.getElementById("live-test-sound-btn");
    if (liveTestSoundBtn) {
      liveTestSoundBtn.onclick = () => soundManager.testAlertSound();
    }

    // Volume Slider (Main view)
    const volSlider = document.getElementById("volume-slider");
    const volValDisplay = document.getElementById("volume-val-display");
    if (volSlider && volValDisplay) {
      volSlider.oninput = (e) => {
        const val = parseInt(e.target.value, 10);
        soundManager.setVolume(val);
        volValDisplay.textContent = `${val}%`;
      };
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

  updateMonitoringUI() {
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
