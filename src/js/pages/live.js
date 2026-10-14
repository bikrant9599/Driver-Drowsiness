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
              ${appState.faceDetected ? 'Face Locked' : 'Searching Face'}
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

          <!-- Floating HUD Overlays -->
          <div class="hud-corner hud-top-left">
            <div class="hud-pill" id="hud-status-pill">
              <span class="badge-dot" style="background: ${appState.driverStatus === 'DROWSY_ALERT' ? 'var(--status-danger)' : 'var(--status-safe)'};"></span>
              <span id="hud-status-text">${appState.driverStatus.replace('_', ' ')}</span>
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
              <span>EYES: <strong id="hud-eye-state-text" style="color: ${appState.eyeState === 'CLOSED' ? '#ef4444' : '#10b981'};">${appState.eyeState}</strong></span>
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
          <div class="control-btn-group">
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
            <span>Warning: 1.0s</span>
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
            <span style="color: var(--status-safe);">Attentive: &gt;0.25</span>
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

  // Start video stream & canvas after DOM is mounted
  setTimeout(() => {
    initLiveCameraAndCanvas(container);
  }, 20);

  // Bind Buttons
  bindLiveButtons(container);

  return container;
}

function initLiveCameraAndCanvas(container) {
  const videoEl = container.querySelector("#webcam-video");
  const canvasEl = container.querySelector("#overlay-canvas");

  if (!appState.isMonitoring) {
    appState.startSession(appState.monitoringMode);
  }

  visionEngine.startCamera(videoEl, canvasEl);

  // Setup periodic UI update loop
  if (liveUpdateInterval) clearInterval(liveUpdateInterval);
  liveUpdateInterval = setInterval(() => {
    updateLiveTelemetryUI(container);
  }, 80);
}

