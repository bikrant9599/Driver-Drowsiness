/* ==========================================================================
   AUDIO SYNTHESIZER & AUDIBLE ALARM SYSTEM
   Multiple selectable automotive & digital warning tones via Web Audio API
   ========================================================================== */

export const SOUND_PRESETS = [
  {
    id: "classic_beep",
    name: "Classic Beep",
    desc: "Simple, short warning beeps"
  },
  {
    id: "emergency_alert",
    name: "Emergency Alert",
    desc: "Urgent, repeating warning tone"
  },
  {
    id: "double_beep",
    name: "Double Beep",
    desc: "Two clear beeps repeated at intervals"
  },
  {
    id: "digital_alarm",
    name: "Digital Alarm",
    desc: "Modern electronic warning sound"
  },
  {
    id: "pulsing_warning",
    name: "Pulsing Warning",
    desc: "A repeating pulsed warning tone"
  }
];

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.intervalId = null;

    // Load persisted volume & mute
    const savedVol = localStorage.getItem("drowsiness_alarm_volume");
    this.volume = savedVol !== null ? Math.max(0, Math.min(100, parseInt(savedVol, 10))) : 80;

    const savedMute = localStorage.getItem("drowsiness_alarm_muted");
    this.isMuted = savedMute === "true";

    // Load persisted sound preset (default classic_beep)
    const savedSound = localStorage.getItem("drowsiness_selected_sound");
    const validIds = SOUND_PRESETS.map((p) => p.id);
    this.selectedSound = validIds.includes(savedSound) ? savedSound : "classic_beep";

    this.isAudioBlocked = false;
  }

  async initContext() {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioCtx = new AudioContext();
        }
      }

      if (this.audioCtx && this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      const isRunning = Boolean(this.audioCtx && this.audioCtx.state === "running");
      this.isAudioBlocked = !isRunning;
      return isRunning;
    } catch (err) {
      console.warn("AudioContext init error:", err);
      this.isAudioBlocked = true;
      return false;
    }
  }

  getGainLevel(overrideMute = false) {
    if (!overrideMute && this.isMuted) return 0;
    const effectiveVol = overrideMute && this.volume <= 0 ? 50 : this.volume;
    return Math.max(0.04, (effectiveVol / 100) * 0.45);
  }

  /**
   * Helper to play a single synthesized note
   */
  playTone(freq, type, startTime, duration, gainLevel) {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(gainLevel, startTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    } catch (e) {
      console.warn("Tone error:", e);
    }
  }

  /**
   * Helper to play frequency ramp / sweep
   */
  playRampTone(startFreq, endFreq, type, startTime, duration, gainLevel) {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(startFreq, startTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(gainLevel, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    } catch (e) {
      console.warn("Ramp tone error:", e);
    }
  }

  /* -------------------------------------------------------------------------
     Sound Presets Implementations
     ------------------------------------------------------------------------- */

  // 1. Classic Beep: Simple, short clean warning beep
  playClassicBeep(gainLevel) {
    const now = this.audioCtx.currentTime;
    this.playTone(820, "sine", now, 0.12, gainLevel);
  }

  // 2. Emergency Alert: Urgent repeating 3-tone siren
  playEmergencyAlert(gainLevel) {
    const now = this.audioCtx.currentTime;
    this.playTone(980, "triangle", now, 0.09, gainLevel);
    this.playTone(740, "triangle", now + 0.095, 0.09, gainLevel);
    this.playTone(980, "triangle", now + 0.19, 0.11, gainLevel);
  }

  // 3. Double Beep: Two clear high-visibility beeps
  playDoubleBeep(gainLevel) {
    const now = this.audioCtx.currentTime;
    this.playTone(1050, "sine", now, 0.075, gainLevel);
    this.playTone(1050, "sine", now + 0.12, 0.085, gainLevel);
  }

  // 4. Digital Alarm: Modern electronic triple-chirp pager/watch sound
  playDigitalAlarm(gainLevel) {
    const now = this.audioCtx.currentTime;
    this.playTone(1250, "sine", now, 0.045, gainLevel);
    this.playTone(1250, "sine", now + 0.065, 0.045, gainLevel);
    this.playTone(1420, "sine", now + 0.13, 0.065, gainLevel * 1.1);
  }

  // 5. Pulsing Warning: Smooth rising acoustic double-pulse
  playPulsingWarning(gainLevel) {
    const now = this.audioCtx.currentTime;
    this.playRampTone(640, 960, "triangle", now, 0.14, gainLevel);
    this.playRampTone(640, 960, "triangle", now + 0.16, 0.16, gainLevel);
  }

  /**
   * Dispatch single playback of any preset
   */
  playPresetPattern(presetId, overrideMute = false) {
    const gainLevel = this.getGainLevel(overrideMute);
    if (gainLevel <= 0) return;

    this.initContext();
    if (!this.audioCtx || this.audioCtx.state !== "running") return;

    switch (presetId) {
      case "classic_beep":
        this.playClassicBeep(gainLevel);
        break;
      case "emergency_alert":
        this.playEmergencyAlert(gainLevel);
        break;
      case "double_beep":
        this.playDoubleBeep(gainLevel);
        break;
      case "digital_alarm":
        this.playDigitalAlarm(gainLevel);
        break;
      case "pulsing_warning":
        this.playPulsingWarning(gainLevel);
        break;
      default:
        this.playClassicBeep(gainLevel);
        break;
    }
  }

  /**
   * Preview a sound preset (plays once even if muted, for user testing)
   */
  async previewSound(presetId) {
    await this.initContext();
    this.playPresetPattern(presetId, true);
  }

  /**
   * Start drowsiness warning alarm based on currently selected preset
   */
  startDrowsinessAlert() {
    if (this.isPlaying) return; // Prevent multiple simultaneous alarms
    this.isPlaying = true;

    this.initContext();
    this.playPresetPattern(this.selectedSound, false);

    // Cadence intervals calibrated to each sound pattern
    const cadenceMap = {
      classic_beep: 500,
      emergency_alert: 440,
      double_beep: 800,
      digital_alarm: 720,
      pulsing_warning: 850
    };

    const interval = cadenceMap[this.selectedSound] || 600;

    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      if (!this.isPlaying) return;
      this.playPresetPattern(this.selectedSound, false);
    }, interval);
  }

  /**
   * Stop active alarm immediately
   */
  stopDrowsinessAlert() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Test current alert sound
   */
  async testAlertSound() {
    await this.initContext();
    this.playPresetPattern(this.selectedSound, true);
  }

  /**
   * Select a sound preset
   */
  selectSound(presetId) {
    const validIds = SOUND_PRESETS.map((p) => p.id);
    if (validIds.includes(presetId)) {
      this.selectedSound = presetId;
      localStorage.setItem("drowsiness_selected_sound", presetId);

      // If alarm is actively sounding, seamlessly switch cadence
      if (this.isPlaying) {
        this.stopDrowsinessAlert();
        this.startDrowsinessAlert();
      }
    }
  }

  /**
   * Set volume level (0-100)
   */
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(100, Math.round(vol)));
    localStorage.setItem("drowsiness_alarm_volume", this.volume.toString());
  }

  /**
   * Toggle mute
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem("drowsiness_alarm_muted", this.isMuted ? "true" : "false");
    if (this.isMuted) {
      this.stopDrowsinessAlert();
    }
    return this.isMuted;
  }
}

export const soundManager = new SoundManager();
