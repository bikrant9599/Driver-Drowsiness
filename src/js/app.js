/* ==========================================================================
   DRIVER DROWSINESS DETECTION - APPLICATION CONTROLLER
   Full-screen modern computer-vision dashboard with Emergency Siren warning system,
   real-time eye telemetry dashboard, and configurable accuracy calibration
   ========================================================================== */

import { ICONS, formatDurationText, formatTimerDisplay, formatDateTime } from "./utils.js";
import { appState, DEFAULT_SETTINGS } from "./state.js";
import { visionEngine } from "./vision.js";
import { soundManager } from "./audio.js";

class SingleScreenApp {
  constructor() {
    this.root = document.getElementById("app-root");
    this.timerInterval = null;
    this.showDeleteModal = false;
    this.showSettingsModal = false;

    // Calibration UI State
    this.calibrationProgress = 0;
    this.isCalibrating = false;
    this.calibrationMessage = null;
  }

  init() {
    // Apply saved theme (default dark navy)
    const savedTheme = localStorage.getItem("drowsiness_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);

    // Initial render
    this.render();

    // Fast-path real-time telemetry callback directly from VisionEngine
    visionEngine.onTelemetryUpdate = (telemetry) => {
      this.updateTelemetryUI(telemetry);
    };

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
            <!-- Settings & Calibration Button -->
            <button class="icon-btn" id="header-settings-btn" aria-label="Detection Settings" title="Detection Settings & Calibration">
              ${ICONS.sliders}
              <span>Settings</span>
            </button>

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

        <!-- Detection Settings Modal -->
        ${this.renderSettingsModal()}

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
     1. Main Screen View (Ready State with Calibration Profile & Controls)
     ------------------------------------------------------------------------- */
  renderMainView() {
    const isMuted = soundManager.isMuted;
    const vol = soundManager.volume;
    const settings = appState.settings;
    const isCalibrated = settings.calibratedBaselineEAR !== null;

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

      <!-- Calibration Profile Card -->
      <div class="calibration-status-card">
        <div class="calibration-status-left">
          ${ICONS.crosshair}
          <div>
            <div>${isCalibrated ? '<strong>Personalized Eye Calibration Active</strong>' : '<strong>Standard Eye Profile</strong>'}</div>
            <div style="font-size: 0.775rem; color: var(--text-muted);">
              ${isCalibrated
                ? `Baseline EAR: ${settings.calibratedBaselineEAR.toFixed(2)} · Closure Threshold: ${settings.earThreshold.toFixed(2)}`
                : `Configured Threshold: ${settings.earThreshold.toFixed(2)} · Window: ${settings.drowsinessThresholdSec.toFixed(1)}s`}
            </div>
          </div>
        </div>
        <button class="control-btn" id="open-calibration-btn" title="Adjust detection thresholds or calibrate">
          ${ICONS.sliders}
          <span>${isCalibrated ? 'Recalibrate' : 'Calibrate Eyes'}</span>
        </button>
      </div>

      <!-- Emergency Siren Sound & Volume Controls -->
      <div class="dashboard-controls-card">
        <div class="control-group">
          <span class="control-label">Emergency Siren</span>
          <button class="control-btn" id="mute-toggle-btn" title="${isMuted ? 'Unmute alert siren' : 'Mute alert siren'}">
            ${isMuted ? ICONS.volumeMute : ICONS.volumeUp}
            <span>${isMuted ? 'Muted' : 'Sound Active'}</span>
          </button>
          <button class="control-btn" id="test-sound-btn" title="Test Emergency Siren sound">
            ${ICONS.bell}
            <span>Test Siren</span>
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
              aria-label="Alert Siren Volume"
            />
            <span class="volume-val" id="volume-val-display">${vol}%</span>
          </div>
        </div>
      </div>
    `;
  }

  /* -------------------------------------------------------------------------
     2. Live Monitoring View (Full-Screen Futuristic CV Dashboard)
     ------------------------------------------------------------------------- */
  renderMonitoringView() {
    const statusClass = this.getStatusClass();
    const isMuted = soundManager.isMuted;
    const clockStr = formatTimerDisplay(appState.sessionDurationSec);
    const settings = appState.settings;

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

        <!-- Real-Time Computer-Vision Telemetry Dashboard (Requirement 3) -->
        <div class="telemetry-dashboard-grid">
          <!-- Card 1: Face Detection -->
          <div class="telemetry-card">
            <div class="telemetry-card-header">
              <span class="telemetry-label">Face Detection</span>
              <span id="hud-face-status" class="hud-badge badge-neutral">STANDBY</span>
            </div>
            <div class="telemetry-value-row">
              <span class="telemetry-subtext">MediaPipe 478 Mesh</span>
            </div>
          </div>

          <!-- Card 2: Eye Tracking -->
          <div class="telemetry-card">
            <div class="telemetry-card-header">
              <span class="telemetry-label">Eye Tracking</span>
              <span id="hud-track-status" class="hud-badge badge-neutral">STANDBY</span>
            </div>
            <div class="telemetry-value-row">
              <span class="telemetry-subtext">Continuous Contour</span>
            </div>
          </div>

          <!-- Card 3: Left Eye -->
          <div class="telemetry-card">
            <div class="telemetry-card-header">
              <span class="telemetry-label">Left Eye</span>
              <span id="hud-left-state" class="hud-badge badge-eye-open">OPEN</span>
            </div>
            <div class="telemetry-value-row">
              <span class="telemetry-subtext">EAR:</span>
              <span id="hud-left-ear" class="telemetry-metric tabular-nums">0.28</span>
            </div>
          </div>

          <!-- Card 4: Right Eye -->
          <div class="telemetry-card">
            <div class="telemetry-card-header">
              <span class="telemetry-label">Right Eye</span>
              <span id="hud-right-state" class="hud-badge badge-eye-open">OPEN</span>
            </div>
            <div class="telemetry-value-row">
              <span class="telemetry-subtext">EAR:</span>
              <span id="hud-right-ear" class="telemetry-metric tabular-nums">0.28</span>
            </div>
          </div>

          <!-- Card 5: Blink Detection -->
          <div class="telemetry-card">
            <div class="telemetry-card-header">
              <span class="telemetry-label">Blink Detection</span>
              <span id="hud-blink-pill" class="blink-live-pill"><span class="blink-dot"></span>LIVE</span>
            </div>
            <div class="telemetry-value-row">
              <span id="hud-blink-count" class="telemetry-metric tabular-nums">0</span>
              <span class="telemetry-subtext">blinks (<span id="hud-blink-rate">0</span> bpm)</span>
            </div>
          </div>

          <!-- Card 6: Eye Closure Duration -->
          <div class="telemetry-card">
            <div class="telemetry-card-header">
              <span class="telemetry-label">Closure Timer</span>
              <span id="hud-closure-timer" class="telemetry-metric tabular-nums" style="font-size: 1rem; color: #38bdf8;">0.00s</span>
            </div>
            <div class="closure-progress-bar">
              <div id="hud-closure-progress" class="closure-progress-fill progress-normal" style="width: 0%;"></div>
            </div>
            <div class="telemetry-subtext" style="margin-top: 0.15rem;">
              Limit: <span id="hud-closure-threshold">${settings.drowsinessThresholdSec.toFixed(1)}s</span>
            </div>
          </div>

          <!-- Card 7: Drowsiness Status (Wide 2-column cell) -->
          <div class="telemetry-card telemetry-card-wide">
            <div class="telemetry-card-header">
              <span class="telemetry-label">Drowsiness Status</span>
              <span id="hud-risk-badge" class="hud-badge badge-risk-normal">NORMAL</span>
            </div>
            <div class="telemetry-value-row">
              <span class="telemetry-subtext" id="hud-risk-subtext">Active driver alertness confirmed · Normal blinking verified</span>
            </div>
          </div>
        </div>

        <!-- Monitoring Telemetrics & Sound Bar -->
        <div class="monitoring-bar">
          <div class="session-live-clock">
            <span>Duration:</span>
            <span class="clock-val" id="live-clock-val">${clockStr}</span>
          </div>

          <div class="control-group">
            <button class="control-btn" id="live-settings-btn" title="Detection Settings">
              ${ICONS.sliders}
              <span>Settings</span>
            </button>
            <button class="control-btn" id="live-mute-toggle-btn" title="${isMuted ? 'Unmute alert siren' : 'Mute alert siren'}">
              ${isMuted ? ICONS.volumeMute : ICONS.volumeUp}
              <span>${isMuted ? 'Muted' : 'Sound Active'}</span>
            </button>
            <button class="control-btn" id="live-test-sound-btn" title="Test Emergency Siren sound">
              ${ICONS.bell}
              <span>Test Siren</span>
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
      blinkCount: 0,
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
     5. Settings & Accuracy Calibration Modal
     ------------------------------------------------------------------------- */
  renderSettingsModal() {
    if (!this.showSettingsModal) return "";

    const settings = appState.settings;

    return `
      <div class="modal-backdrop" id="settings-modal-backdrop">
        <div class="settings-modal-dialog">
          <div class="settings-header">
            <div class="settings-title">
              ${ICONS.sliders}
              <span>Detection Settings & Accuracy Calibration</span>
            </div>
            <button class="icon-btn" id="modal-close-settings-x" style="height: 32px; padding: 0 0.5rem;">✕</button>
          </div>

          <!-- Section 1: Interactive 3-Second Calibration -->
          <div class="settings-section">
            <span class="settings-section-title">${ICONS.crosshair} Personalized Eye Calibration</span>
            <div class="calibration-card-box">
              <p class="setting-desc" style="color: var(--text-secondary);">
                Calibrate to your personal open-eye baseline, accommodating glasses, eye shape, lighting, and camera distance.
              </p>
              ${
                this.isCalibrating
                  ? `
                    <div style="font-weight: 700; color: #38bdf8; font-size: 0.85rem;">
                      Looking at camera normally... Calibrating (${this.calibrationProgress}%)
                    </div>
                    <div class="calibration-progress-container">
                      <div class="calibration-progress-fill" style="width: ${this.calibrationProgress}%;"></div>
                    </div>
                  `
                  : `
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                      <button class="btn btn-primary" id="start-calibration-action-btn" style="padding: 0.5rem 1rem; font-size: 0.825rem;">
                        ${ICONS.eye} Run 3s Calibration
                      </button>
                      <span id="calibration-feedback-txt" style="font-size: 0.775rem; color: #38bdf8; font-weight: 600;">
                        ${this.calibrationMessage || (settings.calibratedBaselineEAR ? `Calibrated: EAR ${settings.calibratedBaselineEAR.toFixed(2)}` : 'Default uncalibrated profile')}
                      </span>
                    </div>
                  `
              }
            </div>
          </div>

          <!-- Section 2: Eye Aspect Ratio (EAR) Threshold -->
          <div class="settings-section">
            <span class="settings-section-title">${ICONS.eye} Eye Closure Sensitivity (EAR)</span>
            <div class="setting-row">
              <div class="setting-row-top">
                <span class="setting-name">Closure Threshold</span>
                <span class="setting-val-tag" id="setting-ear-val-display">${settings.earThreshold.toFixed(2)}</span>
              </div>
              <p class="setting-desc">
                Eye Aspect Ratio below which eyes are classified as closed. Lower values accommodate glasses and narrower eyes; higher values trigger sooner.
              </p>
              <input
                type="range"
                min="0.16"
                max="0.32"
                step="0.01"
                value="${settings.earThreshold}"
                class="setting-slider"
                id="setting-ear-slider"
              />
              <div class="preset-btn-group">
                <button class="preset-chip ${settings.earThreshold === 0.18 ? 'active' : ''}" data-ear="0.18">Spectacles (0.18)</button>
                <button class="preset-chip ${settings.earThreshold === 0.21 ? 'active' : ''}" data-ear="0.21">Standard (0.21)</button>
                <button class="preset-chip ${settings.earThreshold === 0.24 ? 'active' : ''}" data-ear="0.24">High Sensitivity (0.24)</button>
              </div>
            </div>
          </div>

          <!-- Section 3: Time Windows & Cooldown -->
          <div class="settings-section">
            <span class="settings-section-title">${ICONS.bell} Timing & Siren Cooldown</span>
            <div class="setting-row">
              <div class="setting-row-top">
                <span class="setting-name">Drowsiness Trigger Duration</span>
                <span class="setting-val-tag" id="setting-drowsy-sec-display">${settings.drowsinessThresholdSec.toFixed(1)}s</span>
              </div>
              <p class="setting-desc">Continuous closure duration required before triggering the Emergency Siren. Normal blinks (< 0.4s) never sound the siren.</p>
              <input
                type="range"
                min="1.0"
                max="4.0"
                step="0.25"
                value="${settings.drowsinessThresholdSec}"
                class="setting-slider"
                id="setting-drowsy-sec-slider"
              />
            </div>

            <div class="setting-row">
              <div class="setting-row-top">
                <span class="setting-name">Alarm Cooldown Period</span>
                <span class="setting-val-tag" id="setting-cooldown-sec-display">${settings.alarmCooldownSec.toFixed(1)}s</span>
              </div>
              <p class="setting-desc">Minimum rest period after an alarm stops before a new warning sound can re-trigger, preventing alarm stutter.</p>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.5"
                value="${settings.alarmCooldownSec}"
                class="setting-slider"
                id="setting-cooldown-sec-slider"
              />
            </div>
          </div>

          <!-- Section 4: Accuracy Validation Notice -->
          <div class="tech-info-note">
            ${ICONS.info}
            <strong>Accuracy Validation Note:</strong> Detection leverages MediaPipe Face Landmarker (478 3D landmarks) with Soukupová & Čech (2016) Eye Aspect Ratio and neural blendshapes. While robust to glasses and head tilt, no computer-vision model achieves 100% accuracy under all extreme lighting conditions. Always rest when feeling tired.
          </div>

          <div class="modal-btn-row">
            <button class="btn btn-secondary" id="modal-reset-settings-btn" style="flex: 1;">Reset Defaults</button>
            <button class="btn btn-primary" id="modal-close-settings-btn" style="flex: 1;">Done</button>
          </div>
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

  /* -------------------------------------------------------------------------
     FAST-PATH DOM SYNCHRONIZATION (60 FPS Telemetry Update)
     Updates dashboard DOM elements directly without re-rendering HTML
     ------------------------------------------------------------------------- */
  updateTelemetryUI(telemetry) {
    if (!appState.isMonitoring) return;

    // 1. Face Detection Status
    const faceEl = document.getElementById("hud-face-status");
    if (faceEl) {
      const active = telemetry.faceDetected;
      faceEl.textContent = active ? "ACTIVE" : "NOT DETECTED";
      faceEl.className = `hud-badge ${active ? "badge-safe" : "badge-neutral"}`;
    }

    // 2. Eye Tracking Status
    const trackEl = document.getElementById("hud-track-status");
    if (trackEl) {
      trackEl.textContent = telemetry.eyeTrackingStatus;
      trackEl.className = `hud-badge ${telemetry.eyeTrackingStatus === "ACTIVE" ? "badge-safe" : telemetry.eyeTrackingStatus === "CALIBRATING" ? "badge-warn" : "badge-neutral"}`;
    }

    // 3. Left Eye State & Live EAR
    const leftStateEl = document.getElementById("hud-left-state");
    const leftEarEl = document.getElementById("hud-left-ear");
    if (leftStateEl) {
      leftStateEl.textContent = telemetry.leftEyeState;
      leftStateEl.className = `hud-badge badge-eye-${telemetry.leftEyeState.toLowerCase()}`;
    }
    if (leftEarEl) {
      leftEarEl.textContent = telemetry.leftEAR.toFixed(2);
    }

    // 4. Right Eye State & Live EAR
    const rightStateEl = document.getElementById("hud-right-state");
    const rightEarEl = document.getElementById("hud-right-ear");
    if (rightStateEl) {
      rightStateEl.textContent = telemetry.rightEyeState;
      rightStateEl.className = `hud-badge badge-eye-${telemetry.rightEyeState.toLowerCase()}`;
    }
    if (rightEarEl) {
      rightEarEl.textContent = telemetry.rightEAR.toFixed(2);
    }

    // 5. Blink Detection
    const blinkPill = document.getElementById("hud-blink-pill");
    const blinkCountEl = document.getElementById("hud-blink-count");
    const blinkRateEl = document.getElementById("hud-blink-rate");
    if (blinkPill) {
      if (telemetry.isBlinkingLive) {
        blinkPill.classList.add("blink-flash");
      } else {
        blinkPill.classList.remove("blink-flash");
      }
    }
    if (blinkCountEl) blinkCountEl.textContent = telemetry.blinkCount;
    if (blinkRateEl) blinkRateEl.textContent = telemetry.blinkRate;

    // 6. Eye Closure Duration & Dynamic Progress Bar
    const closureTimerEl = document.getElementById("hud-closure-timer");
    const closureProgressEl = document.getElementById("hud-closure-progress");
    if (closureTimerEl) {
      closureTimerEl.textContent = `${telemetry.closureDurationSec.toFixed(2)}s`;
    }
    if (closureProgressEl) {
      const maxSec = appState.settings.drowsinessThresholdSec || 2.0;
      const pct = Math.min(100, Math.round((telemetry.closureDurationSec / maxSec) * 100));
      closureProgressEl.style.width = `${pct}%`;

      if (pct >= 100) {
        closureProgressEl.className = "closure-progress-fill progress-danger";
      } else if (pct >= 30) {
        closureProgressEl.className = "closure-progress-fill progress-warn";
      } else {
        closureProgressEl.className = "closure-progress-fill progress-normal";
      }
    }

    // 7. Drowsiness Status & Subtext
    const riskBadge = document.getElementById("hud-risk-badge");
    const riskSubtext = document.getElementById("hud-risk-subtext");
    if (riskBadge) {
      const risk = telemetry.drowsinessRisk;
      riskBadge.textContent = risk === "HIGH_RISK" ? "HIGH RISK" : risk;
      riskBadge.className = `hud-badge badge-risk-${risk.toLowerCase()}`;

      if (riskSubtext) {
        if (risk === "HIGH_RISK") {
          riskSubtext.textContent = "EMERGENCY: Prolonged eye closure active! Siren engaged.";
        } else if (risk === "WARNING") {
          riskSubtext.textContent = "Warning: Eye closure duration approaching threshold...";
        } else {
          riskSubtext.textContent = "Active driver alertness confirmed · Normal blinking verified";
        }
      }
    }

    // Update banner text
    const banner = document.getElementById("main-status-banner");
    const bannerText = document.getElementById("status-text");
    if (banner && bannerText) {
      banner.className = `status-banner ${this.getStatusClass()}`;
      bannerText.textContent = appState.statusText;
    }

    // Camera border glow
    const wrapper = document.getElementById("camera-preview-wrapper");
    if (wrapper) {
      if (appState.activeWarning) {
        wrapper.classList.add("alert-flashing");
      } else {
        wrapper.classList.remove("alert-flashing");
      }
    }
  }

  updateMonitoringUI() {
    if (!appState.isMonitoring) return;

    const unavailOverlay = document.getElementById("camera-unavailable-overlay");
    if (unavailOverlay) {
      unavailOverlay.style.display = appState.status === "CAMERA_UNAVAILABLE" ? "flex" : "none";
      const errDetail = unavailOverlay.querySelector(".error-detail");
      if (errDetail && appState.cameraError) {
        errDetail.textContent = appState.cameraError;
      }
    }
  }

  /* -------------------------------------------------------------------------
     Event Binding
     ------------------------------------------------------------------------- */
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

    // Header Settings button
    const headerSettingsBtn = document.getElementById("header-settings-btn");
    if (headerSettingsBtn) {
      headerSettingsBtn.onclick = () => {
        this.showSettingsModal = true;
        this.render();
      };
    }

    // Main screen Calibration profile button
    const openCalibBtn = document.getElementById("open-calibration-btn");
    if (openCalibBtn) {
      openCalibBtn.onclick = () => {
        this.showSettingsModal = true;
        this.render();
      };
    }

    // Live Monitoring Settings button
    const liveSettingsBtn = document.getElementById("live-settings-btn");
    if (liveSettingsBtn) {
      liveSettingsBtn.onclick = () => {
        this.showSettingsModal = true;
        this.render();
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

    // Modal Cancel (Delete)
    const modalCancelBtn = document.getElementById("modal-cancel-btn");
    if (modalCancelBtn) {
      modalCancelBtn.onclick = () => {
        this.showDeleteModal = false;
        this.render();
      };
    }

    // Modal Backdrop click (Delete)
    const deleteBackdrop = document.getElementById("delete-modal-backdrop");
    if (deleteBackdrop) {
      deleteBackdrop.onclick = (e) => {
        if (e.target === deleteBackdrop) {
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

    // Bind Settings Modal Events
    this.bindSettingsEvents();
  }

  bindSettingsEvents() {
    if (!this.showSettingsModal) return;

    // Close Settings via X or Done
    const closeX = document.getElementById("modal-close-settings-x");
    const closeDone = document.getElementById("modal-close-settings-btn");
    const closeHandler = () => {
      this.showSettingsModal = false;
      this.render();
    };
    if (closeX) closeX.onclick = closeHandler;
    if (closeDone) closeDone.onclick = closeHandler;

    // Backdrop click
    const backdrop = document.getElementById("settings-modal-backdrop");
    if (backdrop) {
      backdrop.onclick = (e) => {
        if (e.target === backdrop) closeHandler();
      };
    }

    // EAR Slider
    const earSlider = document.getElementById("setting-ear-slider");
    const earDisplay = document.getElementById("setting-ear-val-display");
    if (earSlider && earDisplay) {
      earSlider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        appState.saveSettings({ earThreshold: val });
        earDisplay.textContent = val.toFixed(2);
      };
    }

    // EAR Presets
    const presetChips = document.querySelectorAll(".preset-chip");
    presetChips.forEach((chip) => {
      chip.onclick = () => {
        const val = parseFloat(chip.dataset.ear);
        appState.saveSettings({ earThreshold: val });
        if (earSlider) earSlider.value = val;
        if (earDisplay) earDisplay.textContent = val.toFixed(2);
        presetChips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
      };
    });

    // Drowsiness Duration Slider
    const drowsySlider = document.getElementById("setting-drowsy-sec-slider");
    const drowsyDisplay = document.getElementById("setting-drowsy-sec-display");
    if (drowsySlider && drowsyDisplay) {
      drowsySlider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        appState.saveSettings({ drowsinessThresholdSec: val });
        drowsyDisplay.textContent = `${val.toFixed(1)}s`;
      };
    }

    // Cooldown Slider
    const cooldownSlider = document.getElementById("setting-cooldown-sec-slider");
    const cooldownDisplay = document.getElementById("setting-cooldown-sec-display");
    if (cooldownSlider && cooldownDisplay) {
      cooldownSlider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        appState.saveSettings({ alarmCooldownSec: val });
        cooldownDisplay.textContent = `${val.toFixed(1)}s`;
      };
    }

    // Reset Defaults
    const resetBtn = document.getElementById("modal-reset-settings-btn");
    if (resetBtn) {
      resetBtn.onclick = () => {
        appState.resetSettings();
        this.calibrationMessage = "Settings reset to defaults.";
        this.render();
      };
    }

    // Run 3-Second Calibration Button
    const calibBtn = document.getElementById("start-calibration-action-btn");
    if (calibBtn) {
      calibBtn.onclick = () => {
        if (!appState.isMonitoring) {
          // If camera is not running, prompt user to start monitoring first
          const feedback = document.getElementById("calibration-feedback-txt");
          if (feedback) {
            feedback.textContent = "Start monitoring first to run live eye calibration.";
            feedback.style.color = "#f59e0b";
          }
          return;
        }

        this.isCalibrating = true;
        this.calibrationProgress = 0;
        this.render();

        visionEngine.startCalibration(
          (progress) => {
            this.calibrationProgress = progress;
            const fill = document.querySelector(".calibration-progress-fill");
            if (fill) fill.style.width = `${progress}%`;
          },
          (result) => {
            this.isCalibrating = false;
            this.calibrationMessage = `Calibrated! Baseline: ${result.baselineEAR.toFixed(2)} · Threshold: ${result.newThreshold.toFixed(2)}`;
            this.render();
          }
        );
      };
    }
  }

  /* -------------------------------------------------------------------------
     Session Start & Stop Flow
     ------------------------------------------------------------------------- */
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
