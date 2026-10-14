/* ==========================================================================
   VIEW: DASHBOARD
   ========================================================================== */

import { ICONS, formatDuration, formatDateTime } from "../utils.js";
import { appState } from "../state.js";
import { soundManager } from "../audio.js";

export function renderDashboardPage() {
  const container = document.createElement("div");
  container.className = "dashboard-container fade-in";

  const isLive = appState.isMonitoring;
  const driverStatus = appState.driverStatus;
  const statusColorClass =
    driverStatus === "DROWSY_ALERT"
      ? "state-danger"
      : driverStatus === "MINOR_FATIGUE"
      ? "state-warn"
      : "state-safe";

  container.innerHTML = `
    <!-- Top Telematics Control Bar -->
    <div class="telematics-control-bar">
      <div class="system-status-indicator">
        <div class="system-status-orb ${isLive ? (driverStatus === 'DROWSY_ALERT' ? 'drowsy' : 'active') : 'idle'}"></div>
        <div class="system-status-text">
          <h3>${isLive ? (appState.monitoringMode === 'sample' ? 'Benchmark Simulation Active' : 'Real-time Camera DMS Active') : 'Driver Monitoring System Standby'}</h3>
          <p>${isLive ? 'Continuous biometric telemetry running' : 'System calibrated and ready to engage'}</p>
        </div>
      </div>

      <div class="telematics-actions">
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
          <span class="metric-tile-label">Camera Feed</span>
          <div class="metric-tile-icon">${ICONS.camera}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value" id="dash-camera-stat">${appState.cameraConnected ? 'ONLINE' : 'STANDBY'}</span>
        </div>
        <div class="metric-tile-footer">
          <span>Mode: ${appState.monitoringMode === 'sample' ? 'Sample Preview' : 'Hardware Stream'}</span>
          <span class="badge ${appState.cameraConnected ? 'badge-safe' : 'badge-neutral'}">
            <span class="badge-dot"></span> ${appState.cameraConnected ? 'Connected' : 'Offline'}
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
          <span class="metric-tile-value ${statusColorClass}" id="dash-driver-stat">${driverStatus.replace('_', ' ')}</span>
        </div>
        <div class="metric-tile-footer">
          <span>Face: <strong id="dash-face-stat">${appState.faceDetected ? 'Detected' : 'Searching'}</strong></span>
          <span class="badge ${driverStatus === 'DROWSY_ALERT' ? 'badge-danger' : driverStatus === 'MINOR_FATIGUE' ? 'badge-warn' : 'badge-safe'}">
            <span class="badge-dot"></span> ${driverStatus === 'DROWSY_ALERT' ? 'CRITICAL' : 'NORMAL'}
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
          <span class="badge ${appState.sessionWarningsCount > 0 ? 'badge-danger' : 'badge-safe'}">
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
          <span class="badge ${isLive ? 'badge-info' : 'badge-neutral'}">
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
              ${driverStatus === 'DROWSY_ALERT' ? 'PROLONGED EYE CLOSURE DETECTED' : driverStatus === 'MINOR_FATIGUE' ? 'EARLY FATIGUE DETECTED' : isLive ? 'ATTENTIVE & VIGILANT' : 'MONITORING INACTIVE'}
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary);" id="dash-status-desc">
              ${driverStatus === 'DROWSY_ALERT' ? 'Immediate high-frequency alarm active. Driver response required.' : isLive ? 'Eye aspect ratio within nominal attentive safety thresholds.' : 'Click Start Monitoring to activate camera tracking.'}
            </p>
          </div>
        </div>

        <!-- Telematics Meters -->
        <div class="telematics-bars">
          <div class="meter-row">
            <div class="meter-header">
              <span>Eye Aspect Ratio (EAR)</span>
              <span id="dash-ear-val">${appState.currentEar.toFixed(2)} (Safe &gt; ${appState.settings.earThreshold})</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill fill-blue" id="dash-ear-bar" style="width: ${Math.min(100, (appState.currentEar / 0.4) * 100)}%;"></div>
            </div>
          </div>

          <div class="meter-row">
            <div class="meter-header">
              <span>Eye Closure Timer</span>
              <span id="dash-closure-val">${appState.closureSeconds.toFixed(1)}s / Max ${appState.settings.drowsinessDurationSec}s</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill fill-red" id="dash-closure-bar" style="width: ${Math.min(100, (appState.closureSeconds / appState.settings.drowsinessDurationSec) * 100)}%;"></div>
            </div>
          </div>

          <div class="meter-row">
            <div class="meter-header">
              <span>Eye Landmark Symmetry (L / R)</span>
              <span id="dash-symmetry-val">L: ${appState.leftEar.toFixed(2)} | R: ${appState.rightEar.toFixed(2)}</span>
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
              <span style="color: var(--text-secondary);">Closure Threshold</span>
              <strong class="tabular-nums">${appState.settings.drowsinessDurationSec.toFixed(1)} seconds</strong>
            </div>

            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">EAR Sensitivity</span>
              <strong class="tabular-nums">${appState.settings.earThreshold.toFixed(2)}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Alarm Tone</span>
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
            ${
              appState.recentEvents.length === 0
                ? `<tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                      No drowsiness warning events recorded in this session. Driver vigilance is normal.
                    </td>
                   </tr>`
                : appState.recentEvents
                    .slice(0, 5)
                    .map(
                      (ev) => `
                    <tr>
                      <td class="tabular-nums">${ev.timestamp}</td>
                      <td><strong>Prolonged Eye Closure</strong></td>
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
                    .join("")
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Attach button interactions
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
      appState.stopSession();
      appState.setPage("dashboard");
    });
  }

  const testAlarmBtn = container.querySelector("#dash-test-alarm-btn");
  if (testAlarmBtn) {
    testAlarmBtn.addEventListener("click", () => {
      soundManager.testAlarm();
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
