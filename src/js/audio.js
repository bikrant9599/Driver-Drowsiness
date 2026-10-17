/* ==========================================================================
   AUDIO SYNTHESIZER & AUDIBLE ALARM SYSTEM
   Loud, urgent, rising-and-falling Emergency Siren synthesized via Web Audio API
   ========================================================================== */

export const ALERT_SOUND_NAME = "Emergency Siren";

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.intervalId = null;
    this.activeNodes = [];

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
    return Math.max(0.06, (effectiveVol / 100) * 0.50);
  }

  /**
   * Emergency Siren: Loud, sharp, urgent alternating high-low rising-and-falling siren
   * (Sawtooth wave with 680Hz <-> 1260Hz sweep cycle, distinct pause between repetitions)
   */
  playEmergencySiren(overrideMute = false) {
    const gainLevel = this.getGainLevel(overrideMute);
    if (gainLevel <= 0) return;

    this.initContext();
    if (!this.audioCtx || this.audioCtx.state !== "running") return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      // Sharp, urgent emergency siren timbre using sawtooth waveform
      osc.type = "sawtooth";

      // Rising-and-falling siren pitch cycle (low-to-high then high-to-low)
      // Cycle 1: 680Hz -> 1220Hz -> 720Hz
      // Cycle 2: 720Hz -> 1260Hz -> 680Hz
      const t0 = now;
      const t1 = now + 0.14; // first high peak
      const t2 = now + 0.28; // mid trough
      const t3 = now + 0.42; // second high peak
      const t4 = now + 0.56; // low resolution
      const totalDuration = 0.58;

      osc.frequency.setValueAtTime(680, t0);
      osc.frequency.linearRampToValueAtTime(1220, t1);
      osc.frequency.linearRampToValueAtTime(720, t2);
      osc.frequency.linearRampToValueAtTime(1260, t3);
      osc.frequency.linearRampToValueAtTime(680, t4);

      // Volume envelope: smooth rapid attack, sustained siren wail, crisp release
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(gainLevel, t0 + 0.02);
      gain.gain.setValueAtTime(gainLevel, t4 - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + totalDuration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(t0);
      osc.stop(t0 + totalDuration);

      const nodeRef = { osc, gain };
      this.activeNodes.push(nodeRef);
      osc.onended = () => {
        const idx = this.activeNodes.indexOf(nodeRef);
        if (idx !== -1) this.activeNodes.splice(idx, 1);
      };
    } catch (e) {
      console.warn("Emergency siren audio error:", e);
    }
  }

  /**
   * Start repeating emergency siren when genuine drowsiness warning is confirmed
   * Prevents multiple sirens from playing simultaneously
   */
  startDrowsinessAlert() {
    if (this.isPlaying) return; // Prevent multiple simultaneous sirens
    this.isPlaying = true;

    this.initContext();
    this.playEmergencySiren(false);

    if (this.intervalId) clearInterval(this.intervalId);
    // Repeats every 740ms (0.58s siren burst + 0.16s pause between cycles)
    this.intervalId = setInterval(() => {
      if (!this.isPlaying) return;
      this.playEmergencySiren(false);
    }, 740);
  }

  /**
   * Stop the active siren immediately when warning clears or monitoring stops
   */
  stopDrowsinessAlert() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Instantly cut off and stop any currently active siren oscillator
    if (this.activeNodes && this.activeNodes.length > 0) {
      this.activeNodes.forEach(({ osc, gain }) => {
        try {
          if (this.audioCtx && this.audioCtx.state === "running") {
            gain.gain.cancelScheduledValues(this.audioCtx.currentTime);
            gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
          }
          osc.stop();
          osc.disconnect();
        } catch (e) {}
      });
      this.activeNodes = [];
    }
  }

  /**
   * Test current alert siren (plays one siren cycle; overrides mute for user verification)
   */
  async testAlertSound() {
    await this.initContext();
    this.playEmergencySiren(true);
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
    if (this.isMuted) {
      // Immediately silence any active audio while keeping visual warning active
      this.stopDrowsinessAlert();
    }
    return this.isMuted;
  }
}

export const soundManager = new SoundManager();
