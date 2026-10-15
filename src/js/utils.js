/* ==========================================================================
   UTILITIES: ICONS, TOASTS, MODALS, FORMATTERS, EXPORT
   ========================================================================== */

export const ICONS = {
  logo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="3"/><path d="M7 11c0 3 5 5 5 5s5-2 5-5"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-.722-3.25"/><path d="M2 8a10.645 10.645 0 0 0 20 0"/><path d="m20 15-1.726-2.05"/><path d="m4 15 1.726-2.05"/><path d="m9 18 .722-3.25"/></svg>`,
  reports: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
  alertTriangle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
  bellOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5"/><path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,
  shieldCheck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/></svg>`,
  stop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="5" y="5" rx="2"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
  volume2: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  cpu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  gauge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>`
};

/* Format seconds into HH:MM:SS */
export function formatDuration(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  const pad = (n) => String(n).padStart(2, "0");
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/* Format Date nicely */
export function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

/* Toast Notifications */
export function showToast(title, message, type = "info", duration = 4000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let iconSvg = ICONS.info;
  if (type === "danger") iconSvg = ICONS.alertTriangle;
  if (type === "safe") iconSvg = ICONS.shieldCheck;

  toast.innerHTML = `
    <div class="toast-icon">${iconSvg}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" aria-label="Close">${ICONS.close}</button>
  `;

  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => toast.remove());

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(40px)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }
}

/* Confirmation Modal Helper */
export function showConfirmModal({ title, message, confirmText = "Confirm", cancelText = "Cancel", isDanger = false, onConfirm }) {
  let overlay = document.getElementById("global-modal-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "global-modal-overlay";
    overlay.className = "modal-overlay";
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <div class="modal-title">${isDanger ? ICONS.alertTriangle : ICONS.info} <span>${title}</span></div>
        <button class="modal-close-btn" id="modal-cancel-x">${ICONS.close}</button>
      </div>
      <div class="modal-body">${message}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modal-cancel-btn">${cancelText}</button>
        <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm-btn">${confirmText}</button>
      </div>
    </div>
  `;

  overlay.classList.add("open");

  const close = () => {
    overlay.classList.remove("open");
  };

  overlay.querySelector("#modal-cancel-x").onclick = close;
  overlay.querySelector("#modal-cancel-btn").onclick = close;
  overlay.querySelector("#modal-confirm-btn").onclick = () => {
    close();
    if (typeof onConfirm === "function") onConfirm();
  };
  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };
}

/* Generic Modal Helper */
export function showContentModal({ title, contentHtml, maxWidth = "560px" }) {
  let overlay = document.getElementById("global-modal-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "global-modal-overlay";
    overlay.className = "modal-overlay";
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="modal-dialog" style="max-width: ${maxWidth};">
      <div class="modal-header">
        <div class="modal-title">${title}</div>
        <button class="modal-close-btn" id="modal-content-close">${ICONS.close}</button>
      </div>
      <div class="modal-body">${contentHtml}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modal-content-done">Close</button>
      </div>
    </div>
  `;

  overlay.classList.add("open");

  const close = () => overlay.classList.remove("open");
  overlay.querySelector("#modal-content-close").onclick = close;
  overlay.querySelector("#modal-content-done").onclick = close;
  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };
}

/**
 * Open detailed inspection modal for a session with statistics, timeline, and export actions
 */
