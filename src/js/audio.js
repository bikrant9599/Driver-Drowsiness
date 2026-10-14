/* ==========================================================================
   AUDIO SYNTHESIZER & SPEECH SYNTHESIS ENGINE
   ========================================================================== */

import { appState } from "./state.js";

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.intervalId = null;
    this.lastSpeechTime = 0;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  getVolumeGain() {
    if (!appState.settings.alarmEnabled) return 0;
    return Math.max(0, Math.min(1, appState.settings.volume / 100));
  }

  // Play single alert pulse
  playTone(freq = 880, type = "square", duration = 0.15) {
    this.initContext();
    if (!this.audioCtx || !appState.settings.alarmEnabled) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      const targetGain = this.getVolumeGain() * 0.45;
      gain.gain.setValueAtTime(targetGain, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Audio playTone error:", e);
    }
  }

  // Play chime sound (gentle dual harmonic bell)
  playChime() {
    this.initContext();
    if (!this.audioCtx || !appState.settings.alarmEnabled) return;

    const baseFreqs = [784, 1046.5]; // G5, C6
    baseFreqs.forEach((freq, idx) => {
      setTimeout(() => {
        try {
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

  // Play urgent automotive warning buzzer
  playBuzzer() {
    this.initContext();
    if (!this.audioCtx || !appState.settings.alarmEnabled) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = "sawtooth";
      osc2.type = "square";

      osc1.frequency.setValueAtTime(880, now);
      osc2.frequency.setValueAtTime(440, now);

      const vol = this.getVolumeGain() * 0.5;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.setValueAtTime(0.01, now + 0.18);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.2);
      osc2.stop(now + 0.2);
    } catch (e) {}
  }

  // Play siren sweep
  playSiren() {
    this.initContext();
    if (!this.audioCtx || !appState.settings.alarmEnabled) return;

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

  // Speak voice prompt
  speakWarning() {
    if (!appState.settings.speechAlert || !("speechSynthesis" in window)) return;
    const now = Date.now();
    if (now - this.lastSpeechTime < 5000) return; // Limit speech to once every 5 seconds
    this.lastSpeechTime = now;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Warning: Driver drowsiness detected! Please stay alert and pull over safely.");
    utterance.rate = 1.15;
    utterance.pitch = 1.2;
    utterance.volume = this.getVolumeGain();
    window.speechSynthesis.speak(utterance);
  }

  // Start continuous drowsiness alert
  startDrowsinessAlert() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // Trigger initial sound & voice
    this.triggerSelectedAlarm();
    this.speakWarning();

    // Loop alarm pulse every 320ms until stopped
    this.intervalId = setInterval(() => {
      if (!this.isPlaying) return;
      this.triggerSelectedAlarm();
    }, 320);
  }

  triggerSelectedAlarm() {
    const tone = appState.settings.alarmSound;
    if (tone === "chime") {
      this.playChime();
    } else if (tone === "siren") {
      this.playSiren();
    } else {
      this.playBuzzer();
    }
  }

  stopDrowsinessAlert() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Test current sound
  testAlarm() {
    this.initContext();
    this.triggerSelectedAlarm();
    if (appState.settings.speechAlert) {
      setTimeout(() => this.speakWarning(), 400);
    }
  }
}

export const soundManager = new SoundManager();
