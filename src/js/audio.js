/* ==========================================================================
   AUDIO SYNTHESIZER & AUDIBLE ALARM SYSTEM
   Loud, intense, continuous rising-and-falling Emergency Siren (Web Audio API)
   ========================================================================== */

export const ALERT_SOUND_NAME = "Emergency Siren";

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.currentSiren = null; // { carrier, lfo, lfoGain, filter, gainNode }
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
    // Calibrated safe gain level to prevent speaker clipping or hearing fatigue
    return Math.max(0.04, (effectiveVol / 100) * 0.42);
  }

  /**
   * Start the continuous Emergency Siren
   * Rapidly rising and falling pitch (440Hz <-> 1200Hz sweep) with zero pauses between cycles
   */
  startContinuousSiren(overrideMute = false) {
    // Prevent multiple overlapping siren instances
    if (this.currentSiren) return;

    const gainLevel = this.getGainLevel(overrideMute);
    if (gainLevel <= 0) return;

    this.initContext();
    if (!this.audioCtx || this.audioCtx.state !== "running") return;

    try {
      const now = this.audioCtx.currentTime;

      // 1. Primary Sound Generator (Carrier Oscillator)
      // Sawtooth wave for sharp, urgent, attention-grabbing emergency harmonics
      const carrier = this.audioCtx.createOscillator();
      carrier.type = "sawtooth";
      carrier.frequency.setValueAtTime(820, now);

      // 2. Frequency Modulation LFO for seamless, relentless rising-and-falling wail
      // Triangle wave modulates pitch smoothly from 440 Hz up to 1200 Hz
      const lfo = this.audioCtx.createOscillator();
      lfo.type = "triangle";
      lfo.frequency.setValueAtTime(2.6, now); // 2.6 complete cycles per second for high-urgency cadence

      // Modulation depth: 820 Hz ± 380 Hz
      const lfoGain = this.audioCtx.createGain();
      lfoGain.gain.setValueAtTime(380, now);

      lfo.connect(lfoGain);
      lfoGain.connect(carrier.frequency);

      // 3. Acoustic Low-Pass Filter
      // Filters harsh extreme high frequencies (above 2500Hz) to prevent clipping/distortion
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2500, now);
      filter.Q.setValueAtTime(2.2, now); // Slight resonance for solid acoustic presence on speakers

      // 4. Output Volume Gain Node with smooth rapid attack
      const gainNode = this.audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(gainLevel, now + 0.02);

      // Connect nodes
      carrier.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      carrier.start(now);
      lfo.start(now);

      this.currentSiren = { carrier, lfo, lfoGain, filter, gainNode };
    } catch (e) {
      console.warn("Error starting continuous siren:", e);
      this.currentSiren = null;
    }
  }

  /**
   * Stop the continuous Emergency Siren immediately with clean smooth fade-out (no clicks/pops)
   */
  stopContinuousSiren() {
    if (!this.currentSiren) return;

    const { carrier, lfo, gainNode } = this.currentSiren;
    this.currentSiren = null;

    try {
      if (this.audioCtx && this.audioCtx.state === "running") {
        const now = this.audioCtx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.025);

        carrier.stop(now + 0.03);
        lfo.stop(now + 0.03);

        setTimeout(() => {
          try {
            carrier.disconnect();
            lfo.disconnect();
            gainNode.disconnect();
          } catch (e) {}
        }, 50);
      } else {
        carrier.stop();
        lfo.stop();
      }
    } catch (e) {
      console.warn("Error stopping continuous siren:", e);
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
    this.startContinuousSiren(false);
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
    this.stopContinuousSiren();
  }

  /**
   * Test the emergency siren (runs continuously for 2.0s, then cleanly stops)
   */
  async testAlertSound() {
    await this.initContext();

    // Reset any currently playing siren
    this.stopDrowsinessAlert();

    this.startContinuousSiren(true);

    this.testTimeoutId = setTimeout(() => {
      this.stopContinuousSiren();
      this.testTimeoutId = null;
    }, 2000);
  }

  /**
   * Update volume level (0-100)
   */
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(100, Math.round(vol)));
    localStorage.setItem("drowsiness_alarm_volume", this.volume.toString());

    // Dynamically update active siren gain in real time
    if (this.currentSiren && this.audioCtx && this.audioCtx.state === "running") {
      try {
        const gain = this.getGainLevel(false);
        this.currentSiren.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
        this.currentSiren.gainNode.gain.linearRampToValueAtTime(gain, this.audioCtx.currentTime + 0.02);
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
      this.stopContinuousSiren();
    } else if (this.isPlaying) {
      // If unmuted while drowsiness is still active, immediately resume siren
      this.startContinuousSiren(false);
    }
    return this.isMuted;
  }
}

export const soundManager = new SoundManager();