export function openSessionDetailsModal(session) {
  if (!session) return;

  const eventsList = session.events && session.events.length > 0
    ? session.events
        .map(
          (ev, idx) => `
          <div class="timeline-item">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="timeline-time">${ev.timestamp}</span>
              <div>
                <strong>${ev.typeLabel || (ev.type === 'ALERT' ? 'Prolonged Eye Closure' : ev.type.replace(/_/g, ' '))}</strong>
                <div style="font-size: 0.725rem; color: var(--text-muted);">Duration: ${ev.duration} &bull; EAR: ${ev.ear !== undefined ? ev.ear : '-'} &bull; MAR: ${ev.mar !== undefined ? ev.mar : '-'}</div>
              </div>
            </div>
            <span class="badge ${ev.severity === 'Critical' ? 'badge-danger' : ev.severity === 'Caution' ? 'badge-warn' : 'badge-danger'}">${ev.severity || 'Warning'}</span>
          </div>
        `
        )
        .join("")
    : `<p style="text-align: center; color: var(--text-muted); padding: 1.5rem 0;">No drowsiness incidents or prolonged eye closures recorded during this transit session.</p>`;

  const grade = session.warningEventsCount === 0 ? "Grade A (Optimal)" : session.warningEventsCount <= 2 ? "Grade B (Moderate)" : "Grade C (Fatigued)";
  const gradeColor = session.warningEventsCount === 0 ? "#10b981" : session.warningEventsCount <= 2 ? "#f59e0b" : "#ef4444";

  const modalHtml = `
    <div class="report-modal-content">
      <div class="session-stat-pills" style="grid-template-columns: repeat(4, 1fr);">
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
          <div class="val" style="color: ${gradeColor}; font-size: 1rem; padding-top: 0.25rem;">${grade}</div>
          <div class="lbl">Safety Grade</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.825rem; background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.875rem;">
        <div><strong>Session ID:</strong> <span style="font-family: var(--font-mono); color: var(--text-muted);">${session.id}</span></div>
        <div><strong>Classification:</strong> ${session.isSample ? 'Benchmark Simulation' : 'Live Camera Hardware'}</div>
        <div><strong>Start Time:</strong> ${formatDateTime(session.startTime)}</div>
        <div><strong>End Time:</strong> ${session.endTime ? formatDateTime(session.endTime) : 'N/A'}</div>
        <div><strong>Yawns Counted:</strong> ${session.yawnCount || 0}</div>
        <div><strong>Blinks Counted:</strong> ${session.blinkCount || 0}</div>
      </div>

      <div>
        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 0.5rem;">${ICONS.alertTriangle} Chronological Event History (${session.warningEventsCount})</span>
        </h4>
        <div class="events-timeline">
          ${eventsList}
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--border-subtle);">
        <button class="btn btn-secondary btn-sm" id="modal-export-csv-btn">
          ${ICONS.download} Download CSV
        </button>
        <button class="btn btn-primary btn-sm" id="modal-export-pdf-btn">
          ${ICONS.download} Download PDF
        </button>
      </div>
    </div>
  `;

  showContentModal({
    title: `Session Report: ${session.notes || session.id}`,
    contentHtml: modalHtml,
    maxWidth: "620px"
  });

  const overlay = document.getElementById("global-modal-overlay");
  if (overlay) {
    const csvBtn = overlay.querySelector("#modal-export-csv-btn");
    if (csvBtn) {
      csvBtn.onclick = () => exportSessionToCSV(session);
    }
    const pdfBtn = overlay.querySelector("#modal-export-pdf-btn");
    if (pdfBtn) {
      pdfBtn.onclick = () => exportSessionToPDF(session);
    }
  }
}

import { jsPDF } from "jspdf";

