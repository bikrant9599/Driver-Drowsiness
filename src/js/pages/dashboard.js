/* ==========================================================================
   VIEW: DASHBOARD
   ========================================================================== */

import { ICONS, formatDuration, formatDateTime, showToast } from "../utils.js";
import { appState } from "../state.js";
import { soundManager } from "../audio.js";
import { visionEngine } from "../vision.js";

let dashboardUpdateInterval = null;

function getDashStatusClass(status) {
  if (status === "ALERT" || status === "CAMERA ERROR") return "state-danger";
  if (status === "POSSIBLE DROWSINESS" || status === "FACE NOT DETECTED") return "state-warn";
  if (status === "ATTENTIVE") return "state-safe";
  return "";
}

function getDashBadgeClass(status) {
  if (status === "ALERT" || status === "CAMERA ERROR") return "badge-danger";
  if (status === "POSSIBLE DROWSINESS" || status === "FACE NOT DETECTED") return "badge-warn";
  if (status === "ATTENTIVE") return "badge-safe";
  return "badge-neutral";
}

export function renderDashboardPage() {
  const container = document.createElement("div");
  container.className = "dashboard-container fade-in";

  const isLive = appState.isMonitoring;
  const driverStatus = appState.driverStatus;
  const statusColorClass = getDashStatusClass(driverStatus);
  const statusBadgeClass = getDashBadgeClass(driverStatus);

  container.innerHTML = `
    <!-- Top Telematics Control Bar -->
    <div class="telematics-control-bar">
      <div class="system-status-indicator">
        <div class="system-status-orb ${isLive ? (driverStatus === 'ALERT' ? 'drowsy' : 'active') : 'idle'}" id="dash-status-orb"></div>
        <div class="system-status-text">
          <h3 id="dash-system-title">${isLive ? (appState.monitoringMode === 'sample' ? 'Benchmark Simulation Active' : 'Real-Time Camera AI Active') : 'Driver Monitoring System Standby'}</h3>
          <p id="dash-system-desc">${isLive ? 'Continuous biometric telemetry running' : 'System calibrated and ready to engage'}</p>
        </div>
      </div>

      <div class="telematics-actions" id="dash-actions-group">
        ${
          isLive
            ? `<button class="btn btn-outline-danger" id="dash-stop-btn">
                ${ICONS.stop} Stop Monitoring
               </button>`
            : `<button class="btn btn-primary" id="dash-start-live-btn">
                ${ICONS.camera} Start Live Camera
               </button>
               <button class="btn btn-secondary" id="dash-start-demo-btn">
                ${ICONS.play} Run Benchmark Simulation
               </button>`
        }
        <button class="btn btn-secondary btn-icon" id="dash-test-alarm-btn" title="Test Alarm Tone">
          ${ICONS.volume2}
        </button>
      </div>
    </div>

    <!-- 4 Telematics Metric Tiles -->
    <div class="metric-grid">
      <!-- Camera Status Tile -->
      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Camera Sensor</span>
          <div class="metric-tile-icon">${ICONS.camera}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value" id="dash-camera-stat">${appState.cameraConnected ? 'ONLINE' : driverStatus === 'CAMERA ERROR' ? 'ERROR' : 'STANDBY'}</span>
        </div>
        <div class="metric-tile-footer">
          <span id="dash-camera-mode">Mode: ${appState.monitoringMode === 'sample' ? 'Sample Preview' : 'Hardware Stream'}</span>
          <span class="badge ${appState.cameraConnected ? 'badge-safe' : driverStatus === 'CAMERA ERROR' ? 'badge-danger' : 'badge-neutral'}" id="dash-camera-badge">
            <span class="badge-dot"></span> <span id="dash-camera-badge-text">${appState.cameraConnected ? 'Connected' : driverStatus === 'CAMERA ERROR' ? 'Error' : 'Offline'}</span>
          </span>
        </div>
      </div>

      <!-- Driver Attentiveness Status Tile -->
      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Driver Status</span>
          <div class="metric-tile-icon">${ICONS.user}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value ${statusColorClass}" id="dash-driver-stat">${driverStatus}</span>
        </div>
        <div class="metric-tile-footer">
          <span>Face: <strong id="dash-face-stat">${appState.faceDetected ? 'Detected' : isLive ? 'Searching' : 'Offline'}</strong></span>
          <span class="badge ${statusBadgeClass}" id="dash-driver-badge">
            <span class="badge-dot"></span> <span id="dash-driver-badge-text">${driverStatus === 'ALERT' ? 'CRITICAL' : driverStatus === 'POSSIBLE DROWSINESS' ? 'WARNING' : driverStatus === 'ATTENTIVE' ? 'NORMAL' : 'STANDBY'}</span>
          </span>
        </div>
      </div>

      <!-- Warning Events Counter Tile -->
      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Drowsiness Events</span>
          <div class="metric-tile-icon">${ICONS.alertTriangle}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value tabular-nums" id="dash-warnings-count">${appState.sessionWarningsCount}</span>
          <span class="metric-tile-unit">alerts</span>
        </div>
        <div class="metric-tile-footer">
          <span>Current Session Events</span>
          <span class="badge ${appState.sessionWarningsCount > 0 ? 'badge-danger' : 'badge-safe'}" id="dash-warnings-badge">
            ${appState.sessionWarningsCount > 0 ? 'Attention Needed' : 'Safe Zero'}
          </span>
        </div>
      </div>

      <!-- Monitoring Duration Tile -->
      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Session Duration</span>
          <div class="metric-tile-icon">${ICONS.dashboard}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value tabular-nums" id="dash-duration-timer">${formatDuration(appState.sessionDurationSec)}</span>
        </div>
        <div class="metric-tile-footer">
          <span>Active Telematics Clock</span>
          <span class="badge ${isLive ? 'badge-info' : 'badge-neutral'}" id="dash-duration-badge">
            ${isLive ? 'Tracking' : 'Stopped'}
          </span>
        </div>
      </div>
    </div>

    <!-- Main Telematics Grid -->
    <div class="telematics-grid">
      <!-- Left: Biometric Details Card -->
      <div class="card driver-status-hero">
        <div class="card-header">
          <div class="card-title">
            ${ICONS.eye} Driver Biometric Telemetry
          </div>
          <span class="badge badge-info" id="dash-mode-badge">
            ${appState.monitoringMode === 'sample' ? 'Sample Benchmark' : 'Live Computer Vision'}
          </span>
        </div>

        <div class="hero-status-display">
          <div class="hero-status-info">
            <span class="status-label-small">Real-Time Vigilance Assessment</span>
            <div class="status-state-large ${statusColorClass}" id="dash-large-status">
              ${
                driverStatus === 'ALERT'
                  ? 'PROLONGED EYE CLOSURE DETECTED'
                  : driverStatus === 'POSSIBLE DROWSINESS'
                  ? 'POSSIBLE DROWSINESS WARNING'
                  : driverStatus === 'FACE NOT DETECTED'
                  ? 'DRIVER FACE NOT DETECTED'
                  : driverStatus === 'CAMERA ERROR'
                  ? 'CAMERA SENSOR ERROR'
                  : isLive
                  ? 'ATTENTIVE & VIGILANT'
                  : 'MONITORING STANDBY'
              }
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary);" id="dash-status-desc">
              ${
                driverStatus === 'ALERT'
                  ? 'Immediate high-frequency audible alarm active. Driver wake up required!'
                  : driverStatus === 'POSSIBLE DROWSINESS'
                  ? 'Eye closure duration elevated. Prepare to pull over if fatigued.'
                  : driverStatus === 'FACE NOT DETECTED'
                  ? 'Please center driver face within camera field of view.'
                  : driverStatus === 'CAMERA ERROR'
                  ? 'Webcam permission denied or camera device unavailable.'
                  : isLive
                  ? 'Eye aspect ratio within nominal attentive safety thresholds.'
                  : 'Click Start Live Camera to initiate AI computer vision tracking.'
              }
            </p>
          </div>
        </div>

        <!-- Telematics Meters -->
        <div class="telematics-bars">
          <div class="meter-row">
            <div class="meter-header">
              <span>Eye Aspect Ratio (EAR)</span>
              <span id="dash-ear-val">${appState.currentEar.toFixed(2)} (Safe &gt; ${appState.settings.earThreshold.toFixed(2)})</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill fill-blue" id="dash-ear-bar" style="width: ${Math.min(100, (appState.currentEar / 0.4) * 100)}%;"></div>
            </div>
          </div>

          <div class="meter-row">
            <div class="meter-header">
              <span>Eye Closure Timer</span>
              <span id="dash-closure-val">${appState.closureSeconds.toFixed(1)}s / Max ${appState.settings.drowsinessDurationSec.toFixed(1)}s</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill fill-red" id="dash-closure-bar" style="width: ${Math.min(100, (appState.closureSeconds / appState.settings.drowsinessDurationSec) * 100)}%;"></div>
            </div>
          </div>

          <div class="meter-row">
            <div class="meter-header">
              <span>Eye Landmark Status</span>
              <span id="dash-symmetry-val">L: ${appState.leftEar.toFixed(2)} | R: ${appState.rightEar.toFixed(2)} | Eyes: ${appState.eyeState}</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill fill-green" id="dash-symmetry-bar" style="width: ${Math.min(100, (appState.leftEar / 0.4) * 100)}%;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: System Safety Card -->
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div class="card-header">
            <div class="card-title">
              ${ICONS.shieldCheck} Safety Parameters
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 1rem; font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Closure Trigger Threshold</span>
              <strong class="tabular-nums">${appState.settings.drowsinessDurationSec.toFixed(1)} seconds</strong>
            </div>

            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">EAR Sensitivity Threshold</span>
              <strong class="tabular-nums">${appState.settings.earThreshold.toFixed(2)}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Alarm Tone Profile</span>
              <strong style="text-transform: capitalize;">${appState.settings.alarmSound}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Voice Alert</span>
              <strong>${appState.settings.speechAlert ? 'Enabled' : 'Disabled'}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Audio Volume</span>
              <strong class="tabular-nums">${appState.settings.volume}%</strong>
            </div>
          </div>
        </div>

        <div style="margin-top: 1.5rem;">
          <button class="btn btn-secondary" style="width: 100%;" id="dash-open-settings-btn">
            ${ICONS.settings} Modify System Settings
          </button>
        </div>
      </div>
    </div>

    <!-- Recent Warning Events Table -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          ${ICONS.alertTriangle} Recent Warning Events Log
        </div>
        <button class="btn btn-secondary btn-sm" id="dash-view-all-reports-btn">
          ${ICONS.reports} View All Reports
        </button>
      </div>

      <div class="events-table-wrapper">
        <table class="events-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Incident Type</th>
              <th>Closure Duration</th>
              <th>Detected EAR</th>
              <th>Severity</th>
              <th>Origin</th>
            </tr>
          </thead>
          <tbody id="dash-events-tbody">
            ${renderRecentEventsRows()}
          </tbody>
        </table>
      </div>
    </div>
  `;

  function renderRecentEventsRows() {
    if (appState.recentEvents.length === 0) {
      return `<tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No drowsiness warning events recorded in this session. Driver vigilance is normal.
        </td>
      </tr>`;
    }
    return appState.recentEvents
      .slice(0, 5)
      .map(
        (ev) => `
        <tr>
          <td class="tabular-nums">${ev.timestamp}</td>
          <td><strong>${ev.type === 'ALERT' ? 'Prolonged Eye Closure' : ev.type.replace('_', ' ')}</strong></td>
          <td class="tabular-nums">${ev.duration}</td>
          <td class="tabular-nums">${ev.ear}</td>
          <td>
            <span class="badge ${ev.severity === 'Critical' ? 'badge-danger' : 'badge-warn'}">
              ${ev.severity}
            </span>
          </td>
          <td>
            <span class="badge ${ev.isSample ? 'badge-neutral' : 'badge-info'}">
              ${ev.isSample ? 'Sample Benchmark' : 'Live Sensor'}
            </span>
          </td>
        </tr>
      `
      )
      .join("");
  }

  // Periodic Telematics Dashboard Refresh
  if (dashboardUpdateInterval) clearInterval(dashboardUpdateInterval);
  dashboardUpdateInterval = setInterval(() => {
    if (!container || !container.isConnected) {
      clearInterval(dashboardUpdateInterval);
      dashboardUpdateInterval = null;
      return;
    }

    const curStatus = appState.driverStatus;
    const curIsLive = appState.isMonitoring;

    // Status orb
    const orb = container.querySelector("#dash-status-orb");
    if (orb) {
      orb.className = `system-status-orb ${curIsLive ? (curStatus === 'ALERT' ? 'drowsy' : 'active') : 'idle'}`;
    }

    // Camera stat
    const camStat = container.querySelector("#dash-camera-stat");
    if (camStat) {
      camStat.textContent = appState.cameraConnected ? "ONLINE" : curStatus === "CAMERA ERROR" ? "ERROR" : "STANDBY";
    }

    // Driver stat
    const driverStat = container.querySelector("#dash-driver-stat");
    if (driverStat) {
      driverStat.textContent = curStatus;
      driverStat.className = `metric-tile-value ${getDashStatusClass(curStatus)}`;
    }

    const faceStat = container.querySelector("#dash-face-stat");
    if (faceStat) {
      faceStat.textContent = appState.faceDetected ? "Detected" : curIsLive ? "Searching" : "Offline";
    }

    // Warnings & duration
    const warnCount = container.querySelector("#dash-warnings-count");
    if (warnCount) warnCount.textContent = appState.sessionWarningsCount;

    const durTimer = container.querySelector("#dash-duration-timer");
    if (durTimer) durTimer.textContent = formatDuration(appState.sessionDurationSec);

    // Hero large status
    const largeStatus = container.querySelector("#dash-large-status");
    if (largeStatus) {
      largeStatus.className = `status-state-large ${getDashStatusClass(curStatus)}`;
      largeStatus.textContent =
        curStatus === "ALERT"
          ? "PROLONGED EYE CLOSURE DETECTED"
          : curStatus === "POSSIBLE DROWSINESS"
          ? "POSSIBLE DROWSINESS WARNING"
          : curStatus === "FACE NOT DETECTED"
          ? "DRIVER FACE NOT DETECTED"
          : curStatus === "CAMERA ERROR"
          ? "CAMERA SENSOR ERROR"
          : curIsLive
          ? "ATTENTIVE & VIGILANT"
          : "MONITORING STANDBY";
    }

    // Meters
    const earVal = container.querySelector("#dash-ear-val");
    if (earVal) earVal.textContent = `${appState.currentEar.toFixed(2)} (Safe > ${appState.settings.earThreshold.toFixed(2)})`;

    const earBar = container.querySelector("#dash-ear-bar");
    if (earBar) earBar.style.width = `${Math.min(100, (appState.currentEar / 0.4) * 100)}%`;

    const closureVal = container.querySelector("#dash-closure-val");
    if (closureVal) closureVal.textContent = `${appState.closureSeconds.toFixed(1)}s / Max ${appState.settings.drowsinessDurationSec.toFixed(1)}s`;

    const closureBar = container.querySelector("#dash-closure-bar");
    if (closureBar) closureBar.style.width = `${Math.min(100, (appState.closureSeconds / appState.settings.drowsinessDurationSec) * 100)}%`;

    const symVal = container.querySelector("#dash-symmetry-val");
    if (symVal) symVal.textContent = `L: ${appState.leftEar.toFixed(2)} | R: ${appState.rightEar.toFixed(2)} | Eyes: ${appState.eyeState}`;

    const symBar = container.querySelector("#dash-symmetry-bar");
    if (symBar) symBar.style.width = `${Math.min(100, (appState.leftEar / 0.4) * 100)}%`;

    // Events table
    const tbody = container.querySelector("#dash-events-tbody");
    if (tbody) tbody.innerHTML = renderRecentEventsRows();
  }, 100);

  // Button handlers
  const startLiveBtn = container.querySelector("#dash-start-live-btn");
  if (startLiveBtn) {
    startLiveBtn.addEventListener("click", () => {
      appState.startSession("real");
      appState.setPage("live");
    });
  }

  const startDemoBtn = container.querySelector("#dash-start-demo-btn");
  if (startDemoBtn) {
    startDemoBtn.addEventListener("click", () => {
      appState.startSession("sample");
      appState.setPage("live");
    });
  }

  const stopBtn = container.querySelector("#dash-stop-btn");
  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      visionEngine.stopCamera();
      appState.stopSession();
      showToast("Session Saved", "Monitoring session ended and saved.", "safe");
      appState.setPage("dashboard");
    });
  }

  const testAlarmBtn = container.querySelector("#dash-test-alarm-btn");
  if (testAlarmBtn) {
    testAlarmBtn.addEventListener("click", () => {
      soundManager.testAlarm();
      showToast("Alarm Test", `Sounding ${appState.settings.alarmSound} tone alert.`, "info");
    });
  }

  container.querySelector("#dash-open-settings-btn").addEventListener("click", () => {
    appState.setPage("settings");
  });

  container.querySelector("#dash-view-all-reports-btn").addEventListener("click", () => {
    appState.setPage("reports");
  });

  return container;
}
