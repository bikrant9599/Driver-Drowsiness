/* ==========================================================================
   AUDIO SYNTHESIZER & AUDIBLE ALARM SYSTEM
   Automotive-grade dual acoustic chime warning for driver drowsiness
   ========================================================================== */

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.intervalId = null;

    // Load persisted settings
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

  /**
   * Synthesize a clean, rounded acoustic tone with exponential decay
   */
  synthesizeChimeNote(freq, startTime, duration, gainLevel) {
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      // Smooth attack and natural exponential decay envelope (no clicks/pops)
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(gainLevel, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    } catch (e) {
      console.warn("Chime note error:", e);
    }
  }

  /**
   * Dual-tone automotive alert pulse (G5 784Hz -> C6 1046Hz)
   */
  playWarningChime(overrideMute = false) {
    if (!overrideMute && this.isMuted) return;

    this.initContext();
    if (!this.audioCtx || this.audioCtx.state !== "running") return;

    try {
      const now = this.audioCtx.currentTime;
      const effectiveVol = overrideMute && this.volume <= 0 ? 50 : this.volume;
      const gainLevel = Math.max(0.05, (effectiveVol / 100) * 0.45);

      // Chime Note 1: 784 Hz (G5)
      this.synthesizeChimeNote(784, now, 0.13, gainLevel);

      // Chime Note 2: 1046.5 Hz (C6) with 140ms offset
      this.synthesizeChimeNote(1046.5, now + 0.14, 0.18, gainLevel * 1.05);
    } catch (e) {
      console.warn("Warning chime error:", e);
    }
  }

  /**
   * Start repeating drowsiness alarm when detection threshold is exceeded
   */
  startDrowsinessAlert() {
    if (this.isPlaying) return; // Prevent multiple overlapping loops
    this.isPlaying = true;

    this.initContext();
    this.playWarningChime();

    if (this.intervalId) clearInterval(this.intervalId);
    // Repeats every 850ms in a rhythmic cabin alert cadence while warning is active
    this.intervalId = setInterval(() => {
      if (!this.isPlaying) return;
      this.playWarningChime();
    }, 850);
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
   * User-triggered alert sound test
   */
  async testAlertSound() {
    await this.initContext();
    this.playWarningChime(true);
  }

  /**
   * Update volume level (0-100)
   */
  setVolume(newVol) {
    this.volume = Math.max(0, Math.min(100, Math.round(newVol)));
    localStorage.setItem("drowsiness_alarm_volume", this.volume.toString());
  }

  /**
   * Toggle mute state
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem("drowsiness_alarm_muted", this.isMuted ? "true" : "false");
    if (this.isMuted) {
      // Immediate silence
      this.stopDrowsinessAlert();
    }
    return this.isMuted;
  }
}

export const soundManager = new SoundManager();
