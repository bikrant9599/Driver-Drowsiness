/* ==========================================================================
   PAGE 3: SESSION SUMMARY
   Clean, honest summary of monitoring results with event timestamps
   ========================================================================== */

import { ICONS, formatDuration, formatDateTime, showConfirmModal } from "../utils.js";
import { appState } from "../state.js";

export function renderSummaryPage() {
  const container = document.createElement("div");
  container.className = "summary-clean-container fade-in";

  const allSessions = appState.sessions || [];
  const currentSession = appState.lastCompletedSession || allSessions[0] || null;

  if (!currentSession && allSessions.length === 0) {
    // Empty state when no monitoring has taken place yet
    container.innerHTML = `
      <div class="summary-card empty-card">
        <div class="empty-icon-circle">
          ${ICONS.info}
        </div>
        <h2 class="empty-title">No monitoring session yet.</h2>
        <p class="empty-desc">
          Complete a live monitoring session to see total duration, drowsiness events, and timestamps here.
        </p>
        <button class="btn btn-primary btn-lg" id="summary-start-btn">
          ${ICONS.play} Start Monitoring
        </button>
      </div>
    `;

    const startBtn = container.querySelector("#summary-start-btn");
    if (startBtn) {
      startBtn.onclick = () => {
        appState.setPage("live");
      };
    }
    return container;
  }

  const durationStr = formatDuration(currentSession ? currentSession.durationSeconds : 0);
  const events = (currentSession && Array.isArray(currentSession.events)) ? currentSession.events : [];
  const warningCount = currentSession ? (currentSession.warningEventsCount || events.length) : 0;
  const sessionTimeStr = currentSession ? formatDateTime(currentSession.startTime) : "";

  container.innerHTML = `
    <div class="summary-card">
      <div class="summary-header">
        <div>
          <h1 class="summary-title">Session Summary</h1>
          <div class="summary-subtitle">Session recorded on ${sessionTimeStr}</div>
        </div>
        <button class="btn btn-primary btn-lg" id="summary-new-session-btn">
          ${ICONS.play} Start New Session
        </button>
      </div>

      <!-- Core Metrics: Total Duration & Drowsiness Events -->
      <div class="summary-metrics-grid">
        <div class="summary-metric-tile">
          <div class="metric-label">Total Monitoring Duration</div>
          <div class="metric-val tabular-nums">${durationStr}</div>
        </div>

        <div class="summary-metric-tile">
          <div class="metric-label">Possible Drowsiness Events</div>
          <div class="metric-val tabular-nums ${warningCount > 0 ? 'val-danger' : 'val-safe'}">
            ${warningCount}
          </div>
        </div>
      </div>

      <!-- Event Timestamps Section -->
      <div class="summary-events-section">
        <h2 class="section-title">Event Timestamps</h2>
        ${
          events.length === 0
            ? `
          <div class="no-events-banner">
            <span class="no-events-icon">${ICONS.check}</span>
            <div>
              <strong>No Warnings Detected</strong>
              <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">
                The driver remained alert with no prolonged eye closures detected during this session.
              </div>
            </div>
          </div>
        `
            : `
          <div class="events-table-wrapper">
            <table class="events-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Detection Event</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                ${events
                  .map(
                    (ev) => `
                  <tr>
                    <td class="tabular-nums" style="font-weight: 600;">${ev.timestamp}</td>
                    <td>
                      <span class="event-pill">
                        ${ev.typeLabel || "Prolonged Eye Closure"}
                      </span>
                    </td>
                    <td class="tabular-nums">${ev.duration || "—"}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `
        }
      </div>

      <!-- Small Session History Section -->
      ${
        allSessions.length > 0
          ? `
        <div class="summary-history-section">
          <div class="history-header">
            <h2 class="section-title">Session History</h2>
            <button class="btn btn-secondary btn-sm" id="summary-clear-history-btn">
              ${ICONS.trash} Clear History
            </button>
          </div>

          <div class="history-table-wrapper">
            <table class="history-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Duration</th>
                  <th>Drowsiness Events</th>
                </tr>
              </thead>
              <tbody>
                ${allSessions
                  .slice(0, 10)
                  .map(
                    (s) => `
                  <tr>
                    <td>${formatDateTime(s.startTime)}</td>
                    <td class="tabular-nums">${formatDuration(s.durationSeconds)}</td>
                    <td class="tabular-nums" style="color: ${s.warningEventsCount > 0 ? 'var(--status-danger)' : 'var(--status-safe)'}; font-weight: 600;">
                      ${s.warningEventsCount || 0}
                    </td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;

  // Start New Session button handler
  const newSessionBtn = container.querySelector("#summary-new-session-btn");
  if (newSessionBtn) {
    newSessionBtn.onclick = () => {
      appState.setPage("live");
    };
  }

  // Clear History button handler
  const clearBtn = container.querySelector("#summary-clear-history-btn");
  if (clearBtn) {
    clearBtn.onclick = () => {
      showConfirmModal({
        title: "Clear Session History",
        message: "Are you sure you want to clear your saved session history? This action cannot be undone.",
        confirmText: "Clear All",
        isDanger: true,
        onConfirm: () => {
          appState.clearSessions();
          // Re-render summary page
          const mount = document.getElementById("main-content-mount");
          if (mount) {
            mount.innerHTML = "";
            mount.appendChild(renderSummaryPage());
          }
        }
      });
    };
  }

  return container;
}
