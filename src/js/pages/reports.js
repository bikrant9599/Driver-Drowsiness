/* ==========================================================================
   VIEW: REPORTS & TELEMATICS LOGS
   ========================================================================== */

import {
  ICONS,
  formatDuration,
  formatDateTime,
  exportSessionToCSV,
  exportAllSessionsToCSV,
  exportSessionToPDF,
  exportAllSessionsToPDF,
  openSessionDetailsModal,
  showConfirmModal,
  showToast
} from "../utils.js";
import { appState } from "../state.js";

// Active filter state
let currentDateFilter = "all"; // all, today, 7d, 30d
let currentWarningFilter = "all"; // all, warnings, clean, closure, yawn, nod
let currentModeFilter = "all"; // all, real, sample
let currentSearchQuery = "";

export function renderReportsPage() {
  const container = document.createElement("div");
  container.className = "reports-container fade-in";

  const allSessions = appState.sessions || [];

  // Filter sessions according to user criteria
  const filteredSessions = allSessions.filter((s) => {
    // Mode filter
    if (currentModeFilter === "real" && s.isSample) return false;
    if (currentModeFilter === "sample" && !s.isSample) return false;

    // Date filter
    if (currentDateFilter !== "all") {
      const sessionTime = new Date(s.startTime).getTime();
      const now = Date.now();
      if (currentDateFilter === "today") {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        if (sessionTime < todayStart.getTime()) return false;
      } else if (currentDateFilter === "7d") {
        if (now - sessionTime > 7 * 24 * 3600 * 1000) return false;
      } else if (currentDateFilter === "30d") {
        if (now - sessionTime > 30 * 24 * 3600 * 1000) return false;
      }
    }

    // Warning type filter
    if (currentWarningFilter === "clean") {
      if ((s.warningEventsCount || 0) > 0) return false;
    } else if (currentWarningFilter === "warnings") {
      if ((s.warningEventsCount || 0) === 0) return false;
    } else if (currentWarningFilter === "closure") {
      const hasClosure = Array.isArray(s.events) && s.events.some((e) => e.type === "ALERT" || (e.typeLabel && e.typeLabel.toLowerCase().includes("closure")));
      if (!hasClosure) return false;
    } else if (currentWarningFilter === "yawn") {
      const hasYawn = Array.isArray(s.events) && s.events.some((e) => e.type === "YAWN_DETECTED" || (e.typeLabel && e.typeLabel.toLowerCase().includes("yawn")));
      if (!hasYawn) return false;
    } else if (currentWarningFilter === "nod") {
      const hasNod = Array.isArray(s.events) && s.events.some((e) => e.type === "HEAD_DROP" || e.type === "DROWSY_NOD_OFF" || (e.typeLabel && e.typeLabel.toLowerCase().includes("head")));
      if (!hasNod) return false;
    }

    // Search query filter (by Session ID or Notes)
    if (currentSearchQuery.trim()) {
      const q = currentSearchQuery.trim().toLowerCase();
      const matchId = (s.id || "").toLowerCase().includes(q);
      const matchNotes = (s.notes || "").toLowerCase().includes(q);
      const matchDate = formatDateTime(s.startTime).toLowerCase().includes(q);
      if (!matchId && !matchNotes && !matchDate) return false;
    }

    return true;
  });

  const totalWarnings = allSessions.reduce((acc, s) => acc + (s.warningEventsCount || 0), 0);
  const totalDuration = allSessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
  const realSessionsCount = allSessions.filter((s) => !s.isSample).length;

  container.innerHTML = `
    <!-- Top Telematics Summary Cards (Connected to Real Stored Sessions) -->
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
          <span>${realSessionsCount} live &bull; ${allSessions.length - realSessionsCount} benchmark</span>
          <span class="badge ${allSessions.length > 0 ? 'badge-info' : 'badge-neutral'}">
            ${allSessions.length > 0 ? 'Persistent' : 'Empty'}
          </span>
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
          <span class="badge ${totalDuration > 0 ? 'badge-safe' : 'badge-neutral'}">Audit Log</span>
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
          <span>Audible drowsiness alarms</span>
          <span class="badge ${totalWarnings > 0 ? 'badge-danger' : 'badge-safe'}">
            ${totalWarnings > 0 ? 'Incidents Recorded' : 'Safe Zero'}
          </span>
        </div>
      </div>

      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Export Formats</span>
          <div class="metric-tile-icon">${ICONS.download}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value" style="font-size: 1.35rem;">CSV &bull; PDF</span>
        </div>
        <div class="metric-tile-footer">
          <span>Executive audit telematics</span>
          <span class="badge badge-safe">Compliant</span>
        </div>
      </div>
    </div>

    <!-- Reports Filters & Search Toolbar -->
    <div class="reports-toolbar">
      <div class="filter-group" style="flex: 1; min-width: 280px;">
        <!-- Date Filter -->
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
          <label style="font-size: 0.725rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Date Range</label>
          <select class="form-select" id="report-date-select" style="padding: 0.45rem 0.75rem; font-size: 0.8rem; width: auto; min-width: 140px;">
            <option value="all" ${currentDateFilter === 'all' ? 'selected' : ''}>All Dates</option>
            <option value="today" ${currentDateFilter === 'today' ? 'selected' : ''}>Today</option>
            <option value="7d" ${currentDateFilter === '7d' ? 'selected' : ''}>Past 7 Days</option>
            <option value="30d" ${currentDateFilter === '30d' ? 'selected' : ''}>Past 30 Days</option>
          </select>
        </div>

        <!-- Warning Type Filter -->
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
          <label style="font-size: 0.725rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Warning Type</label>
          <select class="form-select" id="report-warning-select" style="padding: 0.45rem 0.75rem; font-size: 0.8rem; width: auto; min-width: 160px;">
            <option value="all" ${currentWarningFilter === 'all' ? 'selected' : ''}>All Events</option>
            <option value="warnings" ${currentWarningFilter === 'warnings' ? 'selected' : ''}>With Warnings (&gt; 0)</option>
            <option value="clean" ${currentWarningFilter === 'clean' ? 'selected' : ''}>Clean Transits (0 Alerts)</option>
            <option value="closure" ${currentWarningFilter === 'closure' ? 'selected' : ''}>Prolonged Eye Closure</option>
            <option value="yawn" ${currentWarningFilter === 'yawn' ? 'selected' : ''}>Frequent Yawning</option>
            <option value="nod" ${currentWarningFilter === 'nod' ? 'selected' : ''}>Head Nod / Drop</option>
          </select>
        </div>

        <!-- Origin Mode Filter -->
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
          <label style="font-size: 0.725rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Sensor Mode</label>
          <select class="form-select" id="report-mode-select" style="padding: 0.45rem 0.75rem; font-size: 0.8rem; width: auto; min-width: 140px;">
            <option value="all" ${currentModeFilter === 'all' ? 'selected' : ''}>All Modes</option>
            <option value="real" ${currentModeFilter === 'real' ? 'selected' : ''}>Live Webcam</option>
            <option value="sample" ${currentModeFilter === 'sample' ? 'selected' : ''}>Benchmark</option>
          </select>
        </div>

        <!-- Search Input -->
        <div style="display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 160px;">
          <label style="font-size: 0.725rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Search</label>
          <input
            type="text"
            class="form-control"
            id="report-search-input"
            placeholder="Search by ID or date..."
            value="${currentSearchQuery}"
            style="padding: 0.45rem 0.75rem; font-size: 0.8rem;"
          />
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="report-export-group">
        <button class="btn btn-secondary btn-sm" id="export-all-csv-btn" title="Download all filtered sessions as CSV">
          ${ICONS.download} Export CSV
        </button>
        <button class="btn btn-secondary btn-sm" id="export-all-pdf-btn" title="Download executive telematics PDF report">
          ${ICONS.download} Export PDF
        </button>
        <button class="btn btn-secondary btn-sm" id="print-report-btn" title="Print session reports table">
          Print
        </button>
        <button class="btn btn-outline-danger btn-sm" id="clear-history-btn" title="Clear all session history with confirmation">
          ${ICONS.trash}
        </button>
      </div>
    </div>

    <!-- Sessions History Card -->
    <div class="sessions-card">
      ${renderSessionsTableSection(filteredSessions, allSessions.length)}
    </div>
  `;

  function renderSessionsTableSection(sessions, totalUnfilteredCount) {
    if (sessions.length === 0) {
      if (totalUnfilteredCount === 0) {
        return `
          <div class="empty-state">
            <div class="empty-state-icon">${ICONS.reports}</div>
            <h3 class="empty-state-title">No Telemetry Sessions Recorded</h3>
            <p class="empty-state-desc">
              Start a real driver monitoring session with your webcam or run a benchmark simulation to generate auditable telematics reports.
            </p>
            <button class="btn btn-primary" id="reports-start-now-btn">
              ${ICONS.camera} Start Driver Monitoring
            </button>
          </div>
        `;
      }
      return `
        <div class="empty-state">
          <div class="empty-state-icon" style="color: var(--status-warn);">${ICONS.alertTriangle}</div>
          <h3 class="empty-state-title">No Matching Sessions Found</h3>
          <p class="empty-state-desc">
            No driver monitoring sessions match your active date, warning type, or search filter.
          </p>
          <button class="btn btn-secondary" id="reports-reset-filter-btn">
            Reset Filters
          </button>
        </div>
      `;
    }

    return `
      <div class="sessions-table-wrapper">
        <table class="sessions-table">
          <thead>
            <tr>
              <th>Session ID & Timestamp</th>
              <th>Sensor Mode</th>
              <th>Duration</th>
              <th>Alert Events</th>
              <th>Avg EAR</th>
              <th>Safety Rating</th>
              <th style="text-align: right;">Export &amp; Details</th>
            </tr>
          </thead>
          <tbody>
            ${sessions
              .map((sess) => {
                const grade = sess.warningEventsCount === 0 ? "Grade A (Optimal)" : sess.warningEventsCount <= 2 ? "Grade B (Moderate)" : "Grade C (Fatigued)";
                const gradeBadge = sess.warningEventsCount === 0 ? "badge-safe" : sess.warningEventsCount <= 2 ? "badge-warn" : "badge-danger";
                return `
                <tr>
                  <td>
                    <div class="session-name-cell">
                      <div class="metric-tile-icon" style="width: 28px; height: 28px; flex-shrink: 0;">${ICONS.shieldCheck}</div>
                      <div>
                        <div>${formatDateTime(sess.startTime)}</div>
                        <span style="font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono);">${sess.id}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="session-type-badge ${sess.isSample ? 'sample' : 'real'}">
                      ${sess.isSample ? 'Benchmark Simulation' : 'Live Camera'}
                    </span>
                  </td>
                  <td class="tabular-nums"><strong>${formatDuration(sess.durationSeconds)}</strong></td>
                  <td>
                    <span class="badge ${sess.warningEventsCount > 0 ? 'badge-danger' : 'badge-safe'} tabular-nums">
                      ${sess.warningEventsCount} ${sess.warningEventsCount === 1 ? 'alert' : 'alerts'}
                    </span>
                  </td>
                  <td class="tabular-nums">${sess.avgEar || 0.28}</td>
                  <td>
                    <span class="badge ${gradeBadge}">
                      <span class="badge-dot"></span> ${grade}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
                      <button class="btn btn-secondary btn-sm inspect-session-btn" data-id="${sess.id}" title="Inspect complete session report">
                        Inspect
                      </button>
                      <button class="btn btn-secondary btn-sm export-row-csv-btn" data-id="${sess.id}" title="Download CSV for this session">
                        CSV
                      </button>
                      <button class="btn btn-secondary btn-sm export-row-pdf-btn" data-id="${sess.id}" title="Download PDF for this session">
                        PDF
                      </button>
                    </div>
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

  // Bind Toolbar Filters
  const dateSelect = container.querySelector("#report-date-select");
  if (dateSelect) {
    dateSelect.addEventListener("change", (e) => {
      currentDateFilter = e.target.value;
      appState.setPage("reports");
    });
  }

  const warningSelect = container.querySelector("#report-warning-select");
  if (warningSelect) {
    warningSelect.addEventListener("change", (e) => {
      currentWarningFilter = e.target.value;
      appState.setPage("reports");
    });
  }

  const modeSelect = container.querySelector("#report-mode-select");
  if (modeSelect) {
    modeSelect.addEventListener("change", (e) => {
      currentModeFilter = e.target.value;
      appState.setPage("reports");
    });
  }

  const searchInput = container.querySelector("#report-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearchQuery = e.target.value;
      // Re-filter and update table in-place for fluid typing
      const freshFiltered = allSessions.filter((s) => {
        if (currentModeFilter === "real" && s.isSample) return false;
        if (currentModeFilter === "sample" && !s.isSample) return false;

        if (currentDateFilter !== "all") {
          const sessionTime = new Date(s.startTime).getTime();
          const now = Date.now();
          if (currentDateFilter === "today") {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            if (sessionTime < todayStart.getTime()) return false;
          } else if (currentDateFilter === "7d") {
            if (now - sessionTime > 7 * 24 * 3600 * 1000) return false;
          } else if (currentDateFilter === "30d") {
            if (now - sessionTime > 30 * 24 * 3600 * 1000) return false;
          }
        }

        if (currentWarningFilter === "clean") {
          if ((s.warningEventsCount || 0) > 0) return false;
        } else if (currentWarningFilter === "warnings") {
          if ((s.warningEventsCount || 0) === 0) return false;
        } else if (currentWarningFilter === "closure") {
          const hasClosure = Array.isArray(s.events) && s.events.some((ev) => ev.type === "ALERT" || (ev.typeLabel && ev.typeLabel.toLowerCase().includes("closure")));
          if (!hasClosure) return false;
        } else if (currentWarningFilter === "yawn") {
          const hasYawn = Array.isArray(s.events) && s.events.some((ev) => ev.type === "YAWN_DETECTED" || (ev.typeLabel && ev.typeLabel.toLowerCase().includes("yawn")));
          if (!hasYawn) return false;
        } else if (currentWarningFilter === "nod") {
          const hasNod = Array.isArray(s.events) && s.events.some((ev) => ev.type === "HEAD_DROP" || ev.type === "DROWSY_NOD_OFF" || (ev.typeLabel && ev.typeLabel.toLowerCase().includes("head")));
          if (!hasNod) return false;
        }

        if (currentSearchQuery.trim()) {
          const q = currentSearchQuery.trim().toLowerCase();
          const matchId = (s.id || "").toLowerCase().includes(q);
          const matchNotes = (s.notes || "").toLowerCase().includes(q);
          const matchDate = formatDateTime(s.startTime).toLowerCase().includes(q);
          if (!matchId && !matchNotes && !matchDate) return false;
        }

        return true;
      });

      const sessionsCard = container.querySelector(".sessions-card");
      if (sessionsCard) {
        sessionsCard.innerHTML = renderSessionsTableSection(freshFiltered, allSessions.length);
        bindTableButtons();
      }
    });
  }

  // Export All CSV
  const exportAllCsvBtn = container.querySelector("#export-all-csv-btn");
  if (exportAllCsvBtn) {
    exportAllCsvBtn.addEventListener("click", () => {
      exportAllSessionsToCSV(filteredSessions);
    });
  }

  // Export All PDF
  const exportAllPdfBtn = container.querySelector("#export-all-pdf-btn");
  if (exportAllPdfBtn) {
    exportAllPdfBtn.addEventListener("click", () => {
      exportAllSessionsToPDF(filteredSessions);
    });
  }

  // Print Report
  const printBtn = container.querySelector("#print-report-btn");
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }

  // Clear History Option with Confirmation
  const clearBtn = container.querySelector("#clear-history-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      showConfirmModal({
        title: "Clear All Session History?",
        message: "Are you sure you want to delete all saved monitoring logs and audit reports? This action will permanently remove all stored session records from your browser.",
        confirmText: "Delete History",
        isDanger: true,
        onConfirm: () => {
          appState.clearSessions();
          showToast("History Purged", "All saved session records deleted cleanly.", "safe");
          appState.setPage("reports");
        }
      });
    });
  }

  // Empty State CTA & Reset Filters
  const startNowBtn = container.querySelector("#reports-start-now-btn");
  if (startNowBtn) {
    startNowBtn.addEventListener("click", () => {
      appState.setPage("live");
    });
  }

  const resetFilterBtn = container.querySelector("#reports-reset-filter-btn");
  if (resetFilterBtn) {
    resetFilterBtn.addEventListener("click", () => {
      currentDateFilter = "all";
      currentWarningFilter = "all";
      currentModeFilter = "all";
      currentSearchQuery = "";
      appState.setPage("reports");
    });
  }

  function bindTableButtons() {
    // Inspect Details Modal
    container.querySelectorAll(".inspect-session-btn").forEach((btn) => {
      btn.onclick = () => {
        const sessionId = btn.dataset.id;
        const session = allSessions.find((s) => s.id === sessionId);
        if (session) {
          openSessionDetailsModal(session);
        }
      };
    });

    // Row CSV export
    container.querySelectorAll(".export-row-csv-btn").forEach((btn) => {
      btn.onclick = () => {
        const sessionId = btn.dataset.id;
        const session = allSessions.find((s) => s.id === sessionId);
        if (session) {
          exportSessionToCSV(session);
        }
      };
    });

    // Row PDF export
    container.querySelectorAll(".export-row-pdf-btn").forEach((btn) => {
      btn.onclick = () => {
        const sessionId = btn.dataset.id;
        const session = allSessions.find((s) => s.id === sessionId);
        if (session) {
          exportSessionToPDF(session);
        }
      };
    });
  }

  bindTableButtons();

  return container;
}
