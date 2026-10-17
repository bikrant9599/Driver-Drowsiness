/* ==========================================================================
   AUDIO SYNTHESIZER & AUDIBLE ALARM SYSTEM
   High-Priority Emergency Alarm: Dual-Layered Siren Wail + Pulsing Strobe
   Synthesized programmatically via the Web Audio API
   ========================================================================== */

export const ALERT_SOUND_NAME = "Emergency Siren";

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.currentAlarm = null; // { sirenCarrier, sirenLfo, pulseCarrier, pulseLfo, masterGain }
    this.testTimeoutId = null;

    // Load persisted volume & mute
    const savedVol = localStorage.getItem("drowsiness_alarm_volume");
    this.volume = savedVol !== null ? Math.max(0, Math.min(100, parseInt(savedVol, 10))) : 80;

    const savedMute = localStorage.getItem("drowsiness_alarm_muted");
    this.isMuted = savedMute === "true";

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
    // Calibrated safe master gain to prevent distortion or clipping
    return Math.max(0.04, (effectiveVol / 100) * 0.40);
  }

  /**
   * Start the dual-layer High-Priority Emergency Siren:
   * Layer 1: Fast alternating high-low siren wail (430Hz - 1070Hz at 3.2Hz)
   * Layer 2: Sharp, rapid electronic warning strobe tone (1450Hz pulsing at 8Hz)
   * Plays continuously without gaps while genuine drowsiness is active
   */
  startContinuousAlarm(overrideMute = false) {
    if (this.currentAlarm) return; // Prevent duplicate instances

    const gainLevel = this.getGainLevel(overrideMute);
    if (gainLevel <= 0) return;

    this.initContext();
    if (!this.audioCtx || this.audioCtx.state !== "running") return;

    try {
      const now = this.audioCtx.currentTime;

      // Master output gain
      const masterGain = this.audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(gainLevel, now + 0.02);
      masterGain.connect(this.audioCtx.destination);

      // --- LAYER 1: Alternating High-Low Siren Wail ---
      const sirenCarrier = this.audioCtx.createOscillator();
      sirenCarrier.type = "sawtooth";
      sirenCarrier.frequency.setValueAtTime(750, now);

      const sirenLfo = this.audioCtx.createOscillator();
      sirenLfo.type = "triangle";
      sirenLfo.frequency.setValueAtTime(3.2, now); // Fast 3.2 sweeps per second

      const sirenLfoGain = this.audioCtx.createGain();
      sirenLfoGain.gain.setValueAtTime(320, now); // 750 ± 320 Hz (430Hz to 1070Hz)

      sirenLfo.connect(sirenLfoGain);
      sirenLfoGain.connect(sirenCarrier.frequency);

      const sirenFilter = this.audioCtx.createBiquadFilter();
      sirenFilter.type = "lowpass";
      sirenFilter.frequency.setValueAtTime(2200, now);
      sirenFilter.Q.setValueAtTime(1.8, now);

      const sirenGain = this.audioCtx.createGain();
      sirenGain.gain.setValueAtTime(0.65, now);

      sirenCarrier.connect(sirenFilter);
      sirenFilter.connect(sirenGain);
      sirenGain.connect(masterGain);

      // --- LAYER 2: Sharp Pulsing Electronic Warning Tone (Strobe) ---
      const pulseCarrier = this.audioCtx.createOscillator();
      pulseCarrier.type = "square";
      pulseCarrier.frequency.setValueAtTime(1450, now); // Piercing electronic frequency

      // 8 Hz Pulse LFO toggling the amplitude rapidly
      const pulseLfo = this.audioCtx.createOscillator();
      pulseLfo.type = "square";
      pulseLfo.frequency.setValueAtTime(8.0, now); // 8 sharp pulses/second

      const pulseLfoGain = this.audioCtx.createGain();
      pulseLfoGain.gain.setValueAtTime(0.5, now);

      const pulseAmpGain = this.audioCtx.createGain();
      pulseAmpGain.gain.setValueAtTime(0.5, now);

      pulseLfo.connect(pulseLfoGain);
      pulseLfoGain.connect(pulseAmpGain.gain);

      const pulseFilter = this.audioCtx.createBiquadFilter();
      pulseFilter.type = "bandpass";
      pulseFilter.frequency.setValueAtTime(1450, now);
      pulseFilter.Q.setValueAtTime(2.5, now);

      const pulseGain = this.audioCtx.createGain();
      pulseGain.gain.setValueAtTime(0.40, now);

      pulseCarrier.connect(pulseFilter);
      pulseFilter.connect(pulseAmpGain);
      pulseAmpGain.connect(pulseGain);
      pulseGain.connect(masterGain);

      // Start all oscillators
      sirenCarrier.start(now);
      sirenLfo.start(now);
      pulseCarrier.start(now);
      pulseLfo.start(now);

      this.currentAlarm = {
        sirenCarrier,
        sirenLfo,
        pulseCarrier,
        pulseLfo,
        masterGain
      };
    } catch (e) {
      console.warn("Error starting emergency alarm:", e);
      this.currentAlarm = null;
    }
  }

  /**
   * Stop the emergency alarm immediately with a 25ms smooth fade-out (no clicks/pops)
   */
  stopContinuousAlarm() {
    if (!this.currentAlarm) return;

    const { sirenCarrier, sirenLfo, pulseCarrier, pulseLfo, masterGain } = this.currentAlarm;
    this.currentAlarm = null;

    try {
      if (this.audioCtx && this.audioCtx.state === "running") {
        const now = this.audioCtx.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.025);

        sirenCarrier.stop(now + 0.03);
        sirenLfo.stop(now + 0.03);
        pulseCarrier.stop(now + 0.03);
        pulseLfo.stop(now + 0.03);

        setTimeout(() => {
          try {
            sirenCarrier.disconnect();
            sirenLfo.disconnect();
            pulseCarrier.disconnect();
            pulseLfo.disconnect();
            masterGain.disconnect();
          } catch (e) {}
        }, 50);
      } else {
        sirenCarrier.stop();
        sirenLfo.stop();
        pulseCarrier.stop();
        pulseLfo.stop();
      }
    } catch (e) {
      console.warn("Error stopping emergency alarm:", e);
    }
  }

  /**
   * Start repeating emergency siren when genuine drowsiness is confirmed
   * Continues seamlessly without pauses while warning remains active
   * Prevents multiple sirens from playing simultaneously
   */
  startDrowsinessAlert() {
    if (this.testTimeoutId) {
      clearTimeout(this.testTimeoutId);
      this.testTimeoutId = null;
    }

    if (this.isPlaying) return; // Prevent multiple overlapping siren instances
    this.isPlaying = true;

    this.initContext();
    this.startContinuousAlarm(false);
  }

  /**
   * Stop the active siren immediately when warning condition clears or monitoring stops
   */
  stopDrowsinessAlert() {
    this.isPlaying = false;
    if (this.testTimeoutId) {
      clearTimeout(this.testTimeoutId);
      this.testTimeoutId = null;
    }
    this.stopContinuousAlarm();
  }

  /**
   * Test the emergency siren (runs continuously for 2.0s, then cleanly stops)
   */
  async testAlertSound() {
    await this.initContext();

    // Reset any currently playing siren
    this.stopDrowsinessAlert();

    this.startContinuousAlarm(true);

    this.testTimeoutId = setTimeout(() => {
      this.stopContinuousAlarm();
      this.testTimeoutId = null;
    }, 2000);
  }

  /**
   * Update volume level (0-100)
   */
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(100, Math.round(vol)));
    localStorage.setItem("drowsiness_alarm_volume", this.volume.toString());

    // Dynamically update active alarm gain in real time
    if (this.currentAlarm && this.audioCtx && this.audioCtx.state === "running") {
      try {
        const gain = this.getGainLevel(false);
        this.currentAlarm.masterGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
        this.currentAlarm.masterGain.gain.linearRampToValueAtTime(gain, this.audioCtx.currentTime + 0.02);
      } catch (e) {}
    }
  }

  /**
   * Toggle mute state
   * If muted, visual warnings continue displaying in the UI
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem("drowsiness_alarm_muted", this.isMuted ? "true" : "false");

    if (this.isMuted) {
      // Immediately silence the audio while visual warning remains active
      this.stopContinuousAlarm();
    } else if (this.isPlaying) {
      // If unmuted while drowsiness is still active, immediately resume alarm
      this.startContinuousAlarm(false);
    }
    return this.isMuted;
  }
}

export const soundManager = new SoundManager();
