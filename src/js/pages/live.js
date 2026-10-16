/* ==========================================================================
   PAGE 2: LIVE MONITORING
   Strictly essential: One large webcam preview, detection status
   (Normal, Possible Drowsiness, or Unable to Assess), one Start/Stop control,
   clear warning and audible alarm, and error notice when unavailable.
   ========================================================================== */

import { ICONS } from "../utils.js";
import { appState } from "../state.js";
import { visionEngine } from "../vision.js";

function getDetectionStatusStyle(status) {
  if (status === "Normal") {
    return {
      dotClass: "dot-green",
      bgClass: "status-pill-normal",
      text: "Normal"
    };
  }
  if (status === "Possible Drowsiness") {
    return {
      dotClass: "dot-amber",
      bgClass: "status-pill-drowsy",
      text: "Possible Drowsiness"
    };
  }
  return {
    dotClass: "dot-gray",
    bgClass: "status-pill-unable",
    text: "Unable to Assess"
  };
}

export function renderLivePage() {
  const container = document.createElement("div");
  container.className = "live-clean-container fade-in";

  const isLive = appState.isMonitoring;
  const statusInfo = getDetectionStatusStyle(appState.driverStatus);

  container.innerHTML = `
    <div class="live-card">
      <!-- Status Bar -->
      <div class="live-status-bar">
        <div class="live-status-group">
          <span class="live-status-label">Current Detection Status:</span>
          <div class="status-pill ${statusInfo.bgClass}" id="live-status-pill">
            <span class="status-dot ${statusInfo.dotClass}" id="live-status-dot"></span>
            <span id="live-status-text">${statusInfo.text}</span>
          </div>
        </div>
      </div>

      <!-- One Large Webcam Preview -->
      <div class="live-video-viewport ${appState.activeWarningType ? 'alert-active' : ''}" id="live-video-viewport">
        <video id="webcam-video" autoplay playsinline muted></video>
        <canvas id="overlay-canvas"></canvas>

        <!-- Standby Overlay (before monitoring starts) -->
        <div class="live-video-overlay" id="live-standby-overlay" style="${isLive ? 'display: none;' : 'display: flex;'}">
          <div class="overlay-icon-circle">
            ${ICONS.camera}
          </div>
          <h2 class="overlay-title">Camera Ready</h2>
          <p class="overlay-desc">Click Start Monitoring to begin real-time driver attentiveness tracking.</p>
          <button class="btn btn-primary btn-lg" id="standby-start-btn">
            ${ICONS.play} Start Monitoring
          </button>
        </div>

        <!-- Camera or Hardware Error Overlay -->
        <div class="live-video-overlay error-overlay" id="live-error-overlay" style="${appState.cameraError ? 'display: flex;' : 'display: none;'}">
          <div class="overlay-icon-circle error-circle">⚠️</div>
          <h2 class="overlay-title">Camera Unavailable</h2>
          <p class="overlay-desc" id="live-error-text">${appState.cameraError || 'Camera could not be accessed. Please check camera connection and permissions.'}</p>
          <button class="btn btn-primary" id="live-error-retry-btn">
            ${ICONS.refresh} Try Again
          </button>
        </div>

        <!-- Visible Warning Banner (when prolonged eye closure is detected) -->
        <div class="live-alert-banner" id="live-alert-banner" style="${appState.activeWarningType ? 'display: flex;' : 'display: none;'}">
          <span class="alert-icon">⚠️</span>
          <div class="alert-content">
            <div class="alert-title">POSSIBLE DROWSINESS DETECTED</div>
            <div class="alert-subtitle">Prolonged eye closure detected &bull; Stay attentive</div>
          </div>
        </div>
      </div>

      <!-- One Start Monitoring / Stop Monitoring Control -->
      <div class="live-controls-bar">
        <div id="live-control-button-mount">
          ${
            isLive
              ? `
            <button class="btn btn-danger btn-lg" id="live-toggle-btn">
              ${ICONS.stop} Stop Monitoring
            </button>
          `
              : `
            <button class="btn btn-primary btn-lg" id="live-toggle-btn">
              ${ICONS.play} Start Monitoring
            </button>
          `
          }
        </div>
      </div>
    </div>
  `;

  // Start Monitoring
  const startMonitoring = async () => {
    const video = container.querySelector("#webcam-video");
    const canvas = container.querySelector("#overlay-canvas");
    const standbyOverlay = container.querySelector("#live-standby-overlay");
    const errorOverlay = container.querySelector("#live-error-overlay");

    if (standbyOverlay) standbyOverlay.style.display = "none";
    if (errorOverlay) errorOverlay.style.display = "none";

    appState.startSession();
    updateUI();

    const res = await visionEngine.startCamera(video, canvas);
    if (!res.success) {
      if (errorOverlay) {
        errorOverlay.style.display = "flex";
        const errText = container.querySelector("#live-error-text");
        if (errText) errText.textContent = res.error || "Could not access optical camera sensor.";
      }
      appState.stopSession();
      updateUI();
    }
  };

  // Stop Monitoring -> Routes to Session Summary
  const stopMonitoring = () => {
    visionEngine.stopCamera();
    appState.stopSession();
    updateUI();
    appState.setPage("summary");
  };

  const bindButtons = () => {
    const toggleBtn = container.querySelector("#live-toggle-btn");
    const standbyStartBtn = container.querySelector("#standby-start-btn");
    const retryBtn = container.querySelector("#live-error-retry-btn");

    if (toggleBtn) {
      toggleBtn.onclick = () => {
        if (appState.isMonitoring) {
          stopMonitoring();
        } else {
          startMonitoring();
        }
      };
    }
    if (standbyStartBtn) standbyStartBtn.onclick = startMonitoring;
    if (retryBtn) retryBtn.onclick = startMonitoring;
  };

  const updateUI = () => {
    // Update status badge
    const statusPill = container.querySelector("#live-status-pill");
    const statusDot = container.querySelector("#live-status-dot");
    const statusText = container.querySelector("#live-status-text");

    const curStatus = appState.driverStatus;
    const sStyle = getDetectionStatusStyle(curStatus);

    if (statusPill && statusDot && statusText) {
      statusPill.className = `status-pill ${sStyle.bgClass}`;
      statusDot.className = `status-dot ${sStyle.dotClass}`;
      statusText.textContent = sStyle.text;
    }

    // Update alert banner & flashing border
    const viewport = container.querySelector("#live-video-viewport");
    const alertBanner = container.querySelector("#live-alert-banner");
    const hasActiveWarning = Boolean(appState.activeWarningType);

    if (viewport) {
      if (hasActiveWarning) {
        viewport.classList.add("alert-active");
      } else {
        viewport.classList.remove("alert-active");
      }
    }

    if (alertBanner) {
      alertBanner.style.display = hasActiveWarning ? "flex" : "none";
    }

    // Update the single Start/Stop Monitoring control button
    const buttonMount = container.querySelector("#live-control-button-mount");
    if (buttonMount) {
      buttonMount.innerHTML = appState.isMonitoring
        ? `
        <button class="btn btn-danger btn-lg" id="live-toggle-btn">
          ${ICONS.stop} Stop Monitoring
        </button>
      `
        : `
        <button class="btn btn-primary btn-lg" id="live-toggle-btn">
          ${ICONS.play} Start Monitoring
        </button>
      `;
      bindButtons();
    }
  };

  bindButtons();

  // If session already started (e.g. from Home page click), start video
  if (appState.isMonitoring && !appState.cameraConnected) {
    setTimeout(() => {
      startMonitoring();
    }, 50);
  } else if (appState.isMonitoring && appState.cameraConnected && visionEngine.stream) {
    const video = container.querySelector("#webcam-video");
    const canvas = container.querySelector("#overlay-canvas");
    if (video) {
      video.srcObject = visionEngine.stream;
      video.play().catch(() => {});
    }
    visionEngine.videoElement = video;
    visionEngine.canvasElement = canvas;
    visionEngine.canvasCtx = canvas ? canvas.getContext("2d", { willReadFrequently: true }) : null;
  }

  const unsubscribe = appState.subscribe(() => {
    updateUI();
  });

  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      unsubscribe();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return container;
}
