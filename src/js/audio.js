/* ==========================================================================
   AUDIO SYNTHESIZER & AUDIBLE ALARM SYSTEM
   ========================================================================== */

import { appState } from "./state.js";
import { showToast } from "./utils.js";

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.intervalId = null;
    this.lastSpeechTime = 0;
    this.lastCautionSoundTime = 0;
    this.hasShownAudioBlockedToast = false;
  }

  /**
   * Initializes or resumes the Web Audio context.
   * Handles browser autoplay security policies gracefully.
   */
  async initContext() {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioCtx = new AudioContext();
        }
      }

      if (this.audioCtx) {
        if (this.audioCtx.state === "suspended") {
          await this.audioCtx.resume();
        }

        if (this.audioCtx.state === "running") {
          appState.audioBlocked = false;
          return true;
        } else {
          appState.audioBlocked = true;
          return false;
        }
      }
    } catch (err) {
      console.warn("AudioContext initialization warning:", err);
      appState.audioBlocked = true;
      return false;
    }
    return false;
  }

  getVolumeGain() {
    if (!appState.settings.alarmEnabled) return 0;
    return Math.max(0, Math.min(1, appState.settings.volume / 100));
  }

  /**
   * Play urgent automotive warning buzzer
   */
  playBuzzer() {
    this.initContext();
    if (!this.audioCtx || !appState.settings.alarmEnabled || this.audioCtx.state !== "running") return;

    try {
      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = "sawtooth";
      osc2.type = "square";

      osc1.frequency.setValueAtTime(880, now);
      osc2.frequency.setValueAtTime(440, now);

      const vol = this.getVolumeGain() * 0.55;
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
      console.warn("Buzzer playback error:", e);
    }
  }

  /**
   * Play European automotive cabin chime
   */
  playChime() {
    this.initContext();
    if (!this.audioCtx || !appState.settings.alarmEnabled || this.audioCtx.state !== "running") return;

    const baseFreqs = [784, 1046.5]; // G5, C6
    baseFreqs.forEach((freq, idx) => {
      setTimeout(() => {
        try {
          if (!this.audioCtx || this.audioCtx.state !== "running") return;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

          const vol = this.getVolumeGain() * 0.5;
          gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.4);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start();
          osc.stop(this.audioCtx.currentTime + 0.4);
        } catch (e) {}
      }, idx * 120);
    });
  }

  /**
   * Play high-urgency sweep siren
   */
  playSiren() {
    this.initContext();
    if (!this.audioCtx || !appState.settings.alarmEnabled || this.audioCtx.state !== "running") return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.25);

      const vol = this.getVolumeGain() * 0.6;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } catch (e) {}
  }

  /**
   * Play gentle caution chime for advisory events (e.g. Yawning, Head Nod)
   */
  playCautionChime() {
    const now = Date.now();
    if (now - this.lastCautionSoundTime < 3000) return; // Debounce caution chimes to 3s
    this.lastCautionSoundTime = now;

    this.initContext();
    if (!this.audioCtx || !appState.settings.alarmEnabled || this.audioCtx.state !== "running") return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const curTime = this.audioCtx.currentTime;

      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, curTime); // E5
      osc.frequency.setValueAtTime(880.0, curTime + 0.15); // A5

      const vol = this.getVolumeGain() * 0.4;
      gain.gain.setValueAtTime(vol, curTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, curTime + 0.45);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(curTime);
      osc.stop(curTime + 0.45);
    } catch (e) {}
  }

  /**
   * Synthesize spoken voice warning
   */
  speakWarning(text = "Warning: Driver drowsiness detected! Please stay alert and pull over safely.") {
    if (!appState.settings.speechAlert || !("speechSynthesis" in window)) return;
    const now = Date.now();
    if (now - this.lastSpeechTime < 5000) return; // Rate-limit voice warnings to 5s
    this.lastSpeechTime = now;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.15;
      utterance.pitch = 1.2;
      utterance.volume = this.getVolumeGain();
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  }

  /**
   * Start continuous high-urgency drowsiness alert
   * Debounced and state-managed: does not repeatedly trigger on every frame
   */
  startDrowsinessAlert(warningType = "PROLONGED EYE CLOSURE") {
    if (this.isPlaying) return; // Prevent repeated triggering on every video frame
    this.isPlaying = true;

    // Check audio restriction
    this.initContext().then((ready) => {
      if (!ready && !this.hasShownAudioBlockedToast) {
        this.hasShownAudioBlockedToast = true;
        showToast(
          "Audio Blocked by Browser",
          "Click anywhere on the screen or click Unmute to enable emergency audible alerts.",
          "warn"
        );
      }
    });

    // Sound initial alert pulse immediately
    this.triggerSelectedAlarm();

    // Custom vocal message depending on warning condition
    let voiceMsg = "Warning: Prolonged eye closure detected! Stay awake!";
    if (warningType === "DROWSY_NOD_OFF" || warningType === "HEAD_DROP") {
      voiceMsg = "Warning: Head drop and eye closure detected! Please stay attentive!";
    }
    this.speakWarning(voiceMsg);

    // Loop alarm pulse every 320ms until explicitly stopped
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      if (!this.isPlaying) return;
      this.triggerSelectedAlarm();
    }, 320);
  }

  triggerSelectedAlarm() {
    if (!appState.settings.alarmEnabled) return;

    const tone = appState.settings.alarmSound;
    if (tone === "chime") {
      this.playChime();
    } else if (tone === "siren") {
      this.playSiren();
    } else {
      this.playBuzzer();
    }
  }

  /**
   * Stop or reset the alarm according to monitoring state
   */
  stopDrowsinessAlert() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
  }

  /**
   * Toggle mute/unmute state with immediate silence
   */
  toggleMute() {
    const nextState = !appState.settings.alarmEnabled;
    appState.saveSettings({ alarmEnabled: nextState });

    if (!nextState) {
      this.stopDrowsinessAlert();
      showToast("Audio Muted", "Audible alarms have been muted.", "warn");
    } else {
      this.initContext();
      showToast("Audio Unmuted", "Audible alarms are active.", "safe");
    }
    return nextState;
  }

  /**
   * Test current sound profile
   */
  testAlarm() {
    this.initContext().then(() => {
      this.triggerSelectedAlarm();
      if (appState.settings.speechAlert) {
        setTimeout(() => this.speakWarning("Audio test: VigilDrive alarm active."), 400);
      }
    });
  }
}

export const soundManager = new SoundManager();