/* Export data to CSV */
export function exportToCSV(filename, rows) {
  if (!rows || !rows.length) {
    showToast("Export Failed", "No data available to export", "warn");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map(row => headers.map(header => {
      let val = row[header] === null || row[header] === undefined ? "" : String(row[header]);
      if (val.includes(",") || val.includes("\"") || val.includes("\n")) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(","))
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("Report Exported", `Downloaded ${filename}.csv`, "safe");
}

/* Export data to JSON */
export function exportToJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("Report Exported", `Downloaded ${filename}.json`, "safe");
}

/**
 * Functional CSV export for a single monitoring session with all required fields:
 * Session ID, start/end times, monitoring duration, warning count, timestamps, types, durations
 */
export function exportSessionToCSV(session) {
  if (!session) {
    showToast("Export Failed", "No session data to export", "warn");
    return;
  }
  const filename = `vigildrive_session_${session.id}`;

  let rows = [];
  if (session.events && session.events.length > 0) {
    rows = session.events.map((ev, index) => ({
      Session_ID: session.id,
      Session_Type: session.isSample ? "Benchmark Simulation" : "Live Camera Hardware",
      Session_Start_Time: session.startTime,
      Session_End_Time: session.endTime || "N/A",
      Monitoring_Duration: formatDuration(session.durationSeconds),
      Duration_Seconds: session.durationSeconds,
      Total_Warnings_Count: session.warningEventsCount,
      Event_Index: index + 1,
      Warning_Timestamp: ev.timestamp,
      Warning_Type: ev.typeLabel || ev.type,
      Detection_Duration: ev.duration || "N/A",
      EAR_Value: ev.ear !== undefined ? ev.ear : "N/A",
      MAR_Value: ev.mar !== undefined ? ev.mar : "N/A",
      Severity: ev.severity || "Warning"
    }));
  } else {
    rows = [{
      Session_ID: session.id,
      Session_Type: session.isSample ? "Benchmark Simulation" : "Live Camera Hardware",
      Session_Start_Time: session.startTime,
      Session_End_Time: session.endTime || "N/A",
      Monitoring_Duration: formatDuration(session.durationSeconds),
      Duration_Seconds: session.durationSeconds,
      Total_Warnings_Count: 0,
      Event_Index: "N/A",
      Warning_Timestamp: "None",
      Warning_Type: "None (Clean Attentive Session)",
      Detection_Duration: "0.0s",
      EAR_Value: session.avgEar || 0.28,
      MAR_Value: "N/A",
      Severity: "Optimal"
    }];
  }

  exportToCSV(filename, rows);
}

/**
 * Functional CSV export for all monitoring sessions with detailed event records
 */
export function exportAllSessionsToCSV(sessions) {
  if (!sessions || sessions.length === 0) {
    showToast("Export Failed", "No session records available to export", "warn");
    return;
  }
  const filename = `vigildrive_all_sessions_${Date.now()}`;
  const rows = [];

  sessions.forEach((session) => {
    if (session.events && session.events.length > 0) {
      session.events.forEach((ev, idx) => {
        rows.push({
          Session_ID: session.id,
          Session_Type: session.isSample ? "Benchmark Simulation" : "Live Camera Hardware",
          Session_Start_Time: session.startTime,
          Session_End_Time: session.endTime || "N/A",
          Monitoring_Duration: formatDuration(session.durationSeconds),
          Duration_Seconds: session.durationSeconds,
          Total_Warnings_Count: session.warningEventsCount,
          Event_Index: idx + 1,
          Warning_Timestamp: ev.timestamp,
          Warning_Type: ev.typeLabel || ev.type,
          Detection_Duration: ev.duration || "N/A",
          EAR_Value: ev.ear !== undefined ? ev.ear : "N/A",
          MAR_Value: ev.mar !== undefined ? ev.mar : "N/A",
          Severity: ev.severity || "Warning"
        });
      });
    } else {
      rows.push({
        Session_ID: session.id,
        Session_Type: session.isSample ? "Benchmark Simulation" : "Live Camera Hardware",
        Session_Start_Time: session.startTime,
        Session_End_Time: session.endTime || "N/A",
        Monitoring_Duration: formatDuration(session.durationSeconds),
        Duration_Seconds: session.durationSeconds,
        Total_Warnings_Count: 0,
        Event_Index: "N/A",
        Warning_Timestamp: "None",
        Warning_Type: "None (Clean Attentive Session)",
        Detection_Duration: "0.0s",
        EAR_Value: session.avgEar || 0.28,
        MAR_Value: "N/A",
        Severity: "Optimal"
      });
    }
  });

  exportToCSV(filename, rows);
}

/**
 * Generates and downloads a clean, professional PDF telematics report for a single session
 */
export function exportSessionToPDF(session) {
  if (!session) {
    showToast("Export Failed", "No session data to export", "warn");
    return;
  }

  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = 18;

    // Header Background
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 26, "F");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("VIGILDRIVE AI — DRIVER DROWSINESS TELEMATICS REPORT", 14, 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("Automotive Biometric Telemetry & Drowsiness Incident Audit Log", 14, 18);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 18, { align: "right" });

    currentY = 34;

    // Session Overview Card
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(14, currentY, pageWidth - 28, 48, 2.5, 2.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Session Metadata & Biometric Summary", 20, currentY + 7);

    // Columns of metadata
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);

    const col1X = 20;
    const col2X = 82;
    const col3X = 142;
    let metaY = currentY + 15;

    // Col 1
    doc.text("Session ID:", col1X, metaY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(String(session.id), col1X + 22, metaY);

    metaY += 6.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Start Time:", col1X, metaY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(formatDateTime(session.startTime), col1X + 22, metaY);

    metaY += 6.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("End Time:", col1X, metaY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(session.endTime ? formatDateTime(session.endTime) : "N/A", col1X + 22, metaY);

    metaY += 6.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Duration:", col1X, metaY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`${formatDuration(session.durationSeconds)} (${session.durationSeconds}s)`, col1X + 22, metaY);

    // Col 2
    metaY = currentY + 15;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Session Mode:", col2X, metaY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(session.isSample ? "Benchmark Simulation" : "Live Camera Hardware", col2X + 24, metaY);

    metaY += 6.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Average EAR:", col2X, metaY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(String(session.avgEar || 0.28), col2X + 24, metaY);

    metaY += 6.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Yawns Counted:", col2X, metaY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(String(session.yawnCount || 0), col2X + 24, metaY);

    metaY += 6.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Blinks Counted:", col2X, metaY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(String(session.blinkCount || 0), col2X + 24, metaY);

    // Col 3
    metaY = currentY + 15;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Total Warnings:", col3X, metaY);
    doc.setFont("helvetica", "bold");
    const warnColor = session.warningEventsCount > 0 ? [220, 38, 38] : [16, 185, 129];
    doc.setTextColor(warnColor[0], warnColor[1], warnColor[2]);
    doc.text(String(session.warningEventsCount), col3X + 26, metaY);

    metaY += 6.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Safety Rating:", col3X, metaY);
    doc.setFont("helvetica", "bold");
    const grade = session.warningEventsCount === 0 ? "Grade A (Optimal)" : session.warningEventsCount <= 2 ? "Grade B (Moderate)" : "Grade C (Fatigued)";
    doc.setTextColor(warnColor[0], warnColor[1], warnColor[2]);
    doc.text(grade, col3X + 26, metaY);

    metaY += 6.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Transit Status:", col3X, metaY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(session.status || "Completed", col3X + 26, metaY);

    currentY += 56;

    // Chronological Incident History Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Chronological Event History (${session.warningEventsCount} recorded warnings)`, 14, currentY);

    currentY += 4.5;

    // Events Table Header
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(14, currentY, pageWidth - 28, 7.5, "F");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);

    const thIdx = 17;
    const thTime = 26;
    const thType = 54;
    const thDur = 114;
    const thEar = 138;
    const thMar = 158;
    const thSev = 178;

    doc.text("#", thIdx, currentY + 5);
    doc.text("Timestamp", thTime, currentY + 5);
    doc.text("Incident Classification", thType, currentY + 5);
    doc.text("Duration", thDur, currentY + 5);
    doc.text("EAR", thEar, currentY + 5);
    doc.text("MAR", thMar, currentY + 5);
    doc.text("Severity", thSev, currentY + 5);

    currentY += 7.5;

    const events = session.events && session.events.length > 0 ? session.events : [];

    if (events.length === 0) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.rect(14, currentY, pageWidth - 28, 12, "FD");

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text("No drowsiness warnings or prolonged eye closures recorded. Optimal driver vigilance maintained.", 20, currentY + 7.5);
      currentY += 16;
    } else {
      events.forEach((ev, idx) => {
        // Page overflow protection
        if (currentY > pageHeight - 26) {
          doc.addPage();
          currentY = 16;

          // Redraw table header
          doc.setFillColor(30, 41, 59);
          doc.rect(14, currentY, pageWidth - 28, 7.5, "F");
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(255, 255, 255);
          doc.text("#", thIdx, currentY + 5);
          doc.text("Timestamp", thTime, currentY + 5);
          doc.text("Incident Classification", thType, currentY + 5);
          doc.text("Duration", thDur, currentY + 5);
          doc.text("EAR", thEar, currentY + 5);
          doc.text("MAR", thMar, currentY + 5);
          doc.text("Severity", thSev, currentY + 5);
          currentY += 7.5;
        }

        const isAlt = idx % 2 === 1;
        doc.setFillColor(isAlt ? 248 : 255, isAlt ? 250 : 255, isAlt ? 252 : 255);
        doc.setDrawColor(226, 232, 240);
        doc.rect(14, currentY, pageWidth - 28, 7, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);

        doc.text(String(idx + 1), thIdx, currentY + 4.8);
        doc.text(String(ev.timestamp || "-"), thTime, currentY + 4.8);

        const typeStr = ev.typeLabel || (ev.type === "ALERT" ? "Prolonged Eye Closure" : ev.type.replace(/_/g, " "));
        doc.text(typeStr.substring(0, 36), thType, currentY + 4.8);

        doc.text(String(ev.duration || "-"), thDur, currentY + 4.8);
        doc.text(ev.ear !== undefined ? String(ev.ear) : "-", thEar, currentY + 4.8);
        doc.text(ev.mar !== undefined ? String(ev.mar) : "-", thMar, currentY + 4.8);

        if (ev.severity === "Critical") {
          doc.setTextColor(220, 38, 38);
          doc.setFont("helvetica", "bold");
        } else if (ev.severity === "Caution") {
          doc.setTextColor(217, 119, 6);
          doc.setFont("helvetica", "normal");
        } else {
          doc.setTextColor(234, 88, 12);
          doc.setFont("helvetica", "normal");
        }
        doc.text(String(ev.severity || "Warning"), thSev, currentY + 4.8);

        currentY += 7;
      });
      currentY += 6;
    }

    // Telematics & Privacy Compliance Footer
    const footerY = Math.max(currentY + 6, pageHeight - 20);
    doc.setDrawColor(203, 213, 225);
    doc.line(14, footerY, pageWidth - 14, footerY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("Compliance Notice: Biometric telematics computed on local edge client in real-time. Video streams & facial imagery", 14, footerY + 4.5);
    doc.text("are never saved or transmitted, strictly adhering to biometric privacy standards. VigilDrive AI System.", 14, footerY + 8);
    doc.text("Automotive Safety Audit v1.0", pageWidth - 14, footerY + 8, { align: "right" });

    doc.save(`vigildrive_report_${session.id}.pdf`);
    showToast("PDF Exported", `Downloaded report for ${session.id}`, "safe");
  } catch (err) {
    console.error("PDF export failed:", err);
    showToast("PDF Export Error", "Failed to generate PDF document.", "danger");
  }
}

/**
 * Generates and downloads a multi-session fleet summary PDF report
 */
export function exportAllSessionsToPDF(sessions) {
  if (!sessions || sessions.length === 0) {
    showToast("Export Failed", "No session records to export", "warn");
    return;
  }

  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = 18;

    // Header Background
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 26, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("VIGILDRIVE AI — CUMULATIVE TELEMATICS FLEET REPORT", 14, 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Consolidated Driver Monitoring History & Incident Audit Summary", 14, 18);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 18, { align: "right" });

    currentY = 34;

    // Aggregate statistics
    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
    const totalWarnings = sessions.reduce((acc, s) => acc + (s.warningEventsCount || 0), 0);
    const cleanSessions = sessions.filter((s) => s.warningEventsCount === 0).length;
    const cleanRate = totalSessions > 0 ? Math.round((cleanSessions / totalSessions) * 100) : 100;

    // KPI Cards
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, pageWidth - 28, 24, 2, 2, "FD");

    const kpiColWidth = (pageWidth - 28) / 4;
    const kpis = [
      { label: "TOTAL SESSIONS", val: String(totalSessions) },
      { label: "TOTAL TIME", val: formatDuration(totalDuration) },
      { label: "TOTAL WARNINGS", val: String(totalWarnings) },
      { label: "CLEAN TRANSIT RATE", val: `${cleanRate}%` }
    ];

    kpis.forEach((kpi, idx) => {
      const kX = 14 + idx * kpiColWidth + 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, kX, currentY + 8);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(kpi.val, kX, currentY + 17);
    });

    currentY += 32;

    // Sessions Table Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`All Logged Monitoring Sessions (${totalSessions} sessions)`, 14, currentY);

    currentY += 4.5;

    doc.setFillColor(30, 41, 59);
    doc.rect(14, currentY, pageWidth - 28, 7.5, "F");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);

    const sIdX = 17;
    const sDateX = 52;
    const sDurX = 98;
    const sWarnX = 126;
    const sEarX = 148;
    const sModeX = 168;

    doc.text("Session ID", sIdX, currentY + 5);
    doc.text("Date & Start Time", sDateX, currentY + 5);
    doc.text("Duration", sDurX, currentY + 5);
    doc.text("Warnings", sWarnX, currentY + 5);
    doc.text("Avg EAR", sEarX, currentY + 5);
    doc.text("Safety Grade", sModeX, currentY + 5);

    currentY += 7.5;

    sessions.forEach((s, idx) => {
      if (currentY > pageHeight - 24) {
        doc.addPage();
        currentY = 16;
        doc.setFillColor(30, 41, 59);
        doc.rect(14, currentY, pageWidth - 28, 7.5, "F");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("Session ID", sIdX, currentY + 5);
        doc.text("Date & Start Time", sDateX, currentY + 5);
        doc.text("Duration", sDurX, currentY + 5);
        doc.text("Warnings", sWarnX, currentY + 5);
        doc.text("Avg EAR", sEarX, currentY + 5);
        doc.text("Safety Grade", sModeX, currentY + 5);
        currentY += 7.5;
      }

      const isAlt = idx % 2 === 1;
      doc.setFillColor(isAlt ? 248 : 255, isAlt ? 250 : 255, isAlt ? 252 : 255);
      doc.setDrawColor(226, 232, 240);
      doc.rect(14, currentY, pageWidth - 28, 7, "FD");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);

      doc.text(String(s.id).substring(0, 18), sIdX, currentY + 4.8);
      doc.text(formatDateTime(s.startTime), sDateX, currentY + 4.8);
      doc.text(formatDuration(s.durationSeconds), sDurX, currentY + 4.8);

      const warnColor = s.warningEventsCount > 0 ? [220, 38, 38] : [16, 185, 129];
      doc.setTextColor(warnColor[0], warnColor[1], warnColor[2]);
      doc.setFont("helvetica", "bold");
      doc.text(String(s.warningEventsCount), sWarnX, currentY + 4.8);

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "normal");
      doc.text(String(s.avgEar || 0.28), sEarX, currentY + 4.8);

      const grade = s.warningEventsCount === 0 ? "Grade A" : s.warningEventsCount <= 2 ? "Grade B" : "Grade C";
      doc.setTextColor(warnColor[0], warnColor[1], warnColor[2]);
      doc.text(grade, sModeX, currentY + 4.8);

      currentY += 7;
    });

    const footerY = Math.max(currentY + 6, pageHeight - 18);
    doc.setDrawColor(203, 213, 225);
    doc.line(14, footerY, pageWidth - 14, footerY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("Compliance Notice: All telemetry data is stored locally. No facial images or video streams stored.", 14, footerY + 5);
    doc.text("VigilDrive AI Telematics Audit Log", pageWidth - 14, footerY + 5, { align: "right" });

    doc.save(`vigildrive_fleet_audit_${Date.now()}.pdf`);
    showToast("PDF Exported", `Downloaded fleet audit summary`, "safe");
  } catch (err) {
    console.error("Multi-session PDF export failed:", err);
    showToast("PDF Export Error", "Failed to generate fleet PDF.", "danger");
  }
}
