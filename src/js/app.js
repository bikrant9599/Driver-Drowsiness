/* ==========================================================================
   DRIVER DROWSINESS & MULTI-FEATURE SAFETY SYSTEM - APPLICATION CONTROLLER
   Full-screen modern computer-vision dashboard with Seat Belt Detection,
   Mobile Phone Detection, Driver Attention Tracking, and Three-Stage Warning System
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

    // Duration timer ticker
    this.timerInterval = setInterval(() => {
      if (appState.isMonitoring) {
        appState.sessionDurationSec++;
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
    if (appState.isMonitoring && appState.currentView === "monitoring") {
      this.updateMonitoringUI();
      return;
    }

    this.render();
  }

  render() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const isFs = Boolean(document.fullscreenElement);
    const currentView = appState.currentView;

    this.root.innerHTML = `
      <div class="app-container" id="app-container">
        <!-- Top Utility Header -->
        <header class="app-top-bar">
          <div class="top-bar-branding">
            <span class="system-pill">AI Cockpit Safety Vision</span>
          </div>
          <div class="top-bar-actions">
            <!-- Settings & Calibration Button -->
            <button class="icon-btn" id="header-settings-btn" aria-label="Detection Settings" title="Detection Settings & Calibration">
              ${ICONS.sliders}
              <span>Safety Settings</span>
            </button>

            <!-- Fullscreen API Toggle -->
            <button class="icon-btn" id="fullscreen-toggle-btn" aria-label="Toggle Fullscreen Mode" title="Toggle Fullscreen">
              ${isFs ? ICONS.minimize : ICONS.maximize}
              <span>${isFs ? 'Exit Full Screen' : 'Full Screen'}</span>
            </button>

            <!-- History Button -->
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
          Driver Assistance Safety Notice: All neural networks and vision analytics process locally in real time. Video is never uploaded or saved. These features assist driver vigilance and do not substitute for attentive driving or manufacturer safety equipment.
        </footer>

        <!-- Stage 3 Emergency Fullscreen Overlay Container -->
        <div id="emergency-overlay-container"></div>

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
     1. Main Screen View (Cockpit Ready State)
     ------------------------------------------------------------------------- */
  renderMainView() {
    const isMuted = soundManager.isMuted;
    const vol = soundManager.volume;
    const settings = appState.settings;
    const isCalibrated = settings.calibratedBaselineEAR !== null;

    return `
      <h1 class="app-title">AI Driver Safety & Drowsiness Detection</h1>
      <p class="app-instruction">
        Multi-modal computer-vision safety monitoring: Drowsiness & Microsleep, Seat Belt Compliance, Mobile Phone Distraction, and Road Attention Tracking.
      </p>

      <div class="start-wrapper">
        <button class="btn btn-primary btn-large" id="start-monitoring-btn">
          ${ICONS.play} START SAFETY MONITORING
        </button>
      </div>

      <!-- Feature Capabilities Showcase Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; width: 100%; margin-top: 1.25rem;">
        <div class="telemetry-card" style="padding: 0.75rem;">
          <div class="safety-card-title">${ICONS.eye} Drowsiness</div>
          <div style="font-size: 0.76rem; color: var(--text-secondary); margin-top: 0.25rem;">
            8-point 3D EAR & blink frequency filtering
          </div>
        </div>
        <div class="telemetry-card" style="padding: 0.75rem;">
          <div class="safety-card-title">${ICONS.seatbelt} Seat Belt</div>
          <div style="font-size: 0.76rem; color: var(--text-secondary); margin-top: 0.25rem;">
            Diagonal strap tracking & lighting validation
          </div>
        </div>
        <div class="telemetry-card" style="padding: 0.75rem;">
          <div class="safety-card-title">${ICONS.phone} Phone Detection</div>
          <div style="font-size: 0.76rem; color: var(--text-secondary); margin-top: 0.25rem;">
            Real-time device holding & usage alerts
          </div>
        </div>
        <div class="telemetry-card" style="padding: 0.75rem;">
          <div class="safety-card-title">${ICONS.attention} Driver Attention</div>
          <div style="font-size: 0.76rem; color: var(--text-secondary); margin-top: 0.25rem;">
            3D head pose direction (10s gaze alert)
          </div>
        </div>
      </div>

      <!-- Calibration Profile Card -->
      <div class="calibration-status-card">
        <div class="calibration-status-left">
          ${ICONS.crosshair}
          <div>
            <div>${isCalibrated ? '<strong>Personalized Eye Calibration Active</strong>' : '<strong>Standard Automotive Safety Profile</strong>'}</div>
            <div style="font-size: 0.775rem; color: var(--text-muted);">
              ${isCalibrated
                ? `Baseline EAR: ${settings.calibratedBaselineEAR.toFixed(2)} · Closure Threshold: ${settings.earThreshold.toFixed(2)} · Distraction Window: ${settings.distractionWarningSec.toFixed(0)}s`
                : `Closure: ${settings.earThreshold.toFixed(2)} · Phone Delay: ${settings.phoneWarningSec.toFixed(0)}s · Distraction: ${settings.distractionWarningSec.toFixed(0)}s`}
            </div>
          </div>
        </div>
        <button class="control-btn" id="open-calibration-btn" title="Adjust safety thresholds">
          ${ICONS.sliders}
          <span>Configure</span>
        </button>
      </div>

      <!-- Emergency Siren Sound & Volume Controls -->
      <div class="dashboard-controls-card">
        <div class="control-group">
          <span class="control-label">Three-Stage Alarm</span>
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
     2. Live Monitoring View (Full Cockpit Dashboard with 4 Safety Systems)
     ------------------------------------------------------------------------- */
  renderMonitoringView() {
    const statusClass = this.getStatusClass();
    const isMuted = soundManager.isMuted;
    const clockStr = formatTimerDisplay(appState.sessionDurationSec);
    const settings = appState.settings;

    return `
      <div class="monitoring-container">
        <h1 class="app-title">Driver Safety Telematics Console</h1>
        <p class="app-instruction">Live multi-system cockpit monitoring for drowsiness, seat belt, phone distraction, and road focus.</p>

        <!-- One Clear Large Unified Status Banner -->
        <div class="status-banner ${statusClass}" id="main-status-banner">
          <span class="status-indicator-dot"></span>
          <span class="status-text" id="status-text">${appState.statusText || 'Starting vision system...'}</span>
        </div>

        <!-- Large Comfortable Camera Preview Wrapper -->
        <div class="camera-preview-wrapper ${appState.activeWarning ? 'alert-flashing' : ''}" id="camera-preview-wrapper">
          <video id="webcam-video" autoplay playsinline muted></video>
          <canvas id="overlay-canvas"></canvas>
          <div class="camera-unavailable-overlay" id="camera-unavailable-overlay" style="display: ${appState.status === 'CAMERA_UNAVAILABLE' ? 'flex' : 'none'};">
            <p><strong>Camera Unavailable</strong></p>
            <p class="error-detail">${appState.cameraError || 'Please allow camera permissions in your browser.'}</p>
          </div>
        </div>

        <!-- 4 PRIMARY SAFETY MONITORING CARDS (Requirement 5) -->
        <div class="safety-cards-grid">
          <!-- Card 1: Drowsiness Detection -->
          <div class="safety-card" id="card-drowsiness">
            <div class="safety-card-header">
              <span class="safety-card-title">${ICONS.eye} Drowsiness</span>
              <span class="safety-indicator indicator-green" id="card-indicator-drowsiness"></span>
            </div>
            <div class="safety-card-status-text" id="card-status-drowsiness">ALERT</div>
            <div class="safety-card-metric" id="card-metric-drowsiness">
              EAR: <span id="card-metric-ear">0.28</span> · Closure: <span id="card-metric-closure">0.00s</span>
            </div>
          </div>

          <!-- Card 2: Seat Belt Detection -->
          <div class="safety-card" id="card-seatbelt">
            <div class="safety-card-header">
              <span class="safety-card-title">${ICONS.seatbelt} Seat Belt</span>
              <span class="safety-indicator indicator-green" id="card-indicator-seatbelt"></span>
            </div>
            <div class="safety-card-status-text" id="card-status-seatbelt">DETECTED</div>
            <div class="safety-card-metric" id="card-metric-seatbelt">
              Fastened · Conf: 85%
            </div>
          </div>

          <!-- Card 3: Mobile Phone Detection -->
          <div class="safety-card" id="card-phone">
            <div class="safety-card-header">
              <span class="safety-card-title">${ICONS.phone} Phone Status</span>
              <span class="safety-indicator indicator-green" id="card-indicator-phone"></span>
            </div>
            <div class="safety-card-status-text" id="card-status-phone">NO PHONE</div>
            <div class="safety-card-metric" id="card-metric-phone">
              Hands-Free · 0.0s
            </div>
          </div>

          <!-- Card 4: Driver Attention Detection -->
          <div class="safety-card" id="card-attention">
            <div class="safety-card-header">
              <span class="safety-card-title">${ICONS.attention} Attention</span>
              <span class="safety-indicator indicator-green" id="card-indicator-attention"></span>
            </div>
            <div class="safety-card-status-text" id="card-status-attention">FOCUSED</div>
            <div class="safety-card-metric" id="card-metric-attention">
              Road Focused · 0.0s / 10s
            </div>
          </div>
        </div>

        <!-- Eye Telemetry Sub-Dashboard (Preserved & Enhanced) -->
        <div class="telemetry-dashboard-grid">
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

          <div class="telemetry-card">
            <div class="telemetry-card-header">
              <span class="telemetry-label">Blink Rate</span>
              <span id="hud-blink-pill" class="blink-live-pill"><span class="blink-dot"></span>LIVE</span>
            </div>
            <div class="telemetry-value-row">
              <span id="hud-blink-count" class="telemetry-metric tabular-nums">0</span>
              <span class="telemetry-subtext">blinks (<span id="hud-blink-rate">0</span>/min)</span>
            </div>
          </div>

          <div class="telemetry-card">
            <div class="telemetry-card-header">
              <span class="telemetry-label">Head Gaze</span>
              <span id="hud-head-pose-tag" class="hud-badge badge-safe">0° / 0°</span>
            </div>
            <div class="telemetry-value-row">
              <span class="telemetry-subtext" id="hud-gaze-desc">Forward Cone</span>
            </div>
          </div>
        </div>

        <!-- Warning Violation History Section (Requirement 5) -->
        <div class="warning-history-section" id="warning-history-section">
          <div class="warning-history-header">
            <span class="warning-history-title">
              ${ICONS.shieldAlert} Safety Violation History
            </span>
            <span class="history-count-badge" id="warning-history-count-badge">
              ${appState.sessionViolations.length} Violations Logged
            </span>
          </div>
          <div class="warning-history-list" id="warning-history-list">
            ${
              appState.sessionViolations.length === 0
                ? `<div style="font-size: 0.8rem; color: var(--text-muted); padding: 0.5rem 0;">No active safety violations detected in this session. Safe driving maintained.</div>`
                : appState.sessionViolations
                    .map(
                      (v) => `
                    <div class="warning-item-row">
                      <div class="warning-item-left">
                        <span class="warning-item-time">${v.timeStr}</span>
                        <span>${v.title}</span>
                      </div>
                      <span class="stage-badge stage-badge-${v.maxStage}">Stage ${v.maxStage}</span>
                    </div>
                  `
                    )
                    .join("")
            }
          </div>
        </div>

        <!-- Monitoring Controls & Telemetrics Bar -->
        <div class="monitoring-bar">
          <div class="session-live-clock">
            <span>Duration:</span>
            <span class="clock-val tabular-nums" id="live-clock-val">${clockStr}</span>
          </div>

          <div class="control-group">
            <button class="control-btn" id="live-settings-btn" title="Safety Settings">
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
     3. Session Summary View (Comprehensive Safety Report)
     ------------------------------------------------------------------------- */
  renderSummaryView() {
    const session = appState.lastSession || {
      durationSeconds: 0,
      drowsinessEventsCount: 0,
      totalViolationsCount: 0,
      violations: [],
      timestamp: Date.now(),
      resultLabel: "No safety violations detected · Full compliance"
    };

    const hasViolations = (session.totalViolationsCount || session.drowsinessEventsCount || 0) > 0;
    const resultClass = hasViolations ? "summary-result-warn" : "summary-result-safe";
    const resultIcon = hasViolations ? ICONS.alertTriangle : ICONS.check;

    return `
      <div class="summary-container">
        <h1 class="app-title">Safety Session Summary</h1>
        <p class="app-instruction">Completed In-Cabin Driver Monitoring Audit Report</p>

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
            <span class="cell-label">Total Safety Violations</span>
            <span class="cell-value" style="color: ${hasViolations ? '#ef4444' : '#10b981'};">
              ${session.totalViolationsCount || session.drowsinessEventsCount || 0}
            </span>
            <span class="cell-subtext">${hasViolations ? 'Violations logged during trip' : 'Full safety compliance'}</span>
          </div>

          <div class="summary-card-cell">
            <span class="cell-label">Completed Timestamp</span>
            <span class="cell-value" style="font-size: 1.15rem;">${formatDateTime(session.timestamp)}</span>
            <span class="cell-subtext">Local telemetry log</span>
          </div>
        </div>

        <!-- Violations Breakdown (if any) -->
        ${
          session.violations && session.violations.length > 0
            ? `
              <div class="warning-history-section" style="width: 100%; margin-bottom: 2rem;">
                <div class="warning-history-header">
                  <span class="warning-history-title">${ICONS.shieldAlert} Session Violation Audit</span>
                </div>
                <div class="warning-history-list">
                  ${session.violations
                    .map(
                      (v) => `
                    <div class="warning-item-row">
                      <div class="warning-item-left">
                        <span class="warning-item-time">${v.timeStr}</span>
                        <span>${v.title}</span>
                      </div>
                      <span class="stage-badge stage-badge-${v.maxStage}">Stage ${v.maxStage}</span>
                    </div>
                  `
                    )
                    .join("")}
                </div>
              </div>
            `
            : ""
        }

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
     4. Session History View
     ------------------------------------------------------------------------- */
  renderHistoryView() {
    const history = appState.getHistory();

    let listHtml = "";
    if (history.length === 0) {
      listHtml = `
        <div class="history-empty-card">
          ${ICONS.history}
          <div class="empty-title">No Previous Sessions</div>
          <p class="empty-desc">Completed safety monitoring trips will automatically be audited and displayed here.</p>
        </div>
      `;
    } else {
      listHtml = `
        <div class="history-list">
          ${history
            .map((item) => {
              const count = item.totalViolationsCount || item.drowsinessEventsCount || 0;
              const isWarn = count > 0;
              const badgeClass = isWarn ? "badge-warn" : "badge-safe";
              return `
                <div class="history-item-card">
                  <div class="history-item-top">
                    <span class="history-date">${formatDateTime(item.timestamp)}</span>
                    <span class="history-result-badge ${badgeClass}">${item.resultLabel}</span>
                  </div>
                  <div class="history-item-metrics">
                    <span class="history-metric">Duration: <strong>${formatDurationText(item.durationSeconds)}</strong></span>
                    <span class="history-metric">Safety violations: <strong style="color: ${isWarn ? '#ef4444' : '#10b981'};">${count}</strong></span>
                    ${item.blinkCount ? `<span class="history-metric">Blinks: <strong>${item.blinkCount}</strong></span>` : ""}
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
        <h1 class="app-title">Session Safety History</h1>
        <p class="app-instruction">Review your past completed safety and drowsiness monitoring trips.</p>

        <div class="history-header-row">
          <span class="history-count-badge">${history.length} ${history.length === 1 ? 'Trip Recorded' : 'Trips Recorded'}</span>
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
     5. Safety Settings & Calibration Modal
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
              <span>Safety Detection Settings & Calibration</span>
            </div>
            <button class="icon-btn" id="modal-close-settings-x" style="height: 32px; padding: 0 0.5rem;">✕</button>
          </div>

          <!-- Section 1: Seat Belt Settings -->
          <div class="settings-section">
            <span class="settings-section-title">${ICONS.seatbelt} Seat Belt Detection</span>
            <div class="setting-row">
              <div class="setting-row-top">
                <span class="setting-name">Unfastened Warning Delay</span>
                <span class="setting-val-tag" id="setting-seatbelt-sec-display">${settings.seatBeltWarningSec.toFixed(1)}s</span>
              </div>
              <p class="setting-desc">Continuous duration seat belt remains unbuckled before triggering Stage 1 Initial Warning.</p>
              <input
                type="range"
                min="2.0"
                max="10.0"
                step="0.5"
                value="${settings.seatBeltWarningSec}"
                class="setting-slider"
                id="setting-seatbelt-slider"
              />
            </div>
          </div>

          <!-- Section 2: Mobile Phone Settings -->
          <div class="settings-section">
            <span class="settings-section-title">${ICONS.phone} Mobile Phone Detection</span>
            <div class="setting-row">
              <div class="setting-row-top">
                <span class="setting-name">Phone Use Warning Delay</span>
                <span class="setting-val-tag" id="setting-phone-sec-display">${settings.phoneWarningSec.toFixed(1)}s</span>
              </div>
              <p class="setting-desc">Continuous duration active phone holding is detected before triggering warning sequence.</p>
              <input
                type="range"
                min="1.0"
                max="8.0"
                step="0.5"
                value="${settings.phoneWarningSec}"
                class="setting-slider"
                id="setting-phone-slider"
              />
            </div>
          </div>

          <!-- Section 3: Driver Attention Settings -->
          <div class="settings-section">
            <span class="settings-section-title">${ICONS.attention} Driver Attention Detection</span>
            <div class="setting-row">
              <div class="setting-row-top">
                <span class="setting-name">Looking Away Threshold</span>
                <span class="setting-val-tag" id="setting-distraction-sec-display">${settings.distractionWarningSec.toFixed(0)}s</span>
              </div>
              <p class="setting-desc">Allowed duration of looking away from the forward road cone before warning sequence initiates (default 10s).</p>
              <input
                type="range"
                min="5.0"
                max="15.0"
                step="1.0"
                value="${settings.distractionWarningSec}"
                class="setting-slider"
                id="setting-distraction-slider"
              />
            </div>
          </div>

          <!-- Section 4: Eye Aspect Ratio & Drowsiness -->
          <div class="settings-section">
            <span class="settings-section-title">${ICONS.eye} Drowsiness & Calibration</span>
            <div class="setting-row">
              <div class="setting-row-top">
                <span class="setting-name">Closure EAR Threshold</span>
                <span class="setting-val-tag" id="setting-ear-val-display">${settings.earThreshold.toFixed(2)}</span>
              </div>
              <p class="setting-desc">Eye Aspect Ratio threshold below which eyes are classified as closed.</p>
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
                <button class="preset-chip ${settings.earThreshold === 0.24 ? 'active' : ''}" data-ear="0.24">Sensitive (0.24)</button>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-row-top">
                <span class="setting-name">Prolonged Closure Trigger</span>
                <span class="setting-val-tag" id="setting-drowsy-sec-display">${settings.drowsinessThresholdSec.toFixed(1)}s</span>
              </div>
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

            <div class="calibration-card-box">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                <button class="btn btn-primary" id="start-calibration-action-btn" style="padding: 0.45rem 0.85rem; font-size: 0.8rem;">
                  ${ICONS.crosshair} Run 3s Eye Calibration
                </button>
                <span id="calibration-feedback-txt" style="font-size: 0.775rem; color: #38bdf8; font-weight: 600;">
                  ${settings.calibratedBaselineEAR ? `Calibrated: EAR ${settings.calibratedBaselineEAR.toFixed(2)}` : 'Standard profile'}
                </span>
              </div>
            </div>
          </div>

          <!-- Section 5: Cooldown -->
          <div class="settings-section">
            <span class="settings-section-title">${ICONS.bell} Cooldown Window</span>
            <div class="setting-row">
              <div class="setting-row-top">
                <span class="setting-name">Alarm Rest Period</span>
                <span class="setting-val-tag" id="setting-cooldown-sec-display">${settings.alarmCooldownSec.toFixed(1)}s</span>
              </div>
              <p class="setting-desc">Cooldown delay after an alarm clears before new warnings re-trigger.</p>
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
          <p class="modal-desc">Are you sure you want to delete all saved safety session records?</p>
          <div class="modal-btn-row">
            <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
            <button class="btn btn-danger" id="modal-confirm-delete-btn">Confirm Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  getStatusClass() {
    const stage = appState.telemetry.warningStage;
    if (stage === 3) return "status-drowsy-red";
    if (stage === 2) return "status-drowsy-red";
    if (stage === 1) return "status-warn";
    if (appState.status === "ALERT") return "status-alert-green";
    if (appState.status === "NO_FACE") return "status-noface-grey";
    if (appState.status === "CAMERA_UNAVAILABLE") return "status-unavailable-grey";
    return "status-noface-grey";
  }

  toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    } catch (e) {}
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
     Updates all 4 safety cards, status indicators, and warning stages directly
     ------------------------------------------------------------------------- */
  updateTelemetryUI(telemetry) {
    if (!appState.isMonitoring) return;

    // 1. Drowsiness Card
    const cardDrowsy = document.getElementById("card-drowsiness");
    const indDrowsy = document.getElementById("card-indicator-drowsiness");
    const statDrowsy = document.getElementById("card-status-drowsiness");
    const earMetric = document.getElementById("card-metric-ear");
    const closureMetric = document.getElementById("card-metric-closure");

    if (cardDrowsy && indDrowsy && statDrowsy) {
      const risk = telemetry.drowsinessRisk;
      if (risk === "HIGH_RISK") {
        indDrowsy.className = "safety-indicator indicator-red";
        statDrowsy.textContent = "DROWSY / MICROSLEEP";
        statDrowsy.style.color = "#ef4444";
        cardDrowsy.className = "safety-card card-violation";
      } else if (risk === "WARNING") {
        indDrowsy.className = "safety-indicator indicator-yellow";
        statDrowsy.textContent = "EYES CLOSING";
        statDrowsy.style.color = "#f59e0b";
        cardDrowsy.className = "safety-card card-uncertain";
      } else {
        indDrowsy.className = "safety-indicator indicator-green";
        statDrowsy.textContent = telemetry.faceDetected ? "ALERT" : "SEARCHING";
        statDrowsy.style.color = "var(--text-primary)";
        cardDrowsy.className = "safety-card";
      }
      if (earMetric) earMetric.textContent = telemetry.avgEAR.toFixed(2);
      if (closureMetric) closureMetric.textContent = `${telemetry.closureDurationSec.toFixed(2)}s`;
    }

    // 2. Seat Belt Card
    const cardSeatbelt = document.getElementById("card-seatbelt");
    const indSeatbelt = document.getElementById("card-indicator-seatbelt");
    const statSeatbelt = document.getElementById("card-status-seatbelt");
    const metricSeatbelt = document.getElementById("card-metric-seatbelt");

    if (cardSeatbelt && indSeatbelt && statSeatbelt) {
      const s = telemetry.seatBeltStatus;
      if (s === "DETECTED") {
        indSeatbelt.className = "safety-indicator indicator-green";
        statSeatbelt.textContent = "FASTENED";
        statSeatbelt.style.color = "#10b981";
        cardSeatbelt.className = "safety-card";
        if (metricSeatbelt) metricSeatbelt.textContent = `Fastened · Conf: ${telemetry.seatBeltConfidence}%`;
      } else if (s === "DETECTION UNCERTAIN") {
        indSeatbelt.className = "safety-indicator indicator-yellow";
        statSeatbelt.textContent = "UNCERTAIN";
        statSeatbelt.style.color = "#f59e0b";
        cardSeatbelt.className = "safety-card card-uncertain";
        if (metricSeatbelt) metricSeatbelt.textContent = telemetry.seatBeltReason;
      } else {
        indSeatbelt.className = "safety-indicator indicator-red";
        statSeatbelt.textContent = "NOT FASTENED";
        statSeatbelt.style.color = "#ef4444";
        cardSeatbelt.className = "safety-card card-violation";
        if (metricSeatbelt) metricSeatbelt.textContent = `Unfastened: ${telemetry.seatBeltUnwornSec.toFixed(1)}s / ${appState.settings.seatBeltWarningSec.toFixed(0)}s`;
      }
    }

    // 3. Mobile Phone Card
    const cardPhone = document.getElementById("card-phone");
    const indPhone = document.getElementById("card-indicator-phone");
    const statPhone = document.getElementById("card-status-phone");
    const metricPhone = document.getElementById("card-metric-phone");

    if (cardPhone && indPhone && statPhone) {
      const p = telemetry.phoneStatus;
      if (p === "PHONE DETECTED") {
        indPhone.className = "safety-indicator indicator-red";
        statPhone.textContent = "PHONE IN USE";
        statPhone.style.color = "#ef4444";
        cardPhone.className = "safety-card card-violation";
        if (metricPhone) metricPhone.textContent = `Active Use: ${telemetry.phoneUsageSec.toFixed(1)}s / ${appState.settings.phoneWarningSec.toFixed(0)}s`;
      } else if (p === "POSSIBLE PHONE USE") {
        indPhone.className = "safety-indicator indicator-yellow";
        statPhone.textContent = "POSSIBLE USE";
        statPhone.style.color = "#f59e0b";
        cardPhone.className = "safety-card card-uncertain";
        if (metricPhone) metricPhone.textContent = `Possible Device (${telemetry.phoneConfidence}%)`;
      } else {
        indPhone.className = "safety-indicator indicator-green";
        statPhone.textContent = "HANDS-FREE";
        statPhone.style.color = "#10b981";
        cardPhone.className = "safety-card";
        if (metricPhone) metricPhone.textContent = "Hands-Free · No Device";
      }
    }

    // 4. Driver Attention Card
    const cardAttn = document.getElementById("card-attention");
    const indAttn = document.getElementById("card-indicator-attention");
    const statAttn = document.getElementById("card-status-attention");
    const metricAttn = document.getElementById("card-metric-attention");

    if (cardAttn && indAttn && statAttn) {
      const a = telemetry.attentionStatus;
      if (a === "DISTRACTED") {
        const isViol = telemetry.distractedSec >= appState.settings.distractionWarningSec;
        indAttn.className = `safety-indicator ${isViol ? "indicator-red" : "indicator-yellow"}`;
        statAttn.textContent = isViol ? "DISTRACTED" : "GAZE AWAY";
        statAttn.style.color = isViol ? "#ef4444" : "#f59e0b";
        cardAttn.className = `safety-card ${isViol ? "card-violation" : "card-uncertain"}`;
        if (metricAttn) metricAttn.textContent = `Away: ${telemetry.distractedSec.toFixed(1)}s / ${appState.settings.distractionWarningSec.toFixed(0)}s (Yaw ${telemetry.headYaw}°)`;
      } else if (a === "FOCUSED") {
        indAttn.className = "safety-indicator indicator-green";
        statAttn.textContent = "ROAD FOCUSED";
        statAttn.style.color = "#10b981";
        cardAttn.className = "safety-card";
        if (metricAttn) metricAttn.textContent = `Forward View (Yaw ${telemetry.headYaw}°, Pitch ${telemetry.headPitch}°)`;
      } else {
        indAttn.className = "safety-indicator indicator-yellow";
        statAttn.textContent = a === "FACE NOT DETECTED" ? "NO FACE" : "UNCERTAIN";
        statAttn.style.color = "#f59e0b";
        cardAttn.className = "safety-card card-uncertain";
        if (metricAttn) metricAttn.textContent = telemetry.attentionReason;
      }
    }

    // Eye Sub-Dashboard
    const leftStateEl = document.getElementById("hud-left-state");
    const leftEarEl = document.getElementById("hud-left-ear");
    if (leftStateEl) {
      leftStateEl.textContent = telemetry.leftEyeState;
      leftStateEl.className = `hud-badge badge-eye-${telemetry.leftEyeState.toLowerCase()}`;
    }
    if (leftEarEl) leftEarEl.textContent = telemetry.leftEAR.toFixed(2);

    const rightStateEl = document.getElementById("hud-right-state");
    const rightEarEl = document.getElementById("hud-right-ear");
    if (rightStateEl) {
      rightStateEl.textContent = telemetry.rightEyeState;
      rightStateEl.className = `hud-badge badge-eye-${telemetry.rightEyeState.toLowerCase()}`;
    }
    if (rightEarEl) rightEarEl.textContent = telemetry.rightEAR.toFixed(2);

    const blinkPill = document.getElementById("hud-blink-pill");
    const blinkCountEl = document.getElementById("hud-blink-count");
    const blinkRateEl = document.getElementById("hud-blink-rate");
    if (blinkPill) {
      if (telemetry.isBlinkingLive) blinkPill.classList.add("blink-flash");
      else blinkPill.classList.remove("blink-flash");
    }
    if (blinkCountEl) blinkCountEl.textContent = telemetry.blinkCount;
    if (blinkRateEl) blinkRateEl.textContent = telemetry.blinkRate;

    const headPoseTag = document.getElementById("hud-head-pose-tag");
    const gazeDesc = document.getElementById("hud-gaze-desc");
    if (headPoseTag) {
      headPoseTag.textContent = `${telemetry.headYaw}° / ${telemetry.headPitch}°`;
      headPoseTag.className = `hud-badge ${Math.abs(telemetry.headYaw) > 22 ? 'badge-warn' : 'badge-safe'}`;
    }
    if (gazeDesc) {
      gazeDesc.textContent = Math.abs(telemetry.headYaw) > 22 ? "Looking Sideways" : "Forward Road View";
    }

    // Three-Stage Warning System Visual Sync
    const stage = telemetry.warningStage;
    const banner = document.getElementById("main-status-banner");
    const bannerText = document.getElementById("status-text");
    const previewWrapper = document.getElementById("camera-preview-wrapper");
    const appContainer = document.getElementById("app-container");
    const emergencyContainer = document.getElementById("emergency-overlay-container");

    // Stage 1: Flash indicator red 3 times
    if (banner && bannerText) {
      if (stage === 1) {
        banner.className = "status-banner status-drowsy-red stage-1-flash";
        bannerText.textContent = telemetry.warningMessage || "Stage 1 Initial Warning";
      } else if (stage === 2) {
        banner.className = "status-banner status-drowsy-red";
        bannerText.textContent = telemetry.warningMessage || "Stage 2 Critical Warning";
      } else if (stage === 3) {
        banner.className = "status-banner status-drowsy-red";
        bannerText.textContent = telemetry.warningMessage || "Stage 3 Emergency Alarm";
      } else {
        banner.className = `status-banner ${this.getStatusClass()}`;
        bannerText.textContent = appState.statusText || "All safety checks normal.";
      }
    }

    // Stage 2: Flash entire screen red
    if (appContainer) {
      if (stage === 2) {
        appContainer.classList.add("critical-screen-flash");
      } else {
        appContainer.classList.remove("critical-screen-flash");
      }
    }

    if (previewWrapper) {
      if (stage >= 2 || appState.activeWarning) {
        previewWrapper.classList.add("alert-flashing");
      } else {
        previewWrapper.classList.remove("alert-flashing");
      }
    }

    // Stage 3: Full-screen Emergency Warning Modal
    if (emergencyContainer) {
      if (stage === 3) {
        if (!document.getElementById("emergency-modal-box")) {
          emergencyContainer.innerHTML = `
            <div class="emergency-fullscreen-overlay" id="emergency-modal-box">
              <div class="emergency-box">
                <div class="emergency-icon-wrap">
                  ${ICONS.alertTriangle}
                </div>
                <div class="emergency-title">EMERGENCY ALARM ACTIVATED</div>
                <div class="emergency-desc">${telemetry.warningMessage || "CRITICAL SAFETY VIOLATION DETECTED"}</div>
                <div style="font-size: 0.85rem; color: #ef4444; font-weight: 700; letter-spacing: 0.05em;">
                  SIREN ENGAGED · CORRECT VIOLATION IMMEDIATELY
                </div>
              </div>
            </div>
          `;
        }
      } else {
        emergencyContainer.innerHTML = "";
      }
    }

    // Update Warning History List live
    const historyBadge = document.getElementById("warning-history-count-badge");
    const historyList = document.getElementById("warning-history-list");
    if (historyBadge) {
      historyBadge.textContent = `${appState.sessionViolations.length} Violations Logged`;
    }
    if (historyList && appState.sessionViolations.length > 0) {
      historyList.innerHTML = appState.sessionViolations
        .slice(0, 10)
        .map(
          (v) => `
          <div class="warning-item-row">
            <div class="warning-item-left">
              <span class="warning-item-time">${v.timeStr}</span>
              <span>${v.title}</span>
            </div>
            <span class="stage-badge stage-badge-${v.maxStage}">Stage ${v.maxStage}</span>
          </div>
        `
        )
        .join("");
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
    const fsBtn = document.getElementById("fullscreen-toggle-btn");
    if (fsBtn) fsBtn.onclick = () => this.toggleFullscreen();

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

    const headerSettingsBtn = document.getElementById("header-settings-btn");
    if (headerSettingsBtn) {
      headerSettingsBtn.onclick = () => {
        this.showSettingsModal = true;
        this.render();
      };
    }

    const openCalibBtn = document.getElementById("open-calibration-btn");
    if (openCalibBtn) {
      openCalibBtn.onclick = () => {
        this.showSettingsModal = true;
        this.render();
      };
    }

    const liveSettingsBtn = document.getElementById("live-settings-btn");
    if (liveSettingsBtn) {
      liveSettingsBtn.onclick = () => {
        this.showSettingsModal = true;
        this.render();
      };
    }

    const headerHistBtn = document.getElementById("header-history-btn");
    if (headerHistBtn) {
      headerHistBtn.onclick = () => appState.setView("history");
    }

    const startBtn = document.getElementById("start-monitoring-btn");
    if (startBtn) startBtn.onclick = () => this.startMonitoringFlow();

    const startNewBtn = document.getElementById("start-new-session-btn");
    if (startNewBtn) startNewBtn.onclick = () => this.startMonitoringFlow();

    const viewHistBtn = document.getElementById("view-history-btn");
    if (viewHistBtn) viewHistBtn.onclick = () => appState.setView("history");

    const stopBtn = document.getElementById("stop-monitoring-btn");
    if (stopBtn) stopBtn.onclick = () => this.stopMonitoringFlow();

    const histBackBtn = document.getElementById("history-back-btn");
    if (histBackBtn) {
      histBackBtn.onclick = () => {
        const targetView = appState.previousView === "summary" ? "summary" : "main";
        appState.setView(targetView);
      };
    }

    const clearHistBtn = document.getElementById("clear-history-trigger-btn");
    if (clearHistBtn) {
      clearHistBtn.onclick = () => {
        this.showDeleteModal = true;
        this.render();
      };
    }

    const modalCancelBtn = document.getElementById("modal-cancel-btn");
    if (modalCancelBtn) {
      modalCancelBtn.onclick = () => {
        this.showDeleteModal = false;
        this.render();
      };
    }

    const deleteBackdrop = document.getElementById("delete-modal-backdrop");
    if (deleteBackdrop) {
      deleteBackdrop.onclick = (e) => {
        if (e.target === deleteBackdrop) {
          this.showDeleteModal = false;
          this.render();
        }
      };
    }

    const modalConfirmBtn = document.getElementById("modal-confirm-delete-btn");
    if (modalConfirmBtn) {
      modalConfirmBtn.onclick = () => {
        appState.clearHistory();
        this.showDeleteModal = false;
        this.render();
      };
    }

    const muteBtn = document.getElementById("mute-toggle-btn");
    if (muteBtn) {
      muteBtn.onclick = () => {
        soundManager.toggleMute();
        this.render();
      };
    }

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

    const testSoundBtn = document.getElementById("test-sound-btn");
    if (testSoundBtn) testSoundBtn.onclick = () => soundManager.testAlertSound();

    const liveTestSoundBtn = document.getElementById("live-test-sound-btn");
    if (liveTestSoundBtn) liveTestSoundBtn.onclick = () => soundManager.testAlertSound();

    const volSlider = document.getElementById("volume-slider");
    const volValDisplay = document.getElementById("volume-val-display");
    if (volSlider && volValDisplay) {
      volSlider.oninput = (e) => {
        const val = parseInt(e.target.value, 10);
        soundManager.setVolume(val);
        volValDisplay.textContent = `${val}%`;
      };
    }

    this.bindSettingsEvents();
  }

  bindSettingsEvents() {
    if (!this.showSettingsModal) return;

    const closeX = document.getElementById("modal-close-settings-x");
    const closeDone = document.getElementById("modal-close-settings-btn");
    const closeHandler = () => {
      this.showSettingsModal = false;
      this.render();
    };
    if (closeX) closeX.onclick = closeHandler;
    if (closeDone) closeDone.onclick = closeHandler;

    const backdrop = document.getElementById("settings-modal-backdrop");
    if (backdrop) {
      backdrop.onclick = (e) => {
        if (e.target === backdrop) closeHandler();
      };
    }

    // Seat belt slider
    const seatbeltSlider = document.getElementById("setting-seatbelt-slider");
    const seatbeltDisplay = document.getElementById("setting-seatbelt-sec-display");
    if (seatbeltSlider && seatbeltDisplay) {
      seatbeltSlider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        appState.saveSettings({ seatBeltWarningSec: val });
        seatbeltDisplay.textContent = `${val.toFixed(1)}s`;
      };
    }

    // Phone slider
    const phoneSlider = document.getElementById("setting-phone-slider");
    const phoneDisplay = document.getElementById("setting-phone-sec-display");
    if (phoneSlider && phoneDisplay) {
      phoneSlider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        appState.saveSettings({ phoneWarningSec: val });
        phoneDisplay.textContent = `${val.toFixed(1)}s`;
      };
    }

    // Distraction slider (default 10s)
    const distSlider = document.getElementById("setting-distraction-slider");
    const distDisplay = document.getElementById("setting-distraction-sec-display");
    if (distSlider && distDisplay) {
      distSlider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        appState.saveSettings({ distractionWarningSec: val });
        distDisplay.textContent = `${val.toFixed(0)}s`;
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

    // Drowsiness Slider
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
          const feedback = document.getElementById("calibration-feedback-txt");
          if (feedback) {
            feedback.textContent = "Start monitoring first to calibrate.";
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
