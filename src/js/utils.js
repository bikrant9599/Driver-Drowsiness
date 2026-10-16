/* ==========================================================================
   UTILITIES
   Minimal formatters and SVG icons
   ========================================================================== */

export const ICONS = {
  play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  stop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="5" y="5" rx="2"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`
};

/* Format seconds into readable English duration (e.g. "2 minutes 15 seconds" or "45 seconds") */
export function formatDurationText(totalSeconds) {
  const numSecs = typeof totalSeconds === "number" && !isNaN(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  const mins = Math.floor(numSecs / 60);
  const secs = numSecs % 60;

  if (mins === 0) {
    return `${secs} ${secs === 1 ? "second" : "seconds"}`;
  }
  if (secs === 0) {
    return `${mins} ${mins === 1 ? "minute" : "minutes"}`;
  }
  return `${mins} ${mins === 1 ? "minute" : "minutes"} ${secs} ${secs === 1 ? "second" : "seconds"}`;
}
