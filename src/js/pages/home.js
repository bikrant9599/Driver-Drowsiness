/* ==========================================================================
   PAGE 1: HOME
   Strictly essential options: Application name, short description,
   one clear "Start Monitoring" button, and a short camera privacy notice.
   ========================================================================== */

import { ICONS } from "../utils.js";
import { appState } from "../state.js";

export function renderHomePage() {
  const container = document.createElement("div");
  container.className = "home-clean-container fade-in";

  container.innerHTML = `
    <div class="home-card">
      <h1 class="home-title">AI Driver Drowsiness Detection</h1>

      <p class="home-description">
        Real-time driver attentiveness monitoring using your webcam. The application continuously monitors for signs of fatigue and sounds an immediate audible alarm when prolonged eye closure is detected.
      </p>

      <div class="home-cta-wrapper">
        <button class="btn btn-primary btn-lg" id="home-start-btn">
          ${ICONS.play} Start Monitoring
        </button>
      </div>

      <div class="home-privacy-notice">
        ${ICONS.camera}
        <span><strong>Camera Privacy Notice:</strong> Camera access is required for live monitoring. All video processing happens privately and securely directly on your device. No video or images are ever recorded, saved, or transmitted.</span>
      </div>
    </div>
  `;

  // Start Monitoring click handler
  const startBtn = container.querySelector("#home-start-btn");
  if (startBtn) {
    startBtn.onclick = () => {
      appState.setPage("live");
    };
  }

  return container;
}
