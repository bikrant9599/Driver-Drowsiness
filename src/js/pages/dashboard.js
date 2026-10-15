/* ==========================================================================
   VIEW: DASHBOARD
   ========================================================================== */

import { ICONS, formatDuration, formatDateTime, showToast, showConfirmModal, openSessionDetailsModal } from "../utils.js";
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
  const isPaused = appState.isPaused;
  const driverStatus = appState.driverStatus;
  const statusColorClass = getDashStatusClass(driverStatus);
  const statusBadgeClass = getDashBadgeClass(driverStatus);

  // Compute actual stored data aggregates (zero if no data exists)
  const storedSessions = appState.sessions || [];
  const totalSessionsCount = storedSessions.length;
  const totalDurationSec = storedSessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
  const totalWarningsCount = storedSessions.reduce((acc, s) => acc + (s.warningEventsCount || 0), 0);
  const realSessionsCount = storedSessions.filter((s) => !s.isSample).length;
  const sampleSessionsCount = storedSessions.filter((s) => s.isSample).length;

  // Warning event trends from real stored data
  let closureWarningsCount = 0;
  let yawnWarningsCount = 0;
  let headDropWarningsCount = 0;
  let combinedWarningsCount = 0;

  storedSessions.forEach((s) => {
    if (Array.isArray(s.events)) {
      s.events.forEach((ev) => {
        const type = ev.type || "";
        const label = (ev.typeLabel || "").toLowerCase();
        if (type === "DROWSY_NOD_OFF" || label.includes("head drop + eye closure")) {
          combinedWarningsCount++;
        } else if (type === "ALERT" || label.includes("eye closure") || label.includes("drowsiness")) {
          closureWarningsCount++;
        } else if (type === "YAWN_DETECTED" || label.includes("yawn")) {
          yawnWarningsCount++;
        } else if (type === "HEAD_DROP" || label.includes("head")) {
          headDropWarningsCount++;
        } else {
          closureWarningsCount++;
        }
      });
    }
  });

  container.innerHTML = `
    <!-- Top Telematics Control Bar -->
    <div class="telematics-control-bar">
      <div class="system-status-indicator">
        <div class="system-status-orb ${isLive ? (driverStatus === 'ALERT' ? 'drowsy' : 'active') : 'idle'}" id="dash-status-orb"></div>
        <div class="system-status-text">
          <h3 id="dash-system-title">${isLive ? (appState.monitoringMode === 'sample' ? 'Benchmark Simulation Active' : 'Real-Time Camera AI Active') : 'Driver Monitoring System Standby'}</h3>
          <p id="dash-system-desc">${isLive ? (isPaused ? 'Telemetry paused by user' : 'Continuous biometric telemetry running') : 'System calibrated and ready to engage'}</p>
        </div>
      </div>

      <div class="telematics-actions" id="dash-actions-group">
        ${renderDashActionButtons(isLive, isPaused)}
        <button class="btn btn-secondary btn-icon" id="dash-test-alarm-btn" title="Test Alarm Tone">
          ${ICONS.volume2}
        </button>
      </div>
    </div>

    <!-- 4 Stored Analytics Metric Tiles (Connected to Real Stored Data) -->
    <div class="metric-grid">
      <!-- Total Monitoring Sessions Card -->
      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Total Monitoring Sessions</span>
          <div class="metric-tile-icon">${ICONS.reports}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value tabular-nums" id="dash-stat-total-sessions">${totalSessionsCount}</span>
          <span class="metric-tile-unit">sessions</span>
        </div>
        <div class="metric-tile-footer">
          <span id="dash-stat-sessions-breakdown">
            ${totalSessionsCount === 0 ? 'No recorded sessions' : `${realSessionsCount} live &bull; ${sampleSessionsCount} benchmark`}
          </span>
          <span class="badge ${totalSessionsCount > 0 ? 'badge-safe' : 'badge-neutral'}">
            ${totalSessionsCount > 0 ? 'Verified Logs' : 'Zero State'}
          </span>
        </div>
      </div>

      <!-- Total Monitoring Duration Card -->
      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Total Monitoring Duration</span>
          <div class="metric-tile-icon">${ICONS.dashboard}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value tabular-nums" id="dash-stat-total-duration">${formatDuration(totalDurationSec)}</span>
        </div>
        <div class="metric-tile-footer">
          <span>Cumulative Monitored Time</span>
          <span class="badge ${totalDurationSec > 0 ? 'badge-info' : 'badge-neutral'}">
            ${totalDurationSec > 0 ? 'Telematics Clock' : '0 sec'}
          </span>
        </div>
      </div>

      <!-- Total Drowsiness Warnings Card -->
      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Drowsiness Warning Events</span>
          <div class="metric-tile-icon">${ICONS.alertTriangle}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value tabular-nums" id="dash-stat-total-warnings" style="color: ${totalWarningsCount > 0 ? 'var(--status-danger)' : 'var(--status-safe)'};">${totalWarningsCount}</span>
          <span class="metric-tile-unit">events</span>
        </div>
        <div class="metric-tile-footer">
          <span>Audible Warnings Triggered</span>
          <span class="badge ${totalWarningsCount > 0 ? 'badge-danger' : 'badge-safe'}">
            ${totalWarningsCount > 0 ? 'Incidents Logged' : 'Safe Zero'}
          </span>
        </div>
      </div>

      <!-- Live Sensor & Driver State Card -->
      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Sensor & Telemetry Status</span>
          <div class="metric-tile-icon">${ICONS.camera}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value ${statusColorClass}" id="dash-driver-stat" style="font-size: 1.4rem;">${driverStatus}</span>
        </div>
        <div class="metric-tile-footer">
          <span>Face: <strong id="dash-face-stat">${appState.faceDetected ? 'Locked' : isLive ? 'Searching' : 'Standby'}</strong></span>
          <span class="badge ${statusBadgeClass}" id="dash-driver-badge">
            <span class="badge-dot"></span> <span id="dash-driver-badge-text">${isLive ? (driverStatus === 'ALERT' ? 'CRITICAL' : driverStatus === 'ATTENTIVE' ? 'NORMAL' : 'CAUTION') : 'STANDBY'}</span>
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
                  ? (isPaused ? 'TELEMATICS PAUSED' : 'ATTENTIVE & VIGILANT')
                  : 'MONITORING STANDBY'
              }
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary);" id="dash-status-desc">
              ${
                driverStatus === 'ALERT'
                  ? 'Immediate high-frequency audible alarm active. Driver wake up required!'
                  : driverStatus === 'POSSIBLE DROWSINESS'
                  ? 'Fatigue warning signals active (eye closure, yawning, or head drop).'
                  : driverStatus === 'FACE NOT DETECTED'
                  ? 'Please center driver face within camera field of view.'
                  : driverStatus === 'CAMERA ERROR'
                  ? 'Webcam permission denied or camera device unavailable.'
                  : isLive
                  ? (isPaused ? 'Click Resume Monitoring to continue camera tracking.' : 'Eye aspect ratio within nominal attentive safety thresholds.')
                  : 'Click Start Live Camera to initiate AI computer vision tracking.'
              }
            </p>
          </div>
        </div>

        <!-- Telematics Meters -->
        <div class="telematics-bars">
          <!-- EAR Meter -->
          <div class="meter-row">
            <div class="meter-header">
              <span>Eye Aspect Ratio (EAR)</span>
              <span id="dash-ear-val">${appState.currentEar.toFixed(2)} (Safe &gt; ${appState.settings.earThreshold.toFixed(2)})</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill fill-blue" id="dash-ear-bar" style="width: ${Math.min(100, (appState.currentEar / 0.4) * 100)}%;"></div>
            </div>
          </div>

          <!-- Closure Meter -->
          <div class="meter-row">
            <div class="meter-header">
              <span>Eye Closure Timer</span>
              <span id="dash-closure-val">${appState.closureSeconds.toFixed(1)}s / Max ${appState.settings.drowsinessDurationSec.toFixed(1)}s</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill fill-red" id="dash-closure-bar" style="width: ${Math.min(100, (appState.closureSeconds / appState.settings.drowsinessDurationSec) * 100)}%;"></div>
            </div>
          </div>

          <!-- Mouth Opening (MAR) Meter -->
          <div class="meter-row">
            <div class="meter-header">
              <span>Mouth Opening (MAR) & Yawn Count</span>
              <span id="dash-mar-val">MAR: ${appState.currentMar.toFixed(2)} | Yawns: ${appState.yawnCount}</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill fill-green" id="dash-mar-bar" style="width: ${Math.min(100, (appState.currentMar / 0.8) * 100)}%;"></div>
            </div>
          </div>

          <!-- Head Position Meter -->
          <div class="meter-row">
            <div class="meter-header">
              <span>Head Position & Orientation</span>
              <span id="dash-pitch-val">Pitch Ratio: ${appState.headPitch.toFixed(2)} (${appState.isHeadDrop ? 'Downward Nod' : 'Upright'})</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill fill-blue" id="dash-pitch-bar" style="width: ${Math.min(100, (appState.headPitch / 1.5) * 100)}%;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: System Safety & Current Session Info -->
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div class="card-header">
            <div class="card-title">
              ${ICONS.shieldCheck} Live Session Telemetry
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.875rem; font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Current Session Duration</span>
              <strong class="tabular-nums" id="dash-active-timer">${formatDuration(appState.sessionDurationSec)}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Current Session Warnings</span>
              <strong class="tabular-nums" id="dash-active-warnings">${appState.sessionWarningsCount}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Closure Trigger Threshold</span>
              <strong class="tabular-nums">${appState.settings.drowsinessDurationSec.toFixed(1)}s</strong>
            </div>

            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">EAR Sensitivity Threshold</span>
              <strong class="tabular-nums">${appState.settings.earThreshold.toFixed(2)}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Yawning Detection</span>
              <strong>${appState.settings.yawnDetectionEnabled ? `Enabled (MAR ${appState.settings.marThreshold.toFixed(2)})` : 'Disabled'}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Alarm Tone Profile</span>
              <strong style="text-transform: capitalize;">${appState.settings.alarmSound} (${appState.settings.volume}%)</strong>
            </div>
          </div>
        </div>

        <div style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
          <button class="btn btn-secondary" style="width: 100%;" id="dash-open-settings-btn">
            ${ICONS.settings} Modify System Settings
          </button>
        </div>
      </div>
    </div>

    <!-- Warning-Event Trends Card (Connected to Real Stored Data) -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          ${ICONS.alertTriangle} Warning-Event Trends & Fatigue Breakdown
        </div>
        <span class="badge ${totalWarningsCount > 0 ? 'badge-warn' : 'badge-safe'}">
          ${totalWarningsCount > 0 ? `${totalWarningsCount} Total Incidents` : 'Safe Zero Incidents'}
        </span>
      </div>

      <div id="dash-trends-body">
        ${renderWarningTrends(totalWarningsCount, closureWarningsCount, yawnWarningsCount, headDropWarningsCount, combinedWarningsCount)}
      </div>
    </div>

    <!-- Recent Monitoring Sessions Card (Connected to Real Stored Data) -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          ${ICONS.reports} Recent Monitoring Sessions
        </div>
        <button class="btn btn-secondary btn-sm" id="dash-view-all-reports-btn">
          ${ICONS.reports} View All Reports (${totalSessionsCount})
        </button>
      </div>

      <div id="dash-recent-sessions-container">
        ${renderRecentSessionsTable(storedSessions)}
      </div>
    </div>

    <!-- Live Session Warning Events Log Table -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          ${ICONS.bell} Active Session Warning Events Log
        </div>
        <span class="badge ${appState.sessionWarningsCount > 0 ? 'badge-danger' : 'badge-neutral'}">
          ${appState.sessionWarningsCount} Session Alerts
        </span>
      </div>

      <div class="events-table-wrapper">
        <table class="events-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Incident Classification</th>
              <th>Duration</th>
              <th>Detected EAR</th>
              <th>Detected MAR</th>
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

  function renderWarningTrends(total, closure, yawn, headDrop, combined) {
    if (total === 0) {
      return `
        <div class="empty-state" style="padding: 2.5rem 1.5rem;">
          <div class="empty-state-icon" style="width: 52px; height: 52px;">${ICONS.shieldCheck}</div>
          <h4 class="empty-state-title" style="font-size: 1.05rem;">No Drowsiness Warning Trends Available</h4>
          <p class="empty-state-desc" style="font-size: 0.85rem; max-width: 440px; margin-bottom: 0;">
            Zero drowsiness warning events or prolonged eye closures have been recorded across your stored monitoring sessions. Nominal driver vigilance has been consistently maintained.
          </p>
        </div>
      `;
    }

    const closurePct = Math.round((closure / total) * 100);
    const yawnPct = Math.round((yawn / total) * 100);
    const headDropPct = Math.round((headDrop / total) * 100);
    const combinedPct = Math.round((combined / total) * 100);

    return `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          <div style="background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Prolonged Eye Closure</div>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--status-danger);" class="tabular-nums">${closure}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">${closurePct}% of fatigue events</div>
          </div>

          <div style="background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Frequent Yawning (MAR)</div>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--status-warn);" class="tabular-nums">${yawn}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">${yawnPct}% of fatigue events</div>
          </div>

          <div style="background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Downward Head Nod (Pitch)</div>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--status-warn);" class="tabular-nums">${headDrop}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">${headDropPct}% of fatigue events</div>
          </div>

          <div style="background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Combined Microsleep Alert</div>
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--status-danger);" class="tabular-nums">${combined}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">${combinedPct}% of fatigue events</div>
          </div>
        </div>

        <!-- Trend Progress Bars -->
        <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem;">
          <div class="meter-row">
            <div class="meter-header">
              <span>Prolonged Eye Closures</span>
              <span class="tabular-nums">${closure} events (${closurePct}%)</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill fill-red" style="width: ${closurePct}%;"></div>
            </div>
          </div>

          <div class="meter-row">
            <div class="meter-header">
              <span>Yawning Incidents</span>
              <span class="tabular-nums">${yawn} events (${yawnPct}%)</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill fill-green" style="width: ${yawnPct}%;"></div>
            </div>
          </div>

          <div class="meter-row">
            <div class="meter-header">
              <span>Downward Head Nods</span>
              <span class="tabular-nums">${headDrop} events (${headDropPct}%)</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill fill-blue" style="width: ${headDropPct}%;"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderRecentSessionsTable(sessions) {
    if (sessions.length === 0) {
      return `
        <div class="empty-state" style="padding: 3rem 1.5rem;">
          <div class="empty-state-icon">${ICONS.reports}</div>
          <h4 class="empty-state-title">No Monitoring Sessions Recorded</h4>
          <p class="empty-state-desc">
            Connect your webcam or initiate a benchmark simulation to capture real-time driver biometrics and build your session history.
          </p>
          <button class="btn btn-primary" id="dash-empty-start-btn">
            ${ICONS.camera} Start Live Camera
          </button>
        </div>
      `;
    }

    const recent5 = sessions.slice(0, 5);

    return `
      <div class="events-table-wrapper">
        <table class="events-table">
          <thead>
            <tr>
              <th>Session ID & Date</th>
              <th>Mode</th>
              <th>Duration</th>
              <th>Warnings</th>
              <th>Avg EAR</th>
              <th>Safety Grade</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${recent5
              .map((s) => {
                const grade = s.warningEventsCount === 0 ? "Grade A" : s.warningEventsCount <= 2 ? "Grade B" : "Grade C";
                const gradeBadge = s.warningEventsCount === 0 ? "badge-safe" : s.warningEventsCount <= 2 ? "badge-warn" : "badge-danger";
                return `
                <tr>
                  <td>
                    <div>
                      <div style="font-weight: 600; color: var(--text-primary);">${formatDateTime(s.startTime)}</div>
                      <span style="font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono);">${s.id}</span>
                    </div>
                  </td>
                  <td>
                    <span class="badge ${s.isSample ? 'badge-neutral' : 'badge-info'}">
                      ${s.isSample ? 'Benchmark Simulation' : 'Live Camera'}
                    </span>
                  </td>
                  <td class="tabular-nums"><strong>${formatDuration(s.durationSeconds)}</strong></td>
                  <td>
                    <span class="badge ${s.warningEventsCount > 0 ? 'badge-danger' : 'badge-safe'} tabular-nums">
                      ${s.warningEventsCount} ${s.warningEventsCount === 1 ? 'alert' : 'alerts'}
                    </span>
                  </td>
                  <td class="tabular-nums">${s.avgEar || 0.28}</td>
                  <td>
                    <span class="badge ${gradeBadge}">
                      <span class="badge-dot"></span> ${grade}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-secondary btn-sm inspect-dash-session-btn" data-id="${s.id}">
                      Inspect
                    </button>
                  </td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderDashActionButtons(isMonitoring, isPausedState) {
    if (!isMonitoring) {
      return `
        <button class="btn btn-primary" id="dash-start-live-btn">
          ${ICONS.camera} Start Live Camera
        </button>
        <button class="btn btn-secondary" id="dash-start-demo-btn">
          ${ICONS.play} Run Benchmark Simulation
        </button>
      `;
    }

    if (isPausedState) {
      return `
        <button class="btn btn-primary" id="dash-resume-btn">
          ${ICONS.play} Resume
        </button>
        <button class="btn btn-outline-danger" id="dash-stop-btn">
          ${ICONS.stop} Stop Monitoring
        </button>
      `;
    }

    return `
      <button class="btn btn-secondary" id="dash-pause-btn">
        ${ICONS.pause} Pause
      </button>
      <button class="btn btn-outline-danger" id="dash-stop-btn">
        ${ICONS.stop} Stop Monitoring
      </button>
    `;
  }

  function renderRecentEventsRows() {
    if (appState.currentSessionEvents.length === 0 && appState.recentEvents.length === 0) {
      return `<tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No drowsiness warning events recorded in this active session. Driver vigilance is normal.
        </td>
      </tr>`;
    }
    const eventsToShow = appState.currentSessionEvents.length > 0 ? appState.currentSessionEvents : appState.recentEvents;
    return eventsToShow
      .slice(0, 5)
      .map(
        (ev) => `
        <tr>
          <td class="tabular-nums">${ev.timestamp}</td>
          <td><strong>${ev.typeLabel || (ev.type === 'ALERT' ? 'Prolonged Eye Closure' : ev.type.replace(/_/g, ' '))}</strong></td>
          <td class="tabular-nums">${ev.duration}</td>
          <td class="tabular-nums">${ev.ear !== undefined ? ev.ear : '-'}</td>
          <td class="tabular-nums">${ev.mar !== undefined ? ev.mar : '-'}</td>
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

    const orb = container.querySelector("#dash-status-orb");
    if (orb) {
      orb.className = `system-status-orb ${curIsLive ? (curStatus === 'ALERT' ? 'drowsy' : 'active') : 'idle'}`;
    }

    const driverStat = container.querySelector("#dash-driver-stat");
    if (driverStat) {
      driverStat.textContent = curStatus;
      driverStat.className = `metric-tile-value ${getDashStatusClass(curStatus)}`;
    }

    const faceStat = container.querySelector("#dash-face-stat");
    if (faceStat) {
      faceStat.textContent = appState.faceDetected ? "Locked" : curIsLive ? "Searching" : "Standby";
    }

    const activeTimer = container.querySelector("#dash-active-timer");
    if (activeTimer) {
      activeTimer.textContent = formatDuration(appState.sessionDurationSec);
    }

    const activeWarns = container.querySelector("#dash-active-warnings");
    if (activeWarns) {
      activeWarns.textContent = appState.sessionWarningsCount;
    }

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
          ? (appState.isPaused ? "TELEMATICS PAUSED" : "ATTENTIVE & VIGILANT")
          : "MONITORING STANDBY";
    }

    // Biometric meters
    const earVal = container.querySelector("#dash-ear-val");
    if (earVal) earVal.textContent = `${appState.currentEar.toFixed(2)} (Safe > ${appState.settings.earThreshold.toFixed(2)})`;

    const earBar = container.querySelector("#dash-ear-bar");
    if (earBar) earBar.style.width = `${Math.min(100, (appState.currentEar / 0.4) * 100)}%`;

    const closureVal = container.querySelector("#dash-closure-val");
    if (closureVal) closureVal.textContent = `${appState.closureSeconds.toFixed(1)}s / Max ${appState.settings.drowsinessDurationSec.toFixed(1)}s`;

    const closureBar = container.querySelector("#dash-closure-bar");
    if (closureBar) closureBar.style.width = `${Math.min(100, (appState.closureSeconds / appState.settings.drowsinessDurationSec) * 100)}%`;

    const marVal = container.querySelector("#dash-mar-val");
    if (marVal) marVal.textContent = `MAR: ${appState.currentMar.toFixed(2)} | Yawns: ${appState.yawnCount}`;

    const marBar = container.querySelector("#dash-mar-bar");
    if (marBar) marBar.style.width = `${Math.min(100, (appState.currentMar / 0.8) * 100)}%`;

    const pitchVal = container.querySelector("#dash-pitch-val");
    if (pitchVal) pitchVal.textContent = `Pitch: ${appState.headPitch.toFixed(2)} (${appState.isHeadDrop ? 'Downward Nod' : 'Upright'})`;

    const pitchBar = container.querySelector("#dash-pitch-bar");
    if (pitchBar) pitchBar.style.width = `${Math.min(100, (appState.headPitch / 1.5) * 100)}%`;

    const tbody = container.querySelector("#dash-events-tbody");
    if (tbody) tbody.innerHTML = renderRecentEventsRows();
  }, 100);

  // Bind Buttons
  const bindDashButtons = () => {
    const startLiveBtn = container.querySelector("#dash-start-live-btn");
    if (startLiveBtn) {
      startLiveBtn.onclick = () => {
        if (appState.isMonitoring || visionEngine.isStartingCamera) {
          appState.setPage("live");
          return;
        }
        appState.startSession("real");
        appState.setPage("live");
      };
    }

    const emptyStartBtn = container.querySelector("#dash-empty-start-btn");
    if (emptyStartBtn) {
      emptyStartBtn.onclick = () => {
        if (appState.isMonitoring || visionEngine.isStartingCamera) {
          appState.setPage("live");
          return;
        }
        appState.startSession("real");
        appState.setPage("live");
      };
    }

    const startDemoBtn = container.querySelector("#dash-start-demo-btn");
    if (startDemoBtn) {
      startDemoBtn.onclick = () => {
        if (appState.isMonitoring || visionEngine.isStartingCamera) {
          appState.setPage("live");
          return;
        }
        appState.startSession("sample");
        appState.setPage("live");
      };
    }

    const pauseBtn = container.querySelector("#dash-pause-btn");
    if (pauseBtn) {
      pauseBtn.onclick = () => {
        appState.pauseSession();
        soundManager.stopDrowsinessAlert();
        appState.setPage("dashboard");
      };
    }

    const resumeBtn = container.querySelector("#dash-resume-btn");
    if (resumeBtn) {
      resumeBtn.onclick = () => {
        appState.resumeSession();
        appState.setPage("dashboard");
      };
    }

    const stopBtn = container.querySelector("#dash-stop-btn");
    if (stopBtn) {
      stopBtn.onclick = () => {
        visionEngine.stopCamera();
        appState.stopSession();
        showToast("Session Saved", "Monitoring session ended and logged to reports.", "safe");
        appState.setPage("dashboard");
      };
    }

    const testAlarmBtn = container.querySelector("#dash-test-alarm-btn");
    if (testAlarmBtn) {
      testAlarmBtn.onclick = () => {
        soundManager.testAlarm();
        showToast("Alarm Test", `Sounding ${appState.settings.alarmSound} tone alert.`, "info");
      };
    }

    // Inspect recent session buttons
    container.querySelectorAll(".inspect-dash-session-btn").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const session = storedSessions.find((s) => s.id === id);
        if (session) {
          openSessionDetailsModal(session);
        }
      };
    });
  };

  bindDashButtons();

  container.querySelector("#dash-open-settings-btn").addEventListener("click", () => {
    appState.setPage("settings");
  });

  container.querySelector("#dash-view-all-reports-btn").addEventListener("click", () => {
    appState.setPage("reports");
  });

  return container;
}
