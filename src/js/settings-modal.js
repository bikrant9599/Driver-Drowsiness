/* ==========================================================================
   ESSENTIAL SETTINGS MODAL
   Compact secondary menu containing only essential hardware and alarm options
   ========================================================================== */

import { ICONS, showToast } from "./utils.js";
import { appState } from "./state.js";
import { soundManager } from "./audio.js";
import { visionEngine } from "./vision.js";

export async function openSettingsModal() {
  let modalOverlay = document.getElementById("settings-modal-overlay");
  if (!modalOverlay) {
    modalOverlay = document.createElement("div");
    modalOverlay.id = "settings-modal-overlay";
    modalOverlay.className = "modal-overlay";
    document.body.appendChild(modalOverlay);
  }

  const cameras = await visionEngine.enumerateCameras();

  modalOverlay.innerHTML = `
    <div class="modal-dialog settings-modal-dialog">
      <div class="modal-header">
        <div class="modal-title">
          ${ICONS.settings}
          <span>Settings</span>
        </div>
        <button class="modal-close-btn" id="settings-close-x" aria-label="Close settings">
          ${ICONS.close}
        </button>
      </div>

      <div class="modal-body settings-modal-body">
        <!-- 1. Drowsiness Alarm Threshold -->
        <div class="compact-setting-item">
          <label class="setting-label" for="setting-duration-select">
            <strong>Drowsiness Alarm Threshold</strong>
            <span>Seconds of continuous eye closure before sounding alarm</span>
          </label>
          <select class="form-select" id="setting-duration-select">
            <option value="1.5" ${appState.settings.drowsinessDurationSec === 1.5 ? 'selected' : ''}>1.5 seconds (High Sensitivity)</option>
            <option value="2.0" ${appState.settings.drowsinessDurationSec === 2.0 ? 'selected' : ''}>2.0 seconds (Recommended)</option>
            <option value="2.5" ${appState.settings.drowsinessDurationSec === 2.5 ? 'selected' : ''}>2.5 seconds (Relaxed)</option>
          </select>
        </div>

        <!-- 2. Alarm Sound -->
        <div class="compact-setting-item">
          <label class="setting-label" for="setting-sound-select">
            <strong>Alarm Tone</strong>
            <span>Audible warning tone pattern</span>
          </label>
          <select class="form-select" id="setting-sound-select">
            <option value="buzzer" ${appState.settings.alarmSound === 'buzzer' ? 'selected' : ''}>Automotive Buzzer</option>
            <option value="chime" ${appState.settings.alarmSound === 'chime' ? 'selected' : ''}>Cabin Chime</option>
            <option value="siren" ${appState.settings.alarmSound === 'siren' ? 'selected' : ''}>High-Alert Siren</option>
          </select>
        </div>

        <!-- 3. Volume & Test -->
        <div class="compact-setting-item">
          <label class="setting-label" for="setting-volume-slider">
            <strong>Alarm Volume</strong>
            <span id="volume-val-display">${appState.settings.volume}%</span>
          </label>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <input type="range" class="form-range" id="setting-volume-slider" min="10" max="100" value="${appState.settings.volume}" />
            <button class="btn btn-secondary btn-sm" id="setting-test-sound-btn" type="button">
              ${ICONS.volume2} Test Tone
            </button>
          </div>
        </div>

        <!-- 4. Camera Selection (if available) -->
        ${
          cameras.length > 1
            ? `
          <div class="compact-setting-item">
            <label class="setting-label" for="setting-camera-select">
              <strong>Camera Device</strong>
              <span>Select primary webcam</span>
            </label>
            <select class="form-select" id="setting-camera-select">
              <option value="">Default System Camera</option>
              ${cameras
                .map(
                  (c) => `
                <option value="${c.deviceId}" ${appState.settings.preferredCameraId === c.deviceId ? 'selected' : ''}>
                  ${c.label || `Camera ${c.deviceId.slice(0, 8)}...`}
                </option>
              `
                )
                .join("")}
            </select>
          </div>
        `
            : ""
        }
      </div>

      <div class="modal-footer">
        <button class="btn btn-primary" id="settings-done-btn" style="width: 100%;">Done</button>
      </div>
    </div>
  `;

  modalOverlay.classList.add("open");

  const closeModal = () => {
    modalOverlay.classList.remove("open");
  };

  const closeX = modalOverlay.querySelector("#settings-close-x");
  const doneBtn = modalOverlay.querySelector("#settings-done-btn");
  const durationSelect = modalOverlay.querySelector("#setting-duration-select");
  const soundSelect = modalOverlay.querySelector("#setting-sound-select");
  const volumeSlider = modalOverlay.querySelector("#setting-volume-slider");
  const volumeDisplay = modalOverlay.querySelector("#volume-val-display");
  const testBtn = modalOverlay.querySelector("#setting-test-sound-btn");
  const cameraSelect = modalOverlay.querySelector("#setting-camera-select");

  if (closeX) closeX.onclick = closeModal;
  if (doneBtn) doneBtn.onclick = closeModal;

  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) closeModal();
  };

  if (durationSelect) {
    durationSelect.onchange = (e) => {
      appState.saveSettings({ drowsinessDurationSec: parseFloat(e.target.value) });
    };
  }

  if (soundSelect) {
    soundSelect.onchange = (e) => {
      appState.saveSettings({ alarmSound: e.target.value });
    };
  }

  if (volumeSlider) {
    volumeSlider.oninput = (e) => {
      const val = parseInt(e.target.value, 10);
      if (volumeDisplay) volumeDisplay.textContent = `${val}%`;
      appState.saveSettings({ volume: val });
    };
  }

  if (testBtn) {
    testBtn.onclick = () => {
      soundManager.playTestAlarm();
    };
  }

  if (cameraSelect) {
    cameraSelect.onchange = (e) => {
      appState.saveSettings({ preferredCameraId: e.target.value });
      showToast("Camera Selected", "Device preference updated.", "info");
    };
  }
}
