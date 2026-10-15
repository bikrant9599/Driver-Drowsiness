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
          </div>

          <!-- Red Flashing HUD Drowsiness Banner -->
          <div class="hud-alert-banner" id="hud-alert-banner">
            <div style="font-size: 2.5rem; line-height: 1;">⚠️</div>
            <h2>DROWSINESS DETECTED!</h2>
            <p>PROLONGED EYE CLOSURE &bull; WAKE UP IMMEDIATELY</p>
          </div>
        </div>

        <!-- Stage Footer Controls -->
        <div class="video-stage-footer">
          <div class="control-btn-group" id="live-action-buttons">
            ${
              !isLive
                ? `<button class="btn btn-primary" id="live-start-btn">
                    ${ICONS.play} Start Monitoring
                   </button>`
                : `<button class="btn btn-danger" id="live-stop-btn">
                    ${ICONS.stop} Stop Monitoring
                   </button>`
            }
            <button class="btn btn-secondary" id="live-reset-btn" title="Reset current session">
              ${ICONS.refresh} Reset
            </button>
            <button class="btn btn-secondary" id="live-snapshot-btn" title="Save snapshot to reports">
              ${ICONS.camera} Snapshot
            </button>
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
            <span>Warning: 0.4s</span>
            <span style="color: var(--status-danger);">Alarm: ${appState.settings.drowsinessDurationSec.toFixed(1)}s</span>
          </div>
        </div>

        <!-- Live Waveform EAR Chart -->
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
              <span style="color: var(--text-secondary);">Current Session Alerts:</span>
              <strong id="live-session-alerts" class="tabular-nums" style="color: var(--status-danger);">${appState.sessionWarningsCount}</strong>
            </div>

            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Audio Alert Tone:</span>
              <strong style="text-transform: capitalize;">${appState.settings.alarmSound}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Mount logic after DOM element is attached
  setTimeout(() => {
    initLiveCameraAndCanvas(container);
  }, 20);

  // Bind Buttons
  bindLiveButtons(container);

  return container;
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

  // Only start camera automatically if session was already active (e.g. from Dashboard launch)
  if (appState.isMonitoring) {
    visionEngine.startCamera(videoEl, canvasEl);
  }

  // Setup periodic UI update loop (every 60ms)
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
  const isWarn = status === "POSSIBLE DROWSINESS" || status === "FACE NOT DETECTED";
  const isCamError = status === "CAMERA ERROR";

  // Elements
  const viewport = container.querySelector("#live-video-viewport");
  const alertBanner = container.querySelector("#hud-alert-banner");
  const closureDisplay = container.querySelector("#live-closure-display");
  const closureProgress = container.querySelector("#live-closure-progress");
  const earText = container.querySelector("#hud-ear-text");
  const earBadge = container.querySelector("#live-ear-badge");
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

  // Video container alert active state
  if (viewport) {
    if (isAlert) {
      viewport.classList.add("alert-active");
    } else {
      viewport.classList.remove("alert-active");
    }
  }

  // HUD Alert Banner
  if (alertBanner) {
    if (isAlert) {
      alertBanner.classList.add("active");
    } else {
      alertBanner.classList.remove("active");
    }
  }

  // Camera error overlay sync
  if (errorOverlay) {
    if (isCamError) {
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
    closureDisplay.className = `timer-large tabular-nums ${isAlert ? 'danger' : isWarn ? 'warn' : ''}`;
  }

  if (closureProgress) {
    const percent = Math.min(100, (appState.closureSeconds / appState.settings.drowsinessDurationSec) * 100);
    closureProgress.style.width = `${percent}%`;
    closureProgress.className = `closure-progress-fill ${isAlert ? 'danger' : isWarn ? 'warn' : ''}`;
  }

  // Status text & dot
  if (statusText) statusText.textContent = status;
  if (statusDot) statusDot.style.background = getStatusColor(status);

  // EAR metrics
  if (earText) earText.textContent = appState.currentEar.toFixed(2);
  if (earBadge) earBadge.textContent = appState.currentEar.toFixed(2);

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

  // Face detection badge
  if (faceBadge) {
    if (appState.faceDetected) {
      faceBadge.className = "badge badge-safe";
      faceBadge.innerHTML = `<span class="badge-dot"></span> Face Locked`;
    } else if (appState.isMonitoring) {
      faceBadge.className = "badge badge-warn";
      faceBadge.innerHTML = `<span class="badge-dot"></span> Searching Face`;
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

  // Draw threshold line (e.g. 0.22)
  const thresholdY = h - (appState.settings.earThreshold / 0.45) * h;
  ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, thresholdY);
  ctx.lineTo(w, thresholdY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw waveform curve
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

  // Glow fill under waveform
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

  const updateActionButtonUI = (isMonitoring) => {
    const actionGroup = container.querySelector("#live-action-buttons");
    if (!actionGroup) return;

    if (isMonitoring) {
      actionGroup.innerHTML = `
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
    } else {
      actionGroup.innerHTML = `
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

    // Rebind newly created buttons
    rebindActionGroup();
  };

  const startMonitoringHandler = async () => {
    appState.startSession(appState.monitoringMode);
    if (standbyOverlay) standbyOverlay.style.display = "none";
    if (errorOverlay) errorOverlay.style.display = "none";

    const res = await visionEngine.startCamera(videoEl, canvasEl);
    if (!res.success) {
      if (errorOverlay) {
        errorOverlay.style.display = "flex";
        const desc = container.querySelector("#camera-error-desc");
        if (desc) desc.textContent = res.error;
      }
      updateActionButtonUI(false);
    } else {
      updateActionButtonUI(true);
    }
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
        updateActionButtonUI(false);
        showToast("Session Saved", "Monitoring session logged to reports.", "safe");
      }
    });
  };

  const rebindActionGroup = () => {
    const startBtn = container.querySelector("#live-start-btn");
    if (startBtn) {
      startBtn.onclick = startMonitoringHandler;
    }

    const stopBtn = container.querySelector("#live-stop-btn");
    if (stopBtn) {
      stopBtn.onclick = stopMonitoringHandler;
    }

    const resetBtn = container.querySelector("#live-reset-btn");
    if (resetBtn) {
      resetBtn.onclick = () => {
        appState.sessionDurationSec = 0;
        appState.sessionWarningsCount = 0;
        appState.closureSeconds = 0.0;
        appState.blinkCount = 0;
        showToast("Session Reset", "Telemetry timers and counters cleared.", "info");
      };
    }

    const snapBtn = container.querySelector("#live-snapshot-btn");
    if (snapBtn) {
      snapBtn.onclick = () => {
        const snapEvent = {
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          type: "MANUAL_SNAPSHOT",
          duration: "0.0s",
          ear: Number(appState.currentEar.toFixed(2)),
          severity: "Info",
          isSample: appState.monitoringMode === "sample"
        };
        appState.recentEvents.unshift(snapEvent);
        showToast("Snapshot Saved", `Telemetry snapshot captured at EAR ${appState.currentEar.toFixed(2)}`, "safe");
      };
    }
  };

  // Initial binding
  rebindActionGroup();

  // Standby overlay start button
  const standbyStartBtn = container.querySelector("#standby-start-btn");
  if (standbyStartBtn) {
    standbyStartBtn.onclick = startMonitoringHandler;
  }

  // Error overlay retry button
  const errorRetryBtn = container.querySelector("#camera-error-retry-btn");
  if (errorRetryBtn) {
    errorRetryBtn.onclick = startMonitoringHandler;
  }

  // Mode Switch (Webcam vs Benchmark)
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
      const isEnabled = !appState.settings.alarmEnabled;
      appState.saveSettings({ alarmEnabled: isEnabled });
      muteBtn.innerHTML = isEnabled ? ICONS.bell : ICONS.bellOff;
      muteBtn.title = isEnabled ? "Mute Alert Audio" : "Unmute Alert Audio";
      showToast("Audio Alert", isEnabled ? "Alert sounds enabled" : "Alert sounds muted", isEnabled ? "safe" : "warn");
    };
  }
}
