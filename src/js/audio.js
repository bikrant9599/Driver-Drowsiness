/* ==========================================================================
   AUDIO SYNTHESIZER & AUDIBLE ALARM SYSTEM
   Urgent Emergency Alert tone synthesized via Web Audio API for driver drowsiness
   ========================================================================== */

export const ALERT_SOUND_NAME = "Emergency Alert";

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
   * Emergency Alert: Urgent, attention-grabbing emergency warning tone
   * Distinct multi-frequency acoustic alarm (980Hz - 740Hz - 980Hz)
   */
  playEmergencyAlert(overrideMute = false) {
    const gainLevel = this.getGainLevel(overrideMute);
    if (gainLevel <= 0) return;

    this.initContext();
    if (!this.audioCtx || this.audioCtx.state !== "running") return;

    try {
      const now = this.audioCtx.currentTime;
      this.playTone(980, "triangle", now, 0.09, gainLevel);
      this.playTone(740, "triangle", now + 0.095, 0.09, gainLevel);
      this.playTone(980, "triangle", now + 0.19, 0.11, gainLevel);
    } catch (e) {
      console.warn("Emergency alert playback error:", e);
    }
  }

  /**
   * Start repeating drowsiness alarm while a genuine drowsiness warning remains active
   * Prevents multiple alarm instances from playing simultaneously
   */
  startDrowsinessAlert() {
    if (this.isPlaying) return; // Prevent multiple simultaneous alarms
    this.isPlaying = true;

    this.initContext();
    this.playEmergencyAlert(false);

    if (this.intervalId) clearInterval(this.intervalId);
    // Repeats at an urgent 480ms interval while genuine drowsiness warning is active
    this.intervalId = setInterval(() => {
      if (!this.isPlaying) return;
      this.playEmergencyAlert(false);
    }, 480);
  }

  /**
   * Stop the active alarm immediately when warning clears or monitoring stops
   */
  stopDrowsinessAlert() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Test current alert sound (plays once; overrides mute for user verification)
   */
  async testAlertSound() {
    await this.initContext();
    this.playEmergencyAlert(true);
  }

  /**
   * Set volume level (0-100)
   */
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(100, Math.round(vol)));
    localStorage.setItem("drowsiness_alarm_volume", this.volume.toString());
  }

  /**
   * Toggle mute state
   * If muted, visual warning continues to display actively in the UI
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem("drowsiness_alarm_muted", this.isMuted ? "true" : "false");
    return this.isMuted;
  }
}

export const soundManager = new SoundManager();
