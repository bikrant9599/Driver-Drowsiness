/* ==========================================================================
   PAGE 2: LIVE MONITORING
   Simplified, highly responsive live computer vision monitoring interface
   ========================================================================== */

import { ICONS, formatDuration } from "../utils.js";
import { appState } from "../state.js";
import { visionEngine } from "../vision.js";

let liveUpdateInterval = null;

function getStatusBadgeStyle(status) {
  if (status === "Alert") {
    return {
      dotClass: "badge-dot-green",
      bgClass: "status-pill-green",
      text: "Alert"
    };
  }
  if (status === "Possible Drowsiness") {
    return {
      dotClass: "badge-dot-amber",
      bgClass: "status-pill-amber",
      text: "Possible Drowsiness"
    };
  }
  return {
    dotClass: "badge-dot-gray",
    bgClass: "status-pill-gray",
    text: "Unable to Assess"
  };
}

function getEyeBadgeStyle(eyeState) {
  if (eyeState === "Eyes Detected") {
    return {
      dotClass: "badge-dot-green",
      bgClass: "status-pill-green",
      text: "Eyes Detected"
    };
  }
  if (eyeState === "Eyes Closed") {
    return {
      dotClass: "badge-dot-amber",
      bgClass: "status-pill-amber",
      text: "Eyes Closed"
    };
  }
  return {
    dotClass: "badge-dot-gray",
    bgClass: "status-pill-gray",
    text: "Unable to Assess"
  };
}

