/* ==========================================================================
   VIEW: LIVE MONITORING
   ========================================================================== */

import { ICONS, formatDuration, showToast, showConfirmModal } from "../utils.js";
import { appState } from "../state.js";
import { visionEngine } from "../vision.js";
import { soundManager } from "../audio.js";

let liveUpdateInterval = null;

export function renderLivePage() {
  const container = document.createElement("div");
  container.className = "live-container fade-in";

  const isLive = appState.isMonitoring;
  const isPaused = appState.isPaused;
  const isSample = appState.monitoringMode === "sample";

  container.innerHTML = `
    <div class="live-layout">
      <!-- Main Camera / Video Stage -->
      <div class="video-stage-card">
        <div class="video-stage-header">
          <div class="mode-badge-wrapper">
            <span class="badge ${isSample ? 'badge-warn' : 'badge-safe'}" id="live-mode-badge">
              <span class="badge-dot"></span>
              ${isSample ? 'BENCHMARK PREVIEW (SIMULATED TEST)' : 'LIVE AI COMPUTER VISION (WEBCAM)'}
            </span>
            <span class="badge ${appState.faceDetected ? 'badge-safe' : 'badge-neutral'}" id="live-face-badge">
              <span class="badge-dot"></span>
              ${appState.faceDetected ? 'Face Locked' : isLive ? 'Searching Face' : 'Standby'}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" id="live-switch-mode-btn" title="Toggle between Real Camera and Benchmark Simulation">
              ${ICONS.refresh} ${isSample ? 'Switch to Real Webcam' : 'Switch to Benchmark'}
            </button>
          </div>
        </div>

        <!-- Video Viewport with Canvas HUD -->
        <div class="video-container" id="live-video-viewport">
          <video id="webcam-video" autoplay playsinline muted></video>
          <canvas id="overlay-canvas"></canvas>

          <!-- Audio Restriction Banner -->
          <div class="hud-audio-warning" id="hud-audio-warning" style="${appState.audioBlocked ? 'display: flex;' : 'display: none;'}">
            ${ICONS.bellOff} <span>Audio restricted by browser &bull; Click to allow alarm</span>
          </div>

          <!-- In-Cabin Lighting & Face Visibility Notice -->
          <div class="hud-lighting-notice" id="hud-lighting-notice" style="display: none;">
            ⚠️ <span>Face Not Detected: Ensure adequate in-cabin lighting, remove reflective eyewear, and face the camera directly.</span>
          </div>

          <!-- Camera Initializing Overlay (shown while webcam stream & AI model load) -->
          <div class="camera-initializing-overlay" id="camera-initializing-overlay" style="display: none;">
            <div class="radar-pulse"></div>
            <h3 style="margin-top: 1.25rem; font-size: 1.15rem; color: var(--text-primary); font-weight: 700;">Initializing Optical Sensor &amp; AI Mesh</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 400px; line-height: 1.5; margin-top: 0.4rem;">
              Acquiring camera video stream and loading MediaPipe 478-point 3D facial landmark model. Please face the camera directly.
            </p>
          </div>

          <!-- Standby Overlay (shown before monitoring starts) -->
          <div class="camera-standby-overlay" id="camera-standby-overlay" style="${isLive ? 'display: none;' : 'display: flex;'}">
            <div class="standby-icon-orb">
              ${ICONS.camera}
            </div>
            <h3>Optical Camera Standby</h3>
            <p>Click <strong>Start Monitoring</strong> to grant webcam access and activate real-time AI driver drowsiness detection.</p>
            <button class="btn btn-primary btn-lg" id="standby-start-btn">
              ${ICONS.play} Start Monitoring
            </button>
          </div>

          <!-- Camera Error Overlay (shown on permission denial or missing device) -->
          <div class="camera-error-overlay" id="camera-error-overlay" style="${appState.driverStatus === 'CAMERA ERROR' ? 'display: flex;' : 'display: none;'}">
            <div class="error-icon-orb">⚠️</div>
            <h3 id="camera-error-title">Camera Access Notice</h3>
            <p id="camera-error-desc">${appState.cameraError || 'Camera permission was denied or device is unavailable. Please grant permission in your browser.'}</p>
            <button class="btn btn-primary" id="camera-error-retry-btn">
              ${ICONS.refresh} Try Again
            </button>
          </div>

          <!-- Floating HUD Overlays -->
          <div class="hud-corner hud-top-left">
            <div class="hud-pill" id="hud-status-pill">
              <span class="badge-dot" id="hud-status-dot" style="background: ${getStatusColor(appState.driverStatus)};"></span>
              <span id="hud-status-text">${appState.driverStatus}</span>
            </div>
            <div class="hud-pill">
              ${ICONS.dashboard}
              <span id="hud-duration-text" class="tabular-nums">${formatDuration(appState.sessionDurationSec)}</span>
            </div>
          </div>

          <div class="hud-corner hud-top-right">
            <div class="hud-pill">
              ${ICONS.eye}
              <span>EAR: <strong id="hud-ear-text" class="tabular-nums">${appState.currentEar.toFixed(2)}</strong></span>
            </div>
            <div class="hud-pill">
              <span>EYES: <strong id="hud-eye-state-text" style="color: ${getEyeColor(appState.eyeState)};">${appState.eyeState}</strong></span>
            </div>
          </div>

          <div class="hud-corner hud-bottom-left">
            <div class="hud-pill">
              <span>ALERT LIMIT: ${appState.settings.drowsinessDurationSec.toFixed(1)}s</span>
            </div>
            ${
              appState.settings.yawnDetectionEnabled
                ? `<div class="hud-pill">
                    <span>MAR: <strong id="hud-mar-text" class="tabular-nums">${appState.currentMar.toFixed(2)}</strong></span>
                   </div>`
                : ''
            }
          </div>

          <!-- Prominent Visual Warning Banner -->
          <div class="hud-alert-banner" id="hud-alert-banner">
            <div style="font-size: 2.5rem; line-height: 1;">⚠️</div>
            <h2 id="hud-alert-title">DROWSINESS DETECTED!</h2>
            <div class="hud-alert-type-badge" id="hud-alert-type">PROLONGED EYE CLOSURE</div>
            <p id="hud-alert-desc">EYE CLOSURE: 2.0s &bull; WAKE UP IMMEDIATELY</p>
          </div>
        </div>

        <!-- Stage Footer Controls (Start, Pause/Resume, Stop, Reset, Mute) -->
        <div class="video-stage-footer">
          <div class="control-btn-group" id="live-action-buttons">
            ${renderControlButtons(isLive, isPaused)}
          </div>

          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <button class="btn btn-secondary btn-icon" id="live-alarm-mute-btn" title="${appState.settings.alarmEnabled ? 'Mute Alert Audio' : 'Unmute Alert Audio'}">
              ${appState.settings.alarmEnabled ? ICONS.bell : ICONS.bellOff}
            </button>
            <button class="btn btn-secondary btn-sm" id="live-test-sound-btn">
              ${ICONS.volume2} Test Alarm
            </button>
          </div>
        </div>
      </div>

      <!-- Live Telemetry Right Sidebar -->
      <div class="live-telemetry-sidebar">
        <!-- Prolonged Eye Closure Stopwatch -->
        <div class="closure-timer-card">
          <div class="card-title" style="font-size: 0.95rem; margin-bottom: 0.25rem;">
            ${ICONS.eyeOff} Prolonged Eye Closure
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Consecutive Closed Duration</span>

          <div class="timer-large tabular-nums" id="live-closure-display">
            0.0s
          </div>

          <div class="closure-progress-bar">
            <div class="closure-progress-fill" id="live-closure-progress"></div>
          </div>

          <div style="display: flex; justify-content: space-between; width: 100%; font-size: 0.7rem; color: var(--text-muted); margin-top: 0.4rem;">
            <span>0.0s</span>
            <span>Caution: 0.35s</span>
            <span style="color: var(--status-danger);">Alarm: ${appState.settings.drowsinessDurationSec.toFixed(1)}s</span>
          </div>
        </div>

        <!-- Real-Time EAR Waveform Chart -->
        <div class="ear-chart-card">
          <div class="card-header" style="margin-bottom: 0.5rem;">
            <div class="card-title" style="font-size: 0.9rem;">
              ${ICONS.gauge} Real-Time EAR Waveform
            </div>
            <span class="badge badge-info" id="live-ear-badge">${appState.currentEar.toFixed(2)}</span>
          </div>

          <canvas id="ear-live-canvas" width="300" height="110"></canvas>

          <div style="display: flex; justify-content: space-between; font-size: 0.725rem; color: var(--text-muted);">
            <span>Threshold: ${appState.settings.earThreshold.toFixed(2)}</span>
            <span style="color: var(--status-safe);">Attentive: &gt;${appState.settings.earThreshold.toFixed(2)}</span>
          </div>
        </div>

        <!-- Yawning & Head Position Telemetry Card -->
        <div class="card" style="padding: 1.25rem;">
          <div class="card-header" style="margin-bottom: 0.875rem;">
            <div class="card-title" style="font-size: 0.9rem;">
              ${ICONS.cpu} Fatigue Indicators
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.825rem;">
            <!-- Yawning Indicator -->
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-secondary);">Mouth Opening (MAR):</span>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <strong id="live-mar-val" class="tabular-nums">${appState.currentMar.toFixed(2)}</strong>
                <span class="badge ${appState.isYawning ? 'badge-warn' : 'badge-neutral'}" id="live-yawn-badge" style="font-size: 0.65rem;">
                  ${appState.isYawning ? 'Yawning' : 'Normal'}
                </span>
              </div>
            </div>

            <!-- Confirmed Yawns -->
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Confirmed Yawns:</span>
              <strong id="live-yawn-count" class="tabular-nums" style="color: var(--status-warn);">${appState.yawnCount}</strong>
            </div>

            <!-- Head Pose Pitch -->
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-secondary);">Head Position:</span>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <strong id="live-pitch-val" class="tabular-nums">${appState.headPitch.toFixed(2)}</strong>
                <span class="badge ${appState.isHeadDrop ? 'badge-danger' : 'badge-safe'}" id="live-headdrop-badge" style="font-size: 0.65rem;">
                  ${appState.isHeadDrop ? 'Downward Nod' : 'Upright'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Biometrics Detail Card -->
        <div class="card" style="padding: 1.25rem;">
          <div class="card-header" style="margin-bottom: 0.875rem;">
            <div class="card-title" style="font-size: 0.9rem;">
              ${ICONS.user} Biometric Status
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.825rem;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Left Eye EAR:</span>
              <strong id="live-left-ear" class="tabular-nums">${appState.leftEar.toFixed(2)}</strong>
            </div>

            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Right Eye EAR:</span>
              <strong id="live-right-ear" class="tabular-nums">${appState.rightEar.toFixed(2)}</strong>
            </div>

            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Blinks Counted:</span>
              <strong id="live-blink-count" class="tabular-nums">${appState.blinkCount}</strong>
            </div>

            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Drowsiness Alerts:</span>
              <strong id="live-session-alerts" class="tabular-nums" style="color: var(--status-danger);">${appState.sessionWarningsCount}</strong>
            </div>

            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Audio Alarm Tone:</span>
              <strong style="text-transform: capitalize;">${appState.settings.alarmSound}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    initLiveCameraAndCanvas(container);
  }, 20);

  bindLiveButtons(container);

  return container;
}

function renderControlButtons(isLive, isPaused) {
  if (!isLive) {
    return `
      <button class="btn btn-primary" id="live-start-btn">
        ${ICONS.play} Start Monitoring
      </button>
      <button class="btn btn-secondary" id="live-reset-btn" title="Reset current session">
        ${ICONS.refresh} Reset
      </button>
      <button class="btn btn-secondary" id="live-snapshot-btn" title="Save snapshot to reports">
        ${ICONS.camera} Snapshot
      </button>
    `;
  }

  if (isPaused) {
    return `
      <button class="btn btn-primary" id="live-resume-btn">
        ${ICONS.play} Resume
      </button>
      <button class="btn btn-danger" id="live-stop-btn">
        ${ICONS.stop} Stop Monitoring
      </button>
      <button class="btn btn-secondary" id="live-reset-btn" title="Reset current session">
        ${ICONS.refresh} Reset
      </button>
      <button class="btn btn-secondary" id="live-snapshot-btn" title="Save snapshot to reports">
        ${ICONS.camera} Snapshot
      </button>
    `;
  }

  return `
    <button class="btn btn-secondary" id="live-pause-btn">
      ${ICONS.pause} Pause
    </button>
    <button class="btn btn-danger" id="live-stop-btn">
      ${ICONS.stop} Stop Monitoring
    </button>
    <button class="btn btn-secondary" id="live-reset-btn" title="Reset current session">
      ${ICONS.refresh} Reset
    </button>
    <button class="btn btn-secondary" id="live-snapshot-btn" title="Save snapshot to reports">
      ${ICONS.camera} Snapshot
    </button>
  `;
}

function getStatusColor(status) {
  if (status === "ALERT" || status === "CAMERA ERROR") return "var(--status-danger)";
  if (status === "POSSIBLE DROWSINESS" || status === "FACE NOT DETECTED") return "var(--status-warn)";
  if (status === "ATTENTIVE") return "var(--status-safe)";
  return "var(--text-muted)";
}

function getEyeColor(eyeState) {
  if (eyeState === "CLOSED") return "var(--status-danger)";
  if (eyeState === "BLINKING") return "var(--status-warn)";
  if (eyeState === "OPEN") return "var(--status-safe)";
  return "var(--text-muted)";
}

function initLiveCameraAndCanvas(container) {
  const videoEl = container.querySelector("#webcam-video");
  const canvasEl = container.querySelector("#overlay-canvas");
  const initializingOverlay = container.querySelector("#camera-initializing-overlay");

  if (appState.isMonitoring && !appState.isPaused) {
    if (initializingOverlay) initializingOverlay.style.display = "flex";
    visionEngine.startCamera(videoEl, canvasEl).finally(() => {
      if (initializingOverlay) initializingOverlay.style.display = "none";
    });
  }

  if (liveUpdateInterval) clearInterval(liveUpdateInterval);
  liveUpdateInterval = setInterval(() => {
    updateLiveTelemetryUI(container);
  }, 60);
}

function updateLiveTelemetryUI(container) {
  if (!container || !container.isConnected) {
    if (liveUpdateInterval) {
      clearInterval(liveUpdateInterval);
      liveUpdateInterval = null;
    }
    return;
  }

  const status = appState.driverStatus;
  const isAlert = status === "ALERT";
  const isCaution = status === "POSSIBLE DROWSINESS";

  // Elements
  const viewport = container.querySelector("#live-video-viewport");
  const alertBanner = container.querySelector("#hud-alert-banner");
  const alertTitle = container.querySelector("#hud-alert-title");
  const alertType = container.querySelector("#hud-alert-type");
  const alertDesc = container.querySelector("#hud-alert-desc");
  const closureDisplay = container.querySelector("#live-closure-display");
  const closureProgress = container.querySelector("#live-closure-progress");
  const earText = container.querySelector("#hud-ear-text");
  const earBadge = container.querySelector("#live-ear-badge");
  const marText = container.querySelector("#hud-mar-text");
  const marVal = container.querySelector("#live-mar-val");
  const yawnBadge = container.querySelector("#live-yawn-badge");
  const yawnCountEl = container.querySelector("#live-yawn-count");
  const pitchVal = container.querySelector("#live-pitch-val");
  const headBadge = container.querySelector("#live-headdrop-badge");
  const eyeStateText = container.querySelector("#hud-eye-state-text");
  const statusText = container.querySelector("#hud-status-text");
  const statusDot = container.querySelector("#hud-status-dot");
  const durationText = container.querySelector("#hud-duration-text");
  const leftEarEl = container.querySelector("#live-left-ear");
  const rightEarEl = container.querySelector("#live-right-ear");
  const blinkCountEl = container.querySelector("#live-blink-count");
  const sessionAlertsEl = container.querySelector("#live-session-alerts");
  const faceBadge = container.querySelector("#live-face-badge");
  const errorOverlay = container.querySelector("#camera-error-overlay");
  const audioWarning = container.querySelector("#hud-audio-warning");

  // Audio restriction notification
  if (audioWarning) {
    audioWarning.style.display = appState.audioBlocked ? "flex" : "none";
  }

  // Red alert border for Critical alert
  if (viewport) {
    if (isAlert) {
      viewport.classList.add("alert-active");
    } else {
      viewport.classList.remove("alert-active");
    }
  }

  // Visual Warning Banner
  if (alertBanner) {
    if (isAlert) {
      alertBanner.className = "hud-alert-banner active";
      if (alertTitle) alertTitle.textContent = "DROWSINESS DETECTED!";
      if (alertType) alertType.textContent = appState.activeWarningType || "PROLONGED EYE CLOSURE";
      if (alertDesc) alertDesc.textContent = `EYE CLOSURE: ${appState.closureSeconds.toFixed(1)}s &bull; WAKE UP IMMEDIATELY`;
    } else if (isCaution && (appState.isYawning || appState.isHeadDrop || appState.closureSeconds >= 0.35)) {
      alertBanner.className = "hud-alert-banner active caution";
      if (alertTitle) alertTitle.textContent = "POSSIBLE DROWSINESS WARNING";
      if (alertType) alertType.textContent = appState.activeWarningType || "FATIGUE ADVISORY";
      if (alertDesc) {
        if (appState.isYawning) {
          alertDesc.textContent = `SUSTAINED YAWN: ${appState.yawnDurationSec.toFixed(1)}s &bull; TAKE A REST BREAK`;
        } else if (appState.isHeadDrop) {
          alertDesc.textContent = `HEAD DROP DETECTED &bull; LIFT HEAD & STAY ATTENTIVE`;
        } else {
          alertDesc.textContent = `EYE CLOSURE: ${appState.closureSeconds.toFixed(1)}s &bull; STAY ATTENTIVE`;
        }
      }
    } else {
      alertBanner.className = "hud-alert-banner";
    }
  }

  // Error overlay sync
  if (errorOverlay) {
    if (status === "CAMERA ERROR") {
      errorOverlay.style.display = "flex";
      const desc = container.querySelector("#camera-error-desc");
      if (desc && appState.cameraError) desc.textContent = appState.cameraError;
    } else if (appState.isMonitoring) {
      errorOverlay.style.display = "none";
    }
  }

  // Timer & progress bar
  if (closureDisplay) {
    closureDisplay.textContent = `${appState.closureSeconds.toFixed(1)}s`;
    closureDisplay.className = `timer-large tabular-nums ${isAlert ? 'danger' : isCaution ? 'warn' : ''}`;
  }

  if (closureProgress) {
    const percent = Math.min(100, (appState.closureSeconds / appState.settings.drowsinessDurationSec) * 100);
    closureProgress.style.width = `${percent}%`;
    closureProgress.className = `closure-progress-fill ${isAlert ? 'danger' : isCaution ? 'warn' : ''}`;
  }

  // Status text & dot
  if (statusText) statusText.textContent = status;
  if (statusDot) statusDot.style.background = getStatusColor(status);

  // EAR metrics
  if (earText) earText.textContent = appState.currentEar.toFixed(2);
  if (earBadge) earBadge.textContent = appState.currentEar.toFixed(2);

  // MAR & Yawn telemetry
  if (marText) marText.textContent = appState.currentMar.toFixed(2);
  if (marVal) marVal.textContent = appState.currentMar.toFixed(2);
  if (yawnBadge) {
    yawnBadge.className = `badge ${appState.isYawning ? 'badge-warn' : 'badge-neutral'}`;
    yawnBadge.textContent = appState.isYawning ? 'Yawning' : 'Normal';
  }
  if (yawnCountEl) yawnCountEl.textContent = appState.yawnCount;

  // Head Pitch telemetry
  if (pitchVal) pitchVal.textContent = appState.headPitch.toFixed(2);
  if (headBadge) {
    headBadge.className = `badge ${appState.isHeadDrop ? 'badge-danger' : 'badge-safe'}`;
    headBadge.textContent = appState.isHeadDrop ? 'Downward Nod' : 'Upright';
  }

  // Eye state
  if (eyeStateText) {
    eyeStateText.textContent = appState.eyeState;
    eyeStateText.style.color = getEyeColor(appState.eyeState);
  }

  if (durationText) durationText.textContent = formatDuration(appState.sessionDurationSec);
  if (leftEarEl) leftEarEl.textContent = appState.leftEar.toFixed(2);
  if (rightEarEl) rightEarEl.textContent = appState.rightEar.toFixed(2);
  if (blinkCountEl) blinkCountEl.textContent = appState.blinkCount;
  if (sessionAlertsEl) sessionAlertsEl.textContent = appState.sessionWarningsCount;

  // In-Cabin Lighting & Face Visibility Guidance Notice
  const lightingNotice = container.querySelector("#hud-lighting-notice");
  if (lightingNotice) {
    const showNotice = appState.isMonitoring && !appState.isPaused && (!appState.faceDetected || appState.driverStatus === "FACE NOT DETECTED");
    lightingNotice.style.display = showNotice ? "flex" : "none";
  }

  // Face detection status badge
  if (faceBadge) {
    if (appState.faceDetected) {
      faceBadge.className = "badge badge-safe";
      faceBadge.innerHTML = `<span class="badge-dot"></span> Face Locked (Tracking)`;
    } else if (appState.isMonitoring && !appState.isPaused) {
      faceBadge.className = "badge badge-warn";
      faceBadge.innerHTML = `<span class="badge-dot"></span> Searching Face (Check Light)`;
    } else {
      faceBadge.className = "badge badge-neutral";
      faceBadge.innerHTML = `<span class="badge-dot"></span> Standby`;
    }
  }

  // Draw Waveform EAR Canvas
  drawEARWaveform(container);
}

function drawEARWaveform(container) {
  const canvas = container.querySelector("#ear-live-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const history = visionEngine.earHistory;
  if (!history || history.length < 2) return;

  // Threshold line
  const thresholdY = h - (appState.settings.earThreshold / 0.45) * h;
  ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, thresholdY);
  ctx.lineTo(w, thresholdY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Waveform line
  ctx.beginPath();
  ctx.lineWidth = 2;
  const isAlert = appState.driverStatus === "ALERT";
  const isWarn = appState.driverStatus === "POSSIBLE DROWSINESS";
  ctx.strokeStyle = isAlert ? "#ef4444" : isWarn ? "#f59e0b" : "#06b6d4";

  const step = w / (visionEngine.historyMaxPoints - 1);
  history.forEach((val, i) => {
    const x = i * step;
    const y = Math.max(4, Math.min(h - 4, h - (val / 0.45) * h));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Glow fill
  ctx.lineTo((history.length - 1) * step, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, isAlert ? "rgba(239, 68, 68, 0.25)" : "rgba(6, 182, 212, 0.2)");
  grad.addColorStop(1, "rgba(7, 13, 25, 0)");
  ctx.fillStyle = grad;
  ctx.fill();
}

function bindLiveButtons(container) {
  const videoEl = container.querySelector("#webcam-video");
  const canvasEl = container.querySelector("#overlay-canvas");
  const standbyOverlay = container.querySelector("#camera-standby-overlay");
  const errorOverlay = container.querySelector("#camera-error-overlay");

  const updateActionButtonGroup = () => {
    const actionGroup = container.querySelector("#live-action-buttons");
    if (!actionGroup) return;

    actionGroup.innerHTML = renderControlButtons(appState.isMonitoring, appState.isPaused);
    rebindActionGroup();
  };

  const initializingOverlay = container.querySelector("#camera-initializing-overlay");

  const startMonitoringHandler = async () => {
    // Prevent starting multiple times simultaneously
    if (appState.isMonitoring || visionEngine.isStartingCamera) return;

    if (standbyOverlay) standbyOverlay.style.display = "none";
    if (errorOverlay) errorOverlay.style.display = "none";
    if (initializingOverlay) initializingOverlay.style.display = "flex";

    appState.startSession(appState.monitoringMode);
    updateActionButtonGroup();

    const res = await visionEngine.startCamera(videoEl, canvasEl);

    if (initializingOverlay) initializingOverlay.style.display = "none";

    if (!res.success) {
      if (errorOverlay) {
        errorOverlay.style.display = "flex";
        const desc = container.querySelector("#camera-error-desc");
        if (desc) desc.textContent = res.error;
      }
      updateActionButtonGroup();
    } else {
      updateActionButtonGroup();
    }
  };

  const pauseMonitoringHandler = () => {
    appState.pauseSession();
    soundManager.stopDrowsinessAlert();
    updateActionButtonGroup();
    showToast("Monitoring Paused", "Vision telematics paused. Click Resume to continue.", "info");
  };

  const resumeMonitoringHandler = () => {
    appState.resumeSession();
    updateActionButtonGroup();
    showToast("Monitoring Resumed", "Vision telematics active.", "safe");
  };

  const stopMonitoringHandler = () => {
    showConfirmModal({
      title: "End Driver Monitoring Session?",
      message: "This will save your current telemetry session to the Reports log and cease video camera processing.",
      confirmText: "Stop & Save",
      isDanger: true,
      onConfirm: () => {
        visionEngine.stopCamera();
        appState.stopSession();
        if (standbyOverlay) standbyOverlay.style.display = "flex";
        if (errorOverlay) errorOverlay.style.display = "none";
        updateActionButtonGroup();
        showToast("Session Saved", "Monitoring session logged to reports.", "safe");
      }
    });
  };

  const resetSessionHandler = () => {
    // Show confirmation before resetting if recorded information will be lost
    if (appState.sessionDurationSec > 0 || appState.sessionWarningsCount > 0 || appState.yawnCount > 0) {
      showConfirmModal({
        title: "Reset Current Monitoring Session?",
        message: "Are you sure you want to reset this session? All active session timers, yawn counts, and recorded warning incidents will be cleared.",
        confirmText: "Reset Session",
        isDanger: true,
        onConfirm: () => {
          appState.resetSession();
          showToast("Session Reset", "Telemetry timers and counts cleared.", "info");
        }
      });
    } else {
      appState.resetSession();
      showToast("Session Reset", "Telemetry timers cleared.", "info");
    }
  };

  const rebindActionGroup = () => {
    const startBtn = container.querySelector("#live-start-btn");
    if (startBtn) startBtn.onclick = startMonitoringHandler;

    const pauseBtn = container.querySelector("#live-pause-btn");
    if (pauseBtn) pauseBtn.onclick = pauseMonitoringHandler;

    const resumeBtn = container.querySelector("#live-resume-btn");
    if (resumeBtn) resumeBtn.onclick = resumeMonitoringHandler;

    const stopBtn = container.querySelector("#live-stop-btn");
    if (stopBtn) stopBtn.onclick = stopMonitoringHandler;

    const resetBtn = container.querySelector("#live-reset-btn");
    if (resetBtn) resetBtn.onclick = resetSessionHandler;

    const snapBtn = container.querySelector("#live-snapshot-btn");
    if (snapBtn) {
      snapBtn.onclick = () => {
        const snapEvent = {
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          type: "MANUAL_SNAPSHOT",
          typeLabel: "Manual Telemetry Snapshot",
          duration: "0.0s",
          ear: Number(appState.currentEar.toFixed(2)),
          mar: Number(appState.currentMar.toFixed(2)),
          severity: "Caution",
          isSample: appState.monitoringMode === "sample"
        };
        appState.recentEvents.unshift(snapEvent);
        showToast("Snapshot Saved", `Telemetry snapshot captured at EAR ${appState.currentEar.toFixed(2)}`, "safe");
      };
    }
  };

  rebindActionGroup();

  // Standby overlay start button
  const standbyStartBtn = container.querySelector("#standby-start-btn");
  if (standbyStartBtn) standbyStartBtn.onclick = startMonitoringHandler;

  // Error overlay retry button
  const errorRetryBtn = container.querySelector("#camera-error-retry-btn");
  if (errorRetryBtn) errorRetryBtn.onclick = startMonitoringHandler;

  // Audio restriction click-to-activate banner
  const audioBanner = container.querySelector("#hud-audio-warning");
  if (audioBanner) {
    audioBanner.onclick = () => {
      soundManager.initContext().then(() => {
        audioBanner.style.display = "none";
        showToast("Audio Active", "Emergency audible alerts enabled.", "safe");
      });
    };
  }

  // Mode Switch
  const modeSwitchBtn = container.querySelector("#live-switch-mode-btn");
  if (modeSwitchBtn) {
    modeSwitchBtn.onclick = () => {
      visionEngine.stopCamera();
      const newMode = appState.monitoringMode === "sample" ? "real" : "sample";
      appState.monitoringMode = newMode;
      showToast(
        "Mode Changed",
        newMode === "real" ? "Switched to Live Hardware Webcam AI" : "Switched to Benchmark Simulation Test",
        "info"
      );
      appState.setPage("live");
    };
  }

  // Test Alarm
  const testAlarmBtn = container.querySelector("#live-test-sound-btn");
  if (testAlarmBtn) {
    testAlarmBtn.onclick = () => {
      soundManager.testAlarm();
      showToast("Alarm Test", `Sounding ${appState.settings.alarmSound} tone alert.`, "info");
    };
  }

  // Mute / Unmute Toggle
  const muteBtn = container.querySelector("#live-alarm-mute-btn");
  if (muteBtn) {
    muteBtn.onclick = () => {
      const isEnabled = soundManager.toggleMute();
      muteBtn.innerHTML = isEnabled ? ICONS.bell : ICONS.bellOff;
      muteBtn.title = isEnabled ? "Mute Alert Audio" : "Unmute Alert Audio";
    };
  }
}
