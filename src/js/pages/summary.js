/* ==========================================================================
   PAGE 3: SESSION SUMMARY
   Strictly essential: Actual monitoring duration, actual number of possible
   drowsiness events, event timestamps (only when real events recorded),
   and one "Start New Session" button. No repeated or duplicate data.
   ========================================================================== */

import { ICONS, formatDuration } from "../utils.js";
import { appState } from "../state.js";

export function renderSummaryPage() {
  const container = document.createElement("div");
  container.className = "summary-clean-container fade-in";

  const allSessions = appState.sessions || [];
  const currentSession = appState.lastCompletedSession || allSessions[0] || null;

  // When no session exists
  if (!currentSession && allSessions.length === 0) {
    container.innerHTML = `
      <div class="summary-card empty-card">
        <div class="empty-icon-circle">
          ${ICONS.info}
        </div>
        <h2 class="empty-title">No monitoring session yet.</h2>
        <p class="empty-desc">
          Start a monitoring session to view actual duration and drowsiness events here.
        </p>
        <button class="btn btn-primary btn-lg" id="summary-new-session-btn">
          ${ICONS.play} Start Monitoring
        </button>
      </div>
    `;

    const startBtn = container.querySelector("#summary-new-session-btn");
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

  container.innerHTML = `
    <div class="summary-card">
      <div class="summary-header">
        <h1 class="summary-title">Session Summary</h1>
      </div>

      <!-- Actual Duration & Actual Event Count -->
      <div class="summary-metrics-grid">
        <div class="summary-metric-tile">
          <div class="metric-label">Actual Monitoring Duration</div>
          <div class="metric-val tabular-nums">${durationStr}</div>
        </div>

        <div class="summary-metric-tile">
          <div class="metric-label">Possible Drowsiness Events</div>
          <div class="metric-val tabular-nums ${warningCount > 0 ? 'val-danger' : 'val-safe'}">
            ${warningCount}
          </div>
        </div>
      </div>

      <!-- Event Timestamps (Only shown when real events have been recorded) -->
      ${
        events.length > 0
          ? `
        <div class="summary-events-section">
          <h2 class="section-title">Event Timestamps</h2>
          <div class="events-table-wrapper">
            <table class="events-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event</th>
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
        </div>
      `
          : `
        <div class="no-events-note">
          <span class="note-check-icon">${ICONS.check}</span>
          <span>No drowsiness events were recorded during this session.</span>
        </div>
      `
      }

      <!-- One Start New Session Button -->
      <div class="summary-action-wrapper">
        <button class="btn btn-primary btn-lg" id="summary-new-session-btn">
          ${ICONS.play} Start New Session
        </button>
      </div>
    </div>
  `;

  // Start New Session handler
  const newSessionBtn = container.querySelector("#summary-new-session-btn");
  if (newSessionBtn) {
    newSessionBtn.onclick = () => {
      appState.setPage("live");
    };
  }

  return container;
}
