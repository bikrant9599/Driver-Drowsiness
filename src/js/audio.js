/* ==========================================================================
   AUDIO SYNTHESIZER & AUDIBLE ALARM SYSTEM
   Web Audio synthesizer for emergency drowsiness alerts
   ========================================================================== */

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.intervalId = null;
    this.volume = 0.85;
    this.alarmEnabled = true;
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

      return Boolean(this.audioCtx && this.audioCtx.state === "running");
    } catch (err) {
      console.warn("AudioContext init error:", err);
      return false;
    }
  }

  /**
   * Urgent audible buzzer pulse
   */
  playBuzzer() {
    this.initContext();
    if (!this.audioCtx || !this.alarmEnabled || this.audioCtx.state !== "running") return;

    try {
      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = "sawtooth";
      osc2.type = "square";

      osc1.frequency.setValueAtTime(880, now);
      osc2.frequency.setValueAtTime(440, now);

      const vol = this.volume * 0.55;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.setValueAtTime(0.01, now + 0.18);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.2);
      osc2.stop(now + 0.2);
    } catch (e) {
      console.warn("Buzzer error:", e);
    }
  }

  /**
   * Start continuous drowsiness alarm
   */
  startDrowsinessAlert() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    this.initContext();
    this.playBuzzer();

    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      if (!this.isPlaying) return;
      this.playBuzzer();
    }, 300);
  }

  /**
   * Stop active alarm
   */
  stopDrowsinessAlert() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const soundManager = new SoundManager();
