/* ==========================================================================
   VIEW: REPORTS & TELEMATICS LOGS
   ========================================================================== */

import { ICONS, formatDuration, formatDateTime, exportToCSV, exportToJSON, showConfirmModal, showContentModal, showToast } from "../utils.js";
import { appState } from "../state.js";

let currentFilter = "all"; // all, real, sample

export function renderReportsPage() {
  const container = document.createElement("div");
  container.className = "reports-container fade-in";

  const allSessions = appState.sessions;
  const filteredSessions = allSessions.filter((s) => {
    if (currentFilter === "real") return !s.isSample;
    if (currentFilter === "sample") return s.isSample;
    return true;
  });

  const totalWarnings = allSessions.reduce((acc, s) => acc + (s.warningEventsCount || 0), 0);
  const totalDuration = allSessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
  const realSessionsCount = allSessions.filter((s) => !s.isSample).length;

  container.innerHTML = `
    <!-- Top Telematics Summary Cards -->
    <div class="metric-grid">
      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Logged Sessions</span>
          <div class="metric-tile-icon">${ICONS.reports}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value tabular-nums">${allSessions.length}</span>
          <span class="metric-tile-unit">sessions</span>
        </div>
        <div class="metric-tile-footer">
          <span>${realSessionsCount} real &bull; ${allSessions.length - realSessionsCount} benchmark</span>
          <span class="badge badge-info">Persistent</span>
        </div>
      </div>

      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Total Time Monitored</span>
          <div class="metric-tile-icon">${ICONS.dashboard}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value tabular-nums">${formatDuration(totalDuration)}</span>
        </div>
        <div class="metric-tile-footer">
          <span>Driver cabin transit tracking</span>
          <span class="badge badge-safe">Audit Log</span>
        </div>
      </div>

      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Total Drowsiness Incidents</span>
          <div class="metric-tile-icon">${ICONS.alertTriangle}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value tabular-nums" style="color: ${totalWarnings > 0 ? 'var(--status-danger)' : 'var(--status-safe)'};">${totalWarnings}</span>
          <span class="metric-tile-unit">events</span>
        </div>
        <div class="metric-tile-footer">
          <span>Triggered audible buzzer alerts</span>
          <span class="badge ${totalWarnings > 0 ? 'badge-danger' : 'badge-safe'}">
            ${totalWarnings > 0 ? 'Incidents Recorded' : 'Zero Incidents'}
          </span>
        </div>
      </div>

      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Export Formats</span>
          <div class="metric-tile-icon">${ICONS.download}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value" style="font-size: 1.35rem;">CSV &bull; JSON</span>
        </div>
        <div class="metric-tile-footer">
          <span>Compliant telematics telemetry</span>
          <span class="badge badge-safe">Standard</span>
        </div>
      </div>
    </div>

    <!-- Reports Toolbar -->
    <div class="reports-toolbar">
      <div class="filter-group">
        <label class="form-label" style="margin-bottom: 0; font-size: 0.8rem;">Filter By:</label>
        <button class="btn btn-sm ${currentFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" data-filter="all">
          All Sessions (${allSessions.length})
        </button>
        <button class="btn btn-sm ${currentFilter === 'real' ? 'btn-primary' : 'btn-secondary'}" data-filter="real">
          Live Webcam (${realSessionsCount})
        </button>
        <button class="btn btn-sm ${currentFilter === 'sample' ? 'btn-primary' : 'btn-secondary'}" data-filter="sample">
          Sample Benchmarks (${allSessions.length - realSessionsCount})
        </button>
      </div>

      <div class="report-export-group">
        <button class="btn btn-secondary btn-sm" id="export-csv-btn">
          ${ICONS.download} Export CSV
        </button>
        <button class="btn btn-secondary btn-sm" id="export-json-btn">
          ${ICONS.download} Export JSON
        </button>
        <button class="btn btn-secondary btn-sm" id="print-report-btn">
          Print Report
        </button>
        <button class="btn btn-outline-danger btn-sm" id="clear-history-btn" title="Clear all session history">
          ${ICONS.trash}
        </button>
      </div>
    </div>

    <!-- Sessions History Card -->
    <div class="sessions-card">
      ${
        filteredSessions.length === 0
          ? `
          <div class="empty-state">
            <div class="empty-state-icon">${ICONS.reports}</div>
            <h3 class="empty-state-title">No Telemetry Sessions Recorded</h3>
            <p class="empty-state-desc">
              Start a driver monitoring session using your webcam or run a benchmark test to generate telematics reports.
            </p>
            <button class="btn btn-primary" id="reports-start-now-btn">
              ${ICONS.play} Start Driver Monitoring
            </button>
          </div>
        `
          : `
          <div class="sessions-table-wrapper">
            <table class="sessions-table">
              <thead>
                <tr>
                  <th>Session ID & Date</th>
                  <th>Classification</th>
                  <th>Duration</th>
                  <th>Alert Events</th>
                  <th>Avg EAR</th>
                  <th>Safety Grade</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${filteredSessions
                  .map((sess) => {
                    const grade = sess.warningEventsCount === 0 ? "Grade A (Optimal)" : sess.warningEventsCount <= 2 ? "Grade B (Moderate)" : "Grade C (Fatigued)";
                    const gradeBadge = sess.warningEventsCount === 0 ? "badge-safe" : sess.warningEventsCount <= 2 ? "badge-warn" : "badge-danger";
                    return `
                    <tr>
                      <td>
                        <div class="session-name-cell">
                          <div class="metric-tile-icon" style="width: 28px; height: 28px;">${ICONS.shieldCheck}</div>
                          <div>
                            <div>${formatDateTime(sess.startTime)}</div>
                            <span style="font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono);">${sess.id}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="session-type-badge ${sess.isSample ? 'sample' : 'real'}">
                          ${sess.isSample ? 'Sample Benchmark' : 'Live Camera'}
                        </span>
                      </td>
                      <td class="tabular-nums"><strong>${formatDuration(sess.durationSeconds)}</strong></td>
                      <td>
                        <span class="badge ${sess.warningEventsCount > 0 ? 'badge-danger' : 'badge-safe'} tabular-nums">
                          ${sess.warningEventsCount} ${sess.warningEventsCount === 1 ? 'Alert' : 'Alerts'}
                        </span>
                      </td>
                      <td class="tabular-nums">${sess.avgEar || 0.28}</td>
                      <td>
                        <span class="badge ${gradeBadge}">
                          <span class="badge-dot"></span> ${grade}
                        </span>
                      </td>
                      <td style="text-align: right;">
                        <button class="btn btn-secondary btn-sm inspect-session-btn" data-id="${sess.id}">
                          Inspect Details
                        </button>
                      </td>
                    </tr>
                  `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        `
      }
    </div>
  `;

  // Filter Buttons
  container.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter;
      appState.setPage("reports");
    });
  });

  // Export CSV
  const exportCsvBtn = container.querySelector("#export-csv-btn");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => {
      const rows = allSessions.map((s) => ({
        Session_ID: s.id,
        Type: s.isSample ? "Sample Benchmark" : "Live Camera",
        Start_Time: s.startTime,
        Duration_Seconds: s.durationSeconds,
        Duration_Formatted: formatDuration(s.durationSeconds),
        Warning_Events_Count: s.warningEventsCount,
        Average_EAR: s.avgEar,
        Notes: s.notes || ""
      }));
      exportToCSV("vigildrive_drowsiness_telematics_report", rows);
    });
  }

  // Export JSON
  const exportJsonBtn = container.querySelector("#export-json-btn");
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", () => {
      exportToJSON("vigildrive_drowsiness_telematics_report", allSessions);
    });
  }

  // Print Report
  const printBtn = container.querySelector("#print-report-btn");
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }

  // Clear History
  const clearBtn = container.querySelector("#clear-history-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      showConfirmModal({
        title: "Clear All Session History?",
        message: "This will delete all saved monitoring logs and benchmarks permanently from local browser storage.",
        confirmText: "Delete History",
        isDanger: true,
        onConfirm: () => {
          appState.clearSessions();
          showToast("History Purged", "All session telemetry deleted.", "safe");
          appState.setPage("reports");
        }
      });
    });
  }

  // Empty State CTA
  const startNowBtn = container.querySelector("#reports-start-now-btn");
  if (startNowBtn) {
    startNowBtn.addEventListener("click", () => {
      appState.setPage("live");
    });
  }

  // Inspect Session Details
  container.querySelectorAll(".inspect-session-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sessionId = btn.dataset.id;
      const session = allSessions.find((s) => s.id === sessionId);
      if (!session) return;

      const eventsList = session.events && session.events.length > 0
        ? session.events
            .map(
              (ev) => `
              <div class="timeline-item">
                <span class="timeline-time">${ev.timestamp}</span>
                <span><strong>${ev.typeLabel || (ev.type === 'ALERT' ? 'Prolonged Eye Closure' : ev.type.replace('_', ' '))}</strong> (Duration: ${ev.duration})</span>
                <span class="badge ${ev.severity === 'Critical' ? 'badge-danger' : 'badge-warn'}">${ev.severity}</span>
              </div>
            `
            )
            .join("")
        : `<p style="text-align: center; color: var(--text-muted); padding: 1.5rem 0;">No drowsiness incidents recorded during this transit session.</p>`;

      const modalHtml = `
        <div class="report-modal-content">
          <div class="session-stat-pills">
            <div class="session-stat-pill">
              <div class="val tabular-nums">${formatDuration(session.durationSeconds)}</div>
              <div class="lbl">Transit Duration</div>
            </div>
            <div class="session-stat-pill">
              <div class="val tabular-nums" style="color: ${session.warningEventsCount > 0 ? '#ef4444' : '#10b981'};">${session.warningEventsCount}</div>
              <div class="lbl">Fatigue Alerts</div>
            </div>
            <div class="session-stat-pill">
              <div class="val tabular-nums">${session.avgEar || 0.28}</div>
              <div class="lbl">Average EAR</div>
            </div>
            <div class="session-stat-pill">
              <div class="val tabular-nums">${session.yawnCount !== undefined ? session.yawnCount : 0}</div>
              <div class="lbl">Yawns Counted</div>
            </div>
          </div>

          <div style="font-size: 0.85rem; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.875rem;">
            <div><strong>Origin:</strong> ${session.isSample ? 'Benchmark Simulation Telemetry' : 'Live Camera Biometric Stream'}</div>
            <div><strong>Session Start:</strong> ${formatDateTime(session.startTime)}</div>
            <div><strong>Session ID:</strong> <code>${session.id}</code></div>
          </div>

          <div>
            <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
              ${ICONS.alertTriangle} Incident Log Timeline
            </h4>
            <div class="events-timeline">
              ${eventsList}
            </div>
          </div>
        </div>
      `;

      showContentModal({
        title: `Session Details: ${session.notes || session.id}`,
        contentHtml: modalHtml,
        maxWidth: "580px"
      });
    });
  });

  return container;
}