function updateLiveTelemetryUI(container) {
  if (!container || !container.isConnected) {
    if (liveUpdateInterval) {
      clearInterval(liveUpdateInterval);
      liveUpdateInterval = null;
    }
    return;
  }

  const isDrowsy = appState.driverStatus === "DROWSY_ALERT";
  const isWarn = appState.driverStatus === "MINOR_FATIGUE";

  // Elements
  const viewport = container.querySelector("#live-video-viewport");
  const alertBanner = container.querySelector("#hud-alert-banner");
  const closureDisplay = container.querySelector("#live-closure-display");
  const closureProgress = container.querySelector("#live-closure-progress");
  const earText = container.querySelector("#hud-ear-text");
  const earBadge = container.querySelector("#live-ear-badge");
  const eyeStateText = container.querySelector("#hud-eye-state-text");
  const statusText = container.querySelector("#hud-status-text");
  const durationText = container.querySelector("#hud-duration-text");
  const leftEarEl = container.querySelector("#live-left-ear");
  const rightEarEl = container.querySelector("#live-right-ear");
  const sessionAlertsEl = container.querySelector("#live-session-alerts");
  const faceBadge = container.querySelector("#live-face-badge");

  // Drowsiness visual indicators
  if (viewport) {
    if (isDrowsy) {
      viewport.classList.add("alert-active");
    } else {
      viewport.classList.remove("alert-active");
    }
  }

  if (alertBanner) {
    if (isDrowsy) {
      alertBanner.classList.add("active");
    } else {
      alertBanner.classList.remove("active");
    }
  }

  // Timer & progress bar
  if (closureDisplay) {
    closureDisplay.textContent = `${appState.closureSeconds.toFixed(1)}s`;
    closureDisplay.className = `timer-large tabular-nums ${isDrowsy ? 'danger' : isWarn ? 'warn' : ''}`;
  }

  if (closureProgress) {
    const percent = Math.min(100, (appState.closureSeconds / appState.settings.drowsinessDurationSec) * 100);
    closureProgress.style.width = `${percent}%`;
    closureProgress.className = `closure-progress-fill ${isDrowsy ? 'danger' : isWarn ? 'warn' : ''}`;
  }

  // Status updates
  if (earText) earText.textContent = appState.currentEar.toFixed(2);
  if (earBadge) earBadge.textContent = appState.currentEar.toFixed(2);
  if (eyeStateText) {
    eyeStateText.textContent = appState.eyeState;
    eyeStateText.style.color = appState.eyeState === "CLOSED" ? "var(--status-danger)" : "var(--status-safe)";
  }
  if (statusText) statusText.textContent = appState.driverStatus.replace("_", " ");
  if (durationText) durationText.textContent = formatDuration(appState.sessionDurationSec);
  if (leftEarEl) leftEarEl.textContent = appState.leftEar.toFixed(2);
  if (rightEarEl) rightEarEl.textContent = appState.rightEar.toFixed(2);
  if (sessionAlertsEl) sessionAlertsEl.textContent = appState.sessionWarningsCount;

  if (faceBadge) {
    faceBadge.className = `badge ${appState.faceDetected ? 'badge-safe' : 'badge-neutral'}`;
    faceBadge.innerHTML = appState.faceDetected
      ? `<span class="badge-dot"></span> Face Locked`
      : `<span class="badge-dot"></span> Searching Face`;
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

  // Draw threshold line (0.22)
  const thresholdY = h - (appState.settings.earThreshold / 0.45) * h;
  ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, thresholdY);
  ctx.lineTo(w, thresholdY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw waveform line
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = appState.driverStatus === "DROWSY_ALERT" ? "#ef4444" : "#06b6d4";

  const step = w / (visionEngine.historyMaxPoints - 1);
  history.forEach((val, i) => {
    const x = i * step;
    const y = Math.max(4, Math.min(h - 4, h - (val / 0.45) * h));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Glow fill under curve
  ctx.lineTo((history.length - 1) * step, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, appState.driverStatus === "DROWSY_ALERT" ? "rgba(239, 68, 68, 0.25)" : "rgba(6, 182, 212, 0.2)");
  grad.addColorStop(1, "rgba(7, 13, 25, 0)");
  ctx.fillStyle = grad;
  ctx.fill();
}

function bindLiveButtons(container) {
  // Start / Stop
  const startBtn = container.querySelector("#live-start-btn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      appState.startSession(appState.monitoringMode);
      appState.setPage("live");
    });
  }

  const stopBtn = container.querySelector("#live-stop-btn");
  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      showConfirmModal({
        title: "End Driver Monitoring Session?",
        message: "This will save your current telemetry session to the Reports log and cease video processing.",
        confirmText: "Stop & Save",
        isDanger: true,
        onConfirm: () => {
          visionEngine.stopCamera();
          appState.stopSession();
          showToast("Session Saved", "Monitoring session logged to reports.", "safe");
          appState.setPage("reports");
        }
      });
    });
  }

  // Reset Session
  const resetBtn = container.querySelector("#live-reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      appState.sessionDurationSec = 0;
      appState.sessionWarningsCount = 0;
      appState.closureSeconds = 0.0;
      showToast("Session Reset", "Telemetry timers and counters cleared.", "info");
    });
  }

  // Mode Switch (Webcam vs Benchmark)
  const modeSwitchBtn = container.querySelector("#live-switch-mode-btn");
  if (modeSwitchBtn) {
    modeSwitchBtn.addEventListener("click", () => {
      visionEngine.stopCamera();
      const newMode = appState.monitoringMode === "sample" ? "real" : "sample";
      appState.monitoringMode = newMode;
      showToast(
        "Mode Changed",
        newMode === "real" ? "Switched to Live Hardware Webcam AI" : "Switched to Benchmark Simulation Test",
        "info"
      );
      appState.setPage("live");
    });
  }

  // Test Alarm
  const testAlarmBtn = container.querySelector("#live-test-sound-btn");
  if (testAlarmBtn) {
    testAlarmBtn.addEventListener("click", () => {
      soundManager.testAlarm();
      showToast("Alarm Test", `Sounding ${appState.settings.alarmSound} tone alert.`, "info");
    });
  }

  // Mute / Unmute Toggle
  const muteBtn = container.querySelector("#live-alarm-mute-btn");
  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      const isEnabled = !appState.settings.alarmEnabled;
      appState.saveSettings({ alarmEnabled: isEnabled });
      muteBtn.innerHTML = isEnabled ? ICONS.bell : ICONS.bellOff;
      muteBtn.title = isEnabled ? "Mute Alert Audio" : "Unmute Alert Audio";
      showToast("Audio Alert", isEnabled ? "Alert sounds enabled" : "Alert sounds muted", isEnabled ? "safe" : "warn");
    });
  }

  // Snapshot
  const snapBtn = container.querySelector("#live-snapshot-btn");
  if (snapBtn) {
    snapBtn.addEventListener("click", () => {
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
    });
  }
}
