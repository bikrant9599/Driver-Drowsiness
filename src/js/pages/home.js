/* ==========================================================================
   PAGE 1: HOME
   Clean, professional, and simplified entry page
   ========================================================================== */

import { ICONS } from "../utils.js";
import { appState } from "../state.js";

export function renderHomePage() {
  const container = document.createElement("div");
  container.className = "home-clean-container fade-in";

  container.innerHTML = `
    <div class="home-card">
      <div class="home-badge">
        ${ICONS.shieldCheck}
        <span>Driver Safety System</span>
      </div>

      <h1 class="home-title">AI Driver Drowsiness Detection</h1>

      <p class="home-description">
        Real-time driver attentiveness monitoring using your webcam. The system continuously watches for signs of fatigue and sounds an immediate audible alarm when prolonged eye closure is detected.
      </p>

      <div class="home-cta-wrapper">
        <button class="btn btn-primary btn-lg" id="home-start-btn">
          ${ICONS.play} Start Monitoring
        </button>
      </div>

      <div class="home-note-card">
        <div class="note-icon">${ICONS.camera}</div>
        <div class="note-text">
          <strong>Camera &amp; Privacy:</strong> Camera access is required for real-time monitoring. All computer vision processing runs privately on your device — no video or images are ever stored, uploaded, or transmitted.
        </div>
      </div>

      <div class="home-disclaimer">
        <strong>Safety Disclaimer:</strong> This application is an assistive aid and cannot guarantee accident prevention. Never drive while fatigued; always pull over safely and rest when tired.
      </div>
    </div>
  `;

  // Start Monitoring click handler: navigate to live page and start monitoring
  const startBtn = container.querySelector("#home-start-btn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      appState.setPage("live");
    });
  }

  return container;
}
