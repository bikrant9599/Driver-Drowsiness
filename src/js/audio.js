/* ==========================================================================
   AUDIO SYNTHESIZER & AUDIBLE ALARM SYSTEM
   Three-Stage Warning Sound Engine & High-Priority Emergency Siren
   Synthesized programmatically via the Web Audio API
   ========================================================================== */

export const ALERT_SOUND_NAME = "Emergency Siren";

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.currentStage = 0; // 0: None, 1: Stage 1, 2: Stage 2, 3: Stage 3
    this.currentAlarm = null; // { sirenCarrier, sirenLfo, pulseCarrier, pulseLfo, masterGain }
    this.stage2Interval = null;
    this.stage1Timeouts = [];
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
    return Math.max(0.04, (effectiveVol / 100) * 0.40);
  }

  /* -------------------------------------------------------------------------
     STAGE 1: Three Short, Sharp Warning Beeps
     ------------------------------------------------------------------------- */
  playStage1Beeps(overrideMute = false) {
    // If higher stage is already playing, do not interrupt
    if (this.currentStage >= 2) return;

    this.stopStage1Beeps();
    const gainLevel = this.getGainLevel(overrideMute);
    if (gainLevel <= 0) return;

    this.initContext();
    if (!this.audioCtx || this.audioCtx.state !== "running") return;

    this.currentStage = 1;

    // Schedule exactly 3 short sharp beeps (at 0ms, 160ms, 320ms)
    [0, 160, 320].forEach((delayMs, index) => {
      const tid = setTimeout(() => {
        if (!this.audioCtx || this.audioCtx.state !== "running") return;
        try {
          const now = this.audioCtx.currentTime;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(1050, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(gainLevel * 0.75, now + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(now);
          osc.stop(now + 0.09);

          setTimeout(() => {
            try {
              osc.disconnect();
              gain.disconnect();
            } catch (e) {}
          }, 120);
        } catch (e) {}

        if (index === 2) {
          setTimeout(() => {
            if (this.currentStage === 1) {
              this.currentStage = 0;
            }
          }, 100);
        }
      }, delayMs);

      this.stage1Timeouts.push(tid);
    });
  }

  stopStage1Beeps() {
    this.stage1Timeouts.forEach((tid) => clearTimeout(tid));
    this.stage1Timeouts = [];
    if (this.currentStage === 1) {
      this.currentStage = 0;
    }
  }

  /* -------------------------------------------------------------------------
     STAGE 2: Urgent Repeating Two-Tone Warning Pulse
     ------------------------------------------------------------------------- */
  startStage2CriticalSound(overrideMute = false) {
    if (this.currentStage === 2) return;
    if (this.currentStage === 3) return; // Stage 3 takes precedence

    this.stopStage1Beeps();
    const gainLevel = this.getGainLevel(overrideMute);
    if (gainLevel <= 0) return;

    this.initContext();
    if (!this.audioCtx || this.audioCtx.state !== "running") return;

    this.currentStage = 2;

    const playPip = () => {
      if (this.currentStage !== 2 || !this.audioCtx || this.audioCtx.state !== "running") return;
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.linearRampToValueAtTime(680, now + 0.12);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(gainLevel * 0.85, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.13);

        setTimeout(() => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch (e) {}
        }, 150);
      } catch (e) {}
    };

    // Play immediately then repeat every 240ms
    playPip();
    if (this.stage2Interval) clearInterval(this.stage2Interval);
    this.stage2Interval = setInterval(playPip, 240);
  }

  stopStage2CriticalSound() {
    if (this.stage2Interval) {
      clearInterval(this.stage2Interval);
      this.stage2Interval = null;
    }
    if (this.currentStage === 2) {
      this.currentStage = 0;
    }
  }

  /* -------------------------------------------------------------------------
     STAGE 3: Continuous Dual-Layer Emergency Siren
     ------------------------------------------------------------------------- */
  startContinuousAlarm(overrideMute = false) {
    if (this.currentAlarm) return; // Prevent duplicate instances

    this.stopStage1Beeps();
    this.stopStage2CriticalSound();

    const gainLevel = this.getGainLevel(overrideMute);
    if (gainLevel <= 0) return;

    this.initContext();
    if (!this.audioCtx || this.audioCtx.state !== "running") return;

    try {
      this.currentStage = 3;
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
      pulseCarrier.frequency.setValueAtTime(1450, now);

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
      this.currentStage = 0;
    }
  }

  stopContinuousAlarm() {
    if (!this.currentAlarm) {
      if (this.currentStage === 3) this.currentStage = 0;
      return;
    }

    const { sirenCarrier, sirenLfo, pulseCarrier, pulseLfo, masterGain } = this.currentAlarm;
    this.currentAlarm = null;
    this.currentStage = 0;

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

  /* -------------------------------------------------------------------------
     Unified Warning Stage Sound Controller
     ------------------------------------------------------------------------- */
  playWarningStage(stage) {
    if (stage === 1) {
      this.playStage1Beeps(false);
    } else if (stage === 2) {
      this.startStage2CriticalSound(false);
    } else if (stage === 3) {
      this.isPlaying = true;
      this.startContinuousAlarm(false);
    } else {
      this.stopAllAlerts();
    }
  }

  stopAllAlerts() {
    this.isPlaying = false;
    this.stopStage1Beeps();
    this.stopStage2CriticalSound();
    this.stopContinuousAlarm();
    this.currentStage = 0;

    if (this.testTimeoutId) {
      clearTimeout(this.testTimeoutId);
      this.testTimeoutId = null;
    }
  }

  // Backward compatibility aliases
  startDrowsinessAlert() {
    this.playWarningStage(3);
  }

  stopDrowsinessAlert() {
    this.stopAllAlerts();
  }

  async testAlertSound() {
    await this.initContext();
    this.stopAllAlerts();
    this.startContinuousAlarm(true);

    this.testTimeoutId = setTimeout(() => {
      this.stopContinuousAlarm();
      this.testTimeoutId = null;
    }, 2000);
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(100, Math.round(vol)));
    localStorage.setItem("drowsiness_alarm_volume", this.volume.toString());

    if (this.currentAlarm && this.audioCtx && this.audioCtx.state === "running") {
      try {
        const gain = this.getGainLevel(false);
        this.currentAlarm.masterGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
        this.currentAlarm.masterGain.gain.linearRampToValueAtTime(gain, this.audioCtx.currentTime + 0.02);
      } catch (e) {}
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem("drowsiness_alarm_muted", this.isMuted ? "true" : "false");

    if (this.isMuted) {
      this.stopAllAlerts();
    } else if (this.currentStage === 3 || this.isPlaying) {
      this.startContinuousAlarm(false);
    }
    return this.isMuted;
  }
}

export const soundManager = new SoundManager();
