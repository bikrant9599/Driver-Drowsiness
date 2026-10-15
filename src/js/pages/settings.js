/* ==========================================================================
   VIEW: SETTINGS
   ========================================================================== */

import { ICONS, showConfirmModal, showToast } from "../utils.js";
import { appState } from "../state.js";
import { soundManager } from "../audio.js";
import { visionEngine } from "../vision.js";

export async function renderSettingsPage() {
  const container = document.createElement("div");
  container.className = "settings-container fade-in";

  const cameras = await visionEngine.enumerateCameras();

  container.innerHTML = `
    <!-- 1. Camera & Optical Sensor Hardware -->
    <div class="settings-section-card">
      <div class="card-header">
        <div class="card-title">
          ${ICONS.camera} Camera & Optical Input
        </div>
      </div>

      <div class="settings-grid-rows">
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Primary Video Capture Device</div>
            <div class="setting-desc">Select the optical camera sensor mounted facing the driver cockpit seat.</div>
          </div>
          <div class="setting-control" style="min-width: 260px;">
            <select class="form-select" id="settings-camera-select">
              <option value="">Default System Camera</option>
              ${cameras
                .map(
                  (cam) => `
                <option value="${cam.deviceId}" ${appState.settings.preferredCameraId === cam.deviceId ? 'selected' : ''}>
                  ${cam.label || `Camera Device ${cam.deviceId.slice(0, 8)}...`}
                </option>
              `
                )
                .join("")}
            </select>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Hardware Acceleration</div>
            <div class="setting-desc">Utilize WebGL/WebGPU hardware acceleration for MediaPipe 478-point 3D landmark mesh.</div>
          </div>
          <div class="setting-control">
            <span class="badge badge-safe"><span class="badge-dot"></span> Enabled (GPU Active)</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Alarm & Audio Notification Settings -->
    <div class="settings-section-card">
      <div class="card-header">
        <div class="card-title">
          ${ICONS.bell} Drowsiness Alarm & Warning Audio
        </div>
      </div>

      <div class="settings-grid-rows">
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Audio Alarm Master Switch</div>
            <div class="setting-desc">Audible buzzer / siren activates immediately when prolonged eye closure is detected.</div>
          </div>
          <div class="setting-control">
            <label class="switch-control">
              <input type="checkbox" id="settings-alarm-enabled" ${appState.settings.alarmEnabled ? 'checked' : ''} />
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Warning Tone Profile</div>
            <div class="setting-desc">Select the auditory alert profile synthesized through vehicle speakers.</div>
          </div>
          <div class="setting-control" style="min-width: 240px; display: flex; gap: 0.5rem;">
            <select class="form-select" id="settings-tone-select">
              <option value="buzzer" ${appState.settings.alarmSound === 'buzzer' ? 'selected' : ''}>Automotive Pulsing Buzzer</option>
              <option value="chime" ${appState.settings.alarmSound === 'chime' ? 'selected' : ''}>Cabin Chime (Mercedes Style)</option>
              <option value="siren" ${appState.settings.alarmSound === 'siren' ? 'selected' : ''}>High Urgency Sweep Siren</option>
            </select>
            <button class="btn btn-secondary btn-icon" id="settings-test-audio-btn" title="Preview Audio Tone">
              ${ICONS.volume2}
            </button>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Audio Volume Output</div>
            <div class="setting-desc">Master alert gain level synthesized via Web Audio API.</div>
          </div>
          <div class="setting-control">
            <div class="range-with-val">
              <input type="range" id="settings-volume-slider" min="0" max="100" step="5" value="${appState.settings.volume}" />
              <span class="range-val-badge" id="settings-volume-val">${appState.settings.volume}%</span>
            </div>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Voice Alert Prompt (Speech Synthesis)</div>
            <div class="setting-desc">Vocal speech alert announces: "Warning: Driver drowsiness detected! Pull over safely."</div>
          </div>
          <div class="setting-control">
            <label class="switch-control">
              <input type="checkbox" id="settings-speech-enabled" ${appState.settings.speechAlert ? 'checked' : ''} />
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Eye Aspect Ratio & Prolonged Closure Sensitivity -->
    <div class="settings-section-card">
      <div class="card-header">
        <div class="card-title">
          ${ICONS.gauge} Eye Closure & EAR Sensitivity
        </div>
      </div>

      <div class="settings-grid-rows">
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Prolonged Closure Trigger Duration</div>
            <div class="setting-desc">Consecutive seconds eyes must remain closed before the system triggers the critical drowsiness alarm. (Default: 2.0s)</div>
          </div>
          <div class="setting-control">
            <div class="range-with-val">
              <input type="range" id="settings-duration-slider" min="1.0" max="4.0" step="0.1" value="${appState.settings.drowsinessDurationSec}" />
              <span class="range-val-badge" id="settings-duration-val">${appState.settings.drowsinessDurationSec.toFixed(1)}s</span>
            </div>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Eye Aspect Ratio (EAR) Threshold</div>
            <div class="setting-desc">Values below this limit classify the eyelid as closed. Increase for narrow eye contours, decrease for wide eyelids. (Default: 0.22)</div>
          </div>
          <div class="setting-control">
            <div class="range-with-val">
              <input type="range" id="settings-ear-slider" min="0.16" max="0.30" step="0.01" value="${appState.settings.earThreshold}" />
              <span class="range-val-badge" id="settings-ear-val">${appState.settings.earThreshold.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. Yawning Detection (Mouth Opening Analysis) -->
    <div class="settings-section-card">
      <div class="card-header">
        <div class="card-title">
          ${ICONS.user} Yawning Detection
        </div>
      </div>

      <div class="settings-grid-rows">
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Enable Yawning Detection</div>
            <div class="setting-desc">Track mouth opening ratio (MAR) to detect fatigue yawning while filtering out ordinary speech.</div>
          </div>
          <div class="setting-control">
            <label class="switch-control">
              <input type="checkbox" id="settings-yawn-enabled" ${appState.settings.yawnDetectionEnabled ? 'checked' : ''} />
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Mouth Aspect Ratio (MAR) Threshold</div>
            <div class="setting-desc">Opening ratio required to trigger yawn classification. Higher values require wider opening. (Default: 0.60)</div>
          </div>
          <div class="setting-control">
            <div class="range-with-val">
              <input type="range" id="settings-mar-slider" min="0.45" max="0.85" step="0.05" value="${appState.settings.marThreshold}" />
              <span class="range-val-badge" id="settings-mar-val">${appState.settings.marThreshold.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Yawn Sustained Duration Threshold</div>
            <div class="setting-desc">Duration mouth must remain continuously open to avoid classifying short vocal words as yawning. (Default: 1.8s)</div>
          </div>
          <div class="setting-control">
            <div class="range-with-val">
              <input type="range" id="settings-yawn-dur-slider" min="1.0" max="3.5" step="0.1" value="${appState.settings.yawnDurationSec}" />
              <span class="range-val-badge" id="settings-yawn-dur-val">${appState.settings.yawnDurationSec.toFixed(1)}s</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 5. Head Position & Pose Estimation -->
    <div class="settings-section-card">
      <div class="card-header">
        <div class="card-title">
          ${ICONS.cpu} Head Position & Orientation
        </div>
      </div>

      <div class="settings-grid-rows">
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Enable Head Pose Monitoring</div>
            <div class="setting-desc">Detect downward head drooping or microsleep nods using 3D facial landmark geometry.</div>
          </div>
          <div class="setting-control">
            <label class="switch-control">
              <input type="checkbox" id="settings-headpose-enabled" ${appState.settings.headPoseEnabled ? 'checked' : ''} />
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Downward Head Drop Sensitivity</div>
            <div class="setting-desc">Pitch ratio limit below which head is classified as downward tilting. (Default: 0.65)</div>
          </div>
          <div class="setting-control">
            <div class="range-with-val">
              <input type="range" id="settings-headdrop-slider" min="0.45" max="0.85" step="0.05" value="${appState.settings.headDropThreshold}" />
              <span class="range-val-badge" id="settings-headdrop-val">${appState.settings.headDropThreshold.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Sustained Head Drop Duration</div>
            <div class="setting-desc">Consecutive seconds head must remain tilted downward before issuing a fatigue caution. (Default: 1.2s)</div>
          </div>
          <div class="setting-control">
            <div class="range-with-val">
              <input type="range" id="settings-head-dur-slider" min="0.8" max="2.5" step="0.1" value="${appState.settings.headDropDurationSec}" />
              <span class="range-val-badge" id="settings-head-dur-val">${appState.settings.headDropDurationSec.toFixed(1)}s</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 6. Appearance & Automotive Theme -->
    <div class="settings-section-card">
      <div class="card-header">
        <div class="card-title">
          ${ICONS.sun} Cockpit Theme & Visual Display
        </div>
      </div>

      <div class="settings-grid-rows">
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Cockpit Theme Mode</div>
            <div class="setting-desc">Switch between night-optimized Dark Navy and daylight Clean Slate themes.</div>
          </div>
          <div class="setting-control" style="gap: 0.5rem;">
            <button class="btn btn-sm ${appState.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}" id="settings-dark-theme-btn">
              ${ICONS.moon} Dark Navy
            </button>
            <button class="btn btn-sm ${appState.theme === 'light' ? 'btn-primary' : 'btn-secondary'}" id="settings-light-theme-btn">
              ${ICONS.sun} Light Slate
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 7. Data Privacy & Diagnostics -->
    <div class="settings-section-card">
      <div class="card-header">
        <div class="card-title">
          ${ICONS.shieldCheck} Data & Local Privacy
        </div>
      </div>

      <div class="settings-grid-rows">
        <div class="privacy-badge-card">
          <div class="privacy-badge-icon">${ICONS.shieldCheck}</div>
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--status-safe); margin-bottom: 0.25rem;">
              Strict Local Computer Vision Processing Guarantee
            </h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
              Camera frames are rendered to an in-memory HTML5 Canvas and processed solely within your local browser JavaScript engine. 
              No image frames, video streams, or biometric data are transmitted over the network or saved to remote cloud servers.
            </p>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-title">Reset System to Defaults</div>
            <div class="setting-desc">Restores factory default sensitivity parameters (2.0s duration, 0.22 EAR, 0.60 MAR) and restores baseline sample sessions.</div>
          </div>
          <div class="setting-control">
            <button class="btn btn-outline-danger btn-sm" id="settings-reset-all-btn">
              ${ICONS.refresh} Factory Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  bindSettingsEvents(container);

  return container;
}

function bindSettingsEvents(container) {
  // Camera dropdown
  const cameraSelect = container.querySelector("#settings-camera-select");
  if (cameraSelect) {
    cameraSelect.addEventListener("change", (e) => {
      appState.saveSettings({ preferredCameraId: e.target.value });
      showToast("Camera Updated", "Preferred input sensor saved.", "safe");
      if (appState.isMonitoring && appState.monitoringMode === "real") {
        visionEngine.stopCamera();
        visionEngine.startCamera(visionEngine.videoElement, visionEngine.canvasElement);
      }
    });
  }

  // Alarm enabled switch
  const alarmSwitch = container.querySelector("#settings-alarm-enabled");
  if (alarmSwitch) {
    alarmSwitch.addEventListener("change", (e) => {
      appState.saveSettings({ alarmEnabled: e.target.checked });
      showToast("Alarm Settings", e.target.checked ? "Audio buzzer enabled" : "Audio buzzer disabled", "info");
    });
  }

  // Tone select
  const toneSelect = container.querySelector("#settings-tone-select");
  if (toneSelect) {
    toneSelect.addEventListener("change", (e) => {
      appState.saveSettings({ alarmSound: e.target.value });
      soundManager.testAlarm();
      showToast("Tone Changed", `Selected ${e.target.value} alert.`, "info");
    });
  }

  // Test sound button
  const testBtn = container.querySelector("#settings-test-audio-btn");
  if (testBtn) {
    testBtn.addEventListener("click", () => {
      soundManager.testAlarm();
    });
  }

  // Volume slider
  const volSlider = container.querySelector("#settings-volume-slider");
  const volVal = container.querySelector("#settings-volume-val");
  if (volSlider && volVal) {
    volSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      volVal.textContent = `${val}%`;
      appState.saveSettings({ volume: val });
    });
  }

  // Speech enabled switch
  const speechSwitch = container.querySelector("#settings-speech-enabled");
  if (speechSwitch) {
    speechSwitch.addEventListener("change", (e) => {
      appState.saveSettings({ speechAlert: e.target.checked });
      showToast("Voice Alert", e.target.checked ? "Voice prompts enabled" : "Voice prompts disabled", "info");
    });
  }

  // Duration threshold slider
  const durSlider = container.querySelector("#settings-duration-slider");
  const durVal = container.querySelector("#settings-duration-val");
  if (durSlider && durVal) {
    durSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      durVal.textContent = `${val.toFixed(1)}s`;
      appState.saveSettings({ drowsinessDurationSec: val });
    });
  }

  // EAR threshold slider
  const earSlider = container.querySelector("#settings-ear-slider");
  const earVal = container.querySelector("#settings-ear-val");
  if (earSlider && earVal) {
    earSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      earVal.textContent = val.toFixed(2);
      appState.saveSettings({ earThreshold: val });
    });
  }

  // Yawning enabled switch
  const yawnSwitch = container.querySelector("#settings-yawn-enabled");
  if (yawnSwitch) {
    yawnSwitch.addEventListener("change", (e) => {
      appState.saveSettings({ yawnDetectionEnabled: e.target.checked });
      showToast("Yawning Detection", e.target.checked ? "Yawn detection enabled" : "Yawn detection disabled", "info");
    });
  }

  // MAR threshold slider
  const marSlider = container.querySelector("#settings-mar-slider");
  const marVal = container.querySelector("#settings-mar-val");
  if (marSlider && marVal) {
    marSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      marVal.textContent = val.toFixed(2);
      appState.saveSettings({ marThreshold: val });
    });
  }

  // Yawn duration slider
  const yawnDurSlider = container.querySelector("#settings-yawn-dur-slider");
  const yawnDurVal = container.querySelector("#settings-yawn-dur-val");
  if (yawnDurSlider && yawnDurVal) {
    yawnDurSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      yawnDurVal.textContent = `${val.toFixed(1)}s`;
      appState.saveSettings({ yawnDurationSec: val });
    });
  }

  // Head pose enabled switch
  const headposeSwitch = container.querySelector("#settings-headpose-enabled");
  if (headposeSwitch) {
    headposeSwitch.addEventListener("change", (e) => {
      appState.saveSettings({ headPoseEnabled: e.target.checked });
      showToast("Head Pose Monitoring", e.target.checked ? "Head pose monitoring enabled" : "Head pose monitoring disabled", "info");
    });
  }

  // Head drop threshold slider
  const headDropSlider = container.querySelector("#settings-headdrop-slider");
  const headDropVal = container.querySelector("#settings-headdrop-val");
  if (headDropSlider && headDropVal) {
    headDropSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      headDropVal.textContent = val.toFixed(2);
      appState.saveSettings({ headDropThreshold: val });
    });
  }

  // Head drop duration slider
  const headDurSlider = container.querySelector("#settings-head-dur-slider");
  const headDurVal = container.querySelector("#settings-head-dur-val");
  if (headDurSlider && headDurVal) {
    headDurSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      headDurVal.textContent = `${val.toFixed(1)}s`;
      appState.saveSettings({ headDropDurationSec: val });
    });
  }

  // Theme buttons
  const darkBtn = container.querySelector("#settings-dark-theme-btn");
  const lightBtn = container.querySelector("#settings-light-theme-btn");
  if (darkBtn && lightBtn) {
    darkBtn.addEventListener("click", () => {
      appState.setTheme("dark");
      appState.setPage("settings");
    });
    lightBtn.addEventListener("click", () => {
      appState.setTheme("light");
      appState.setPage("settings");
    });
  }

  // Factory reset
  const resetBtn = container.querySelector("#settings-reset-all-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      showConfirmModal({
        title: "Restore Factory Default Settings?",
        message: "This will restore default sensitivity parameters (2.0s duration, 0.22 EAR, 0.60 MAR) and reset session logs.",
        confirmText: "Restore Defaults",
        isDanger: true,
        onConfirm: () => {
          appState.resetAll();
          showToast("Settings Reset", "Default telematics parameters restored.", "safe");
          appState.setPage("settings");
        }
      });
    });
  }
}