export function renderLivePage() {
  const container = document.createElement("div");
  container.className = "live-clean-container fade-in";

  const isLive = appState.isMonitoring;
  const isPaused = appState.isPaused;
  const statusInfo = getStatusBadgeStyle(appState.driverStatus);
  const eyeInfo = getEyeBadgeStyle(appState.eyeState);

  container.innerHTML = `
    <div class="live-card">
      <!-- Top Status Header Bar -->
      <div class="live-status-bar">
        <div class="live-status-group">
          <span class="live-status-label">Driver Status:</span>
          <div class="status-pill ${statusInfo.bgClass}" id="live-driver-status-pill">
            <span class="status-dot ${statusInfo.dotClass}" id="live-driver-status-dot"></span>
            <span id="live-driver-status-text">${statusInfo.text}</span>
          </div>
        </div>

        <div class="live-status-group">
          <span class="live-status-label">Eye Tracking:</span>
          <div class="status-pill ${eyeInfo.bgClass}" id="live-eye-status-pill">
            <span class="status-dot ${eyeInfo.dotClass}" id="live-eye-status-dot"></span>
            <span id="live-eye-status-text">${eyeInfo.text}</span>
          </div>
        </div>

        <div class="live-status-group live-duration-group" id="live-duration-wrapper" style="${isLive ? 'display: flex;' : 'display: none;'}">
          <span class="live-status-label">Session Duration:</span>
          <span class="live-duration-val tabular-nums" id="live-duration-text">${formatDuration(appState.sessionDurationSec)}</span>
        </div>
      </div>

      <!-- Live Video Viewport -->
      <div class="live-video-viewport ${appState.activeWarningType ? 'alert-active' : ''}" id="live-video-viewport">
        <video id="webcam-video" autoplay playsinline muted></video>
        <canvas id="overlay-canvas"></canvas>

        <!-- Standby Overlay (shown before monitoring starts) -->
        <div class="live-video-overlay" id="live-standby-overlay" style="${isLive ? 'display: none;' : 'display: flex;'}">
          <div class="standby-icon-circle">
            ${ICONS.camera}
          </div>
          <h2 class="standby-title">Camera Ready</h2>
          <p class="standby-desc">Click Start Monitoring to activate live driver attentiveness detection.</p>
          <button class="btn btn-primary btn-lg" id="standby-start-btn">
            ${ICONS.play} Start Monitoring
          </button>
        </div>

        <!-- Camera Error Notice (if permission denied or hardware unavailable) -->
        <div class="live-video-overlay error-overlay" id="live-error-overlay" style="${appState.cameraError ? 'display: flex;' : 'display: none;'}">
          <div class="error-icon-circle">⚠️</div>
          <h2 class="error-title">Camera Access Required</h2>
          <p class="error-desc" id="live-error-text">${appState.cameraError || 'Camera permission was denied. Please allow access in browser settings.'}</p>
          <button class="btn btn-primary" id="live-error-retry-btn">
            ${ICONS.refresh} Try Again
          </button>
        </div>

        <!-- Visible Warning Banner (Triggered when prolonged eye closure is detected) -->
        <div class="live-alert-banner" id="live-alert-banner" style="${appState.activeWarningType ? 'display: flex;' : 'display: none;'}">
          <span class="alert-icon">⚠️</span>
          <div class="alert-content">
            <div class="alert-title">POSSIBLE DROWSINESS DETECTED</div>
            <div class="alert-subtitle">Prolonged eye closure detected &bull; Stay attentive</div>
          </div>
        </div>
      </div>

      <!-- Bottom Controls -->
      <div class="live-controls-bar">
        <div class="controls-left">
          ${
            isLive
              ? `
            <button class="btn btn-danger btn-lg" id="live-stop-btn">
              ${ICONS.stop} Stop Monitoring
            </button>
            <button class="btn btn-secondary" id="live-pause-btn">
              ${isPaused ? ICONS.play : ICONS.pause}
              <span>${isPaused ? "Resume" : "Pause"}</span>
            </button>
          `
              : `
            <button class="btn btn-primary btn-lg" id="live-start-btn">
              ${ICONS.play} Start Monitoring
            </button>
          `
          }
        </div>
      </div>
    </div>
  `;

  // Start Monitoring Handler
  const startMonitoring = async () => {
    const video = container.querySelector("#webcam-video");
    const canvas = container.querySelector("#overlay-canvas");
    const standbyOverlay = container.querySelector("#live-standby-overlay");
    const errorOverlay = container.querySelector("#live-error-overlay");

    if (standbyOverlay) standbyOverlay.style.display = "none";
    if (errorOverlay) errorOverlay.style.display = "none";

    appState.startSession();
    updateUIElements();

    const res = await visionEngine.startCamera(video, canvas);
    if (!res.success) {
      if (errorOverlay) {
        errorOverlay.style.display = "flex";
        const errText = container.querySelector("#live-error-text");
        if (errText) errText.textContent = res.error || "Could not access optical camera sensor.";
      }
      appState.stopSession();
      updateUIElements();
    }
  };

  // Stop Monitoring Handler -> Redirects to Session Summary
  const stopMonitoring = () => {
    visionEngine.stopCamera();
    appState.stopSession();
    updateUIElements();
    // Navigate user directly to Session Summary
    appState.setPage("summary");
  };

  // Pause / Resume Handler
  const togglePause = () => {
    if (appState.isPaused) {
      appState.resumeSession();
    } else {
      appState.pauseSession();
    }
    updateUIElements();
  };

  // Bind Buttons
  const bindButtons = () => {
    const startBtn = container.querySelector("#live-start-btn");
    const standbyStartBtn = container.querySelector("#standby-start-btn");
    const stopBtn = container.querySelector("#live-stop-btn");
    const pauseBtn = container.querySelector("#live-pause-btn");
    const retryBtn = container.querySelector("#live-error-retry-btn");

    if (startBtn) startBtn.onclick = startMonitoring;
    if (standbyStartBtn) standbyStartBtn.onclick = startMonitoring;
    if (stopBtn) stopBtn.onclick = stopMonitoring;
    if (pauseBtn) pauseBtn.onclick = togglePause;
    if (retryBtn) retryBtn.onclick = startMonitoring;
  };

  // Reactive UI update function
  const updateUIElements = () => {
    // 1. Status Badge
    const statusPill = container.querySelector("#live-driver-status-pill");
    const statusDot = container.querySelector("#live-driver-status-dot");
    const statusText = container.querySelector("#live-driver-status-text");

    const curStatus = appState.driverStatus;
    const sStyle = getStatusBadgeStyle(curStatus);

    if (statusPill && statusDot && statusText) {
      statusPill.className = `status-pill ${sStyle.bgClass}`;
      statusDot.className = `status-dot ${sStyle.dotClass}`;
      statusText.textContent = sStyle.text;
    }

    // 2. Eye Tracking Badge
    const eyePill = container.querySelector("#live-eye-status-pill");
    const eyeDot = container.querySelector("#live-eye-status-dot");
    const eyeText = container.querySelector("#live-eye-status-text");

    const curEye = appState.eyeState;
    const eStyle = getEyeBadgeStyle(curEye);

    if (eyePill && eyeDot && eyeText) {
      eyePill.className = `status-pill ${eStyle.bgClass}`;
      eyeDot.className = `status-dot ${eStyle.dotClass}`;
      eyeText.textContent = eStyle.text;
    }

    // 3. Duration display
    const durWrapper = container.querySelector("#live-duration-wrapper");
    const durText = container.querySelector("#live-duration-text");
    if (durWrapper) {
      durWrapper.style.display = appState.isMonitoring ? "flex" : "none";
    }
    if (durText) {
      durText.textContent = formatDuration(appState.sessionDurationSec);
    }

    // 4. Warning Banner & Border Flash
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

    // 5. Controls update if monitoring state changed
    const controlsLeft = container.querySelector(".controls-left");
    if (controlsLeft) {
      const isLiveNow = appState.isMonitoring;
      const isPausedNow = appState.isPaused;
      controlsLeft.innerHTML = isLiveNow
        ? `
        <button class="btn btn-danger btn-lg" id="live-stop-btn">
          ${ICONS.stop} Stop Monitoring
        </button>
        <button class="btn btn-secondary" id="live-pause-btn">
          ${isPausedNow ? ICONS.play : ICONS.pause}
          <span>${isPausedNow ? "Resume" : "Pause"}</span>
        </button>
      `
        : `
        <button class="btn btn-primary btn-lg" id="live-start-btn">
          ${ICONS.play} Start Monitoring
        </button>
      `;
      bindButtons();
    }
  };

  bindButtons();

  // If already marked as monitoring (e.g. from Home page click), start webcam immediately
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

  // Subscribe to state changes for real-time rendering
  const unsubscribe = appState.subscribe(() => {
    updateUIElements();
  });

  // Regular timer interval for elapsed seconds
  if (liveUpdateInterval) clearInterval(liveUpdateInterval);
  liveUpdateInterval = setInterval(() => {
    if (appState.isMonitoring) {
      const durText = container.querySelector("#live-duration-text");
      if (durText) {
        durText.textContent = formatDuration(appState.sessionDurationSec);
      }
    }
  }, 500);

  // Cleanup on unmount
  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      if (liveUpdateInterval) clearInterval(liveUpdateInterval);
      unsubscribe();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return container;
}
