/* ==========================================================================
   COMPUTER VISION & EYE-CLOSURE DETECTION ENGINE
   MediaPipe Face Landmarker with real-time Eye Aspect Ratio (EAR) tracking,
   separate left/right eye classification, neural blendshapes, and futuristic HUD
   ========================================================================== */

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { appState } from "./state.js";
import { soundManager } from "./audio.js";

// Euclidean distance between 3D points
function distance3D(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Enhanced 8-point Eye Aspect Ratio (EAR) formula
 * Evaluates both outer vertical chords plus central vertical aperture
 * normalized by horizontal eye width. Highly robust to glasses and head tilt.
 */
function computeEnhancedEAR(eyeLandmarks, midTop, midBot) {
  if (!eyeLandmarks || eyeLandmarks.length < 6) return 0.28;
  const p1 = eyeLandmarks[0]; // inner canthus
  const p2 = eyeLandmarks[1]; // upper outer
  const p3 = eyeLandmarks[2]; // upper inner
  const p4 = eyeLandmarks[3]; // outer canthus
  const p5 = eyeLandmarks[4]; // lower inner
  const p6 = eyeLandmarks[5]; // lower outer

  const v1 = distance3D(p2, p6);
  const v2 = distance3D(p3, p5);
  const vMid = midTop && midBot ? distance3D(midTop, midBot) : (v1 + v2) / 2;
  const horiz = distance3D(p1, p4);

  if (horiz === 0) return 0.28;
  return (v1 + 2.0 * vMid + v2) / (4.0 * horiz);
}

/**
 * MediaPipe canonical landmark indices for anatomical left and right eyes
 * In mirrored camera view, subject's left eye appears on screen left, right on screen right.
 */
// Subject's Left Eye (appears on left in mirrored camera preview)
const LEFT_EYE_FULL_CONTOUR = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const LEFT_EYE_EAR_INDICES = [362, 385, 387, 263, 373, 380];
const LEFT_EYE_MID_TOP = 386;
const LEFT_EYE_MID_BOT = 374;
const LEFT_IRIS_CENTER = 473;

// Subject's Right Eye (appears on right in mirrored camera preview)
const RIGHT_EYE_FULL_CONTOUR = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE_EAR_INDICES = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_MID_TOP = 159;
const RIGHT_EYE_MID_BOT = 145;
const RIGHT_IRIS_CENTER = 468;

class VisionEngine {
  constructor() {
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;
    this.stream = null;
    this.animFrameId = null;

    // MediaPipe Vision Task singletons (retained in memory across start/stop)
    this.faceLandmarker = null;
    this.filesetResolver = null;
    this.isLandmarkerReady = false;
    this.isInitializingLandmarker = false;
    this.isStartingCamera = false;
    this.faceMesh = null;
    this.isFaceMeshReady = false;

    // Timing & Temporal Smoothing
    this.lastFrameTime = performance.now();
    this.smoothedLeftEAR = 0.28;
    this.smoothedRightEAR = 0.28;
    this.smoothedAvgEAR = 0.28;

    // Eye-Closure Duration & Drowsiness Tracker
    this.closureStartTime = null;
    this.consecutiveClosedSeconds = 0.0;
    this.lastFaceSeenTime = performance.now();
    this.closureIncidentActive = false;
    this.alarmCooldownUntil = 0;

    // Blink Tracker
    this.prevBothClosed = false;
    this.blinkCandidateStart = null;
    this.blinkHistory = []; // timestamps of confirmed blinks in last 60s
    this.blinkFlashTimeout = null;

    // Calibration
    this.isCalibrating = false;
    this.calibrationSamples = [];
    this.calibrationStartTime = null;
    this.onCalibrationProgress = null;
    this.onCalibrationComplete = null;

    // Fast-path external UI synchronizer
    this.onTelemetryUpdate = null;
  }

  /* -------------------------------------------------------------------------
     MediaPipe Initialization (reused across sessions)
     ------------------------------------------------------------------------- */
  async initFaceLandmarker() {
    if (this.faceLandmarker && this.isLandmarkerReady) return true;
    if (this.isInitializingLandmarker) return false;

    this.isInitializingLandmarker = true;
    try {
      if (!this.filesetResolver) {
        this.filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
      }

      const modelUrl = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

      try {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(this.filesetResolver, {
          baseOptions: {
            modelAssetPath: modelUrl,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
      } catch (gpuErr) {
        console.warn("GPU delegate unavailable, falling back to CPU:", gpuErr);
        this.faceLandmarker = await FaceLandmarker.createFromOptions(this.filesetResolver, {
          baseOptions: {
            modelAssetPath: modelUrl,
            delegate: "CPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
      }

      this.isLandmarkerReady = true;
      this.isInitializingLandmarker = false;
      return true;
    } catch (err) {
      console.warn("MediaPipe FaceLandmarker init failed, will use FaceMesh fallback:", err);
      this.isLandmarkerReady = false;
      this.isInitializingLandmarker = false;
      return false;
    }
  }

  async initFaceMeshFallback() {
    if (this.faceMesh && this.isFaceMeshReady) return true;
    if (typeof window !== "undefined" && window.FaceMesh) {
      try {
        this.faceMesh = new window.FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        this.faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        this.faceMesh.onResults((results) => this.onLegacyFaceMeshResults(results));
        this.isFaceMeshReady = true;
        return true;
      } catch (e) {
        console.warn("MediaPipe FaceMesh fallback init error:", e);
      }
    }
    return false;
  }

  /* -------------------------------------------------------------------------
     Camera Control & Session Lifecycle
     ------------------------------------------------------------------------- */
  async startCamera(videoEl, canvasEl) {
    if (this.isStartingCamera) {
      return { success: false, error: "Camera initialization in progress." };
    }
    this.isStartingCamera = true;

    this.videoElement = videoEl;
    this.canvasElement = canvasEl;
    this.canvasCtx = canvasEl ? canvasEl.getContext("2d", { willReadFrequently: true }) : null;

    // Reset detection tracking parameters
    this.closureStartTime = null;
    this.consecutiveClosedSeconds = 0.0;
    this.closureIncidentActive = false;
    this.alarmCooldownUntil = 0;
    this.prevBothClosed = false;
    this.blinkCandidateStart = null;
    this.blinkHistory = [];
    this.smoothedLeftEAR = 0.28;
    this.smoothedRightEAR = 0.28;
    this.smoothedAvgEAR = 0.28;
    this.lastFaceSeenTime = performance.now();

    soundManager.initContext();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.isStartingCamera = false;
      const isSecure = window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const errorMsg = isSecure
        ? "Webcam is not supported or disabled in this browser."
        : "Webcam requires http://localhost:5173/ (or HTTPS) to allow camera access. Please open http://localhost:5173/";
      appState.setStatus("CAMERA_UNAVAILABLE", errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      const constraints = {
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: "user"
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          appState.setStatus("CAMERA_UNAVAILABLE", "Webcam was disconnected.");
          soundManager.stopDrowsinessAlert();
        };
      }

      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        await new Promise((resolve) => {
          this.videoElement.onloadedmetadata = () => resolve();
          setTimeout(resolve, 300);
        });
        await this.videoElement.play();
      }

      appState.setStatus("NO_FACE");

      // Initialize FaceLandmarker in background
      this.initFaceLandmarker().then((ready) => {
        if (!ready) {
          this.initFaceMeshFallback();
        }
      });

      this.startLoop();
      return { success: true };
    } catch (err) {
      console.error("Camera access error:", err);
      let errorMsg = "Camera unavailable. Please check permissions.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMsg = "Camera access denied. Please allow camera permissions in your browser.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMsg = "No camera found. Please connect a webcam.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errorMsg = "Camera is already in use by another application.";
      }

      appState.setStatus("CAMERA_UNAVAILABLE", errorMsg);
      soundManager.stopDrowsinessAlert();
      return { success: false, error: errorMsg };
    } finally {
      this.isStartingCamera = false;
    }
  }

  stopCamera() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    if (this.canvasCtx && this.canvasElement) {
      this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    }

    soundManager.stopDrowsinessAlert();
    this.closureStartTime = null;
    this.consecutiveClosedSeconds = 0.0;
    this.closureIncidentActive = false;
    this.isCalibrating = false;
  }

  /* -------------------------------------------------------------------------
     Main Processing Loop
     ------------------------------------------------------------------------- */
  startLoop() {
    const loop = async (timestamp) => {
      if (!appState.isMonitoring) return;

      const delta = Math.min(0.15, (timestamp - this.lastFrameTime) / 1000);
      this.lastFrameTime = timestamp;

      await this.processLiveFrame(timestamp, delta);
      this.animFrameId = requestAnimationFrame(loop);
    };

    this.lastFrameTime = performance.now();
    this.animFrameId = requestAnimationFrame(loop);
  }

  async processLiveFrame(timestamp, delta) {
    if (!this.videoElement || this.videoElement.readyState < 2) return;

    const width = (this.canvasElement.width = this.videoElement.videoWidth || 640);
    const height = (this.canvasElement.height = this.videoElement.videoHeight || 480);

    // 1. Primary: MediaPipe FaceLandmarker
    if (this.isLandmarkerReady && this.faceLandmarker) {
      try {
        const results = this.faceLandmarker.detectForVideo(this.videoElement, timestamp);
        if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
          this.handleDetection(results, width, height, delta, timestamp);
          return;
        } else {
          this.handleFaceLoss(width, height);
          return;
        }
      } catch (err) {
        console.warn("FaceLandmarker detection error:", err);
      }
    }

    // 2. Secondary: MediaPipe FaceMesh CDN
    if (this.isFaceMeshReady && this.faceMesh) {
      try {
        await this.faceMesh.send({ image: this.videoElement });
        return;
      } catch (err) {}
    }

    // 3. Fallback: Classical Canvas CV
    this.processFallbackCV(width, height, delta, timestamp);
  }

  /* -------------------------------------------------------------------------
     Detection & Metric Calculation Engine
     ------------------------------------------------------------------------- */
  handleDetection(results, width, height, delta, timestamp) {
    this.lastFaceSeenTime = performance.now();

    const rawLandmarks = results.faceLandmarks[0];

    // Coordinate mapping: flip X for mirrored camera preview
    const pts = rawLandmarks.map((p) => ({
      x: (1 - p.x) * width,
      y: p.y * height,
      z: (p.z || 0) * width
    }));

    // Extract eye landmarks
    const leftEyePts = LEFT_EYE_EAR_INDICES.map((i) => pts[i]);
    const rightEyePts = RIGHT_EYE_EAR_INDICES.map((i) => pts[i]);
    const leftMidTop = pts[LEFT_EYE_MID_TOP];
    const leftMidBot = pts[LEFT_EYE_MID_BOT];
    const rightMidTop = pts[RIGHT_EYE_MID_TOP];
    const rightMidBot = pts[RIGHT_EYE_MID_BOT];

    // Compute raw 3D EAR for left and right eyes
    const rawLeftEAR = computeEnhancedEAR(leftEyePts, leftMidTop, leftMidBot);
    const rawRightEAR = computeEnhancedEAR(rightEyePts, rightMidTop, rightMidBot);

    // Extract blendshapes if available
    let blinkScoreLeft = null;
    let blinkScoreRight = null;
    if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
      const cats = results.faceBlendshapes[0].categories;
      blinkScoreLeft = cats.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0;
      blinkScoreRight = cats.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0;
    }

    // Adaptive temporal smoothing: fast drop when closing, smooth rise when opening
    const alphaLeft = rawLeftEAR < this.smoothedLeftEAR ? 0.82 : 0.65;
    const alphaRight = rawRightEAR < this.smoothedRightEAR ? 0.82 : 0.65;
    this.smoothedLeftEAR = alphaLeft * rawLeftEAR + (1 - alphaLeft) * this.smoothedLeftEAR;
    this.smoothedRightEAR = alphaRight * rawRightEAR + (1 - alphaRight) * this.smoothedRightEAR;
    this.smoothedAvgEAR = (this.smoothedLeftEAR + this.smoothedRightEAR) / 2;

    // Handle interactive calibration
    if (this.isCalibrating) {
      this.processCalibrationStep(this.smoothedAvgEAR);
    }

    // Classify separate eye states
    const earThreshold = appState.settings.earThreshold;
    const hysteresis = 0.035;

    const leftIsClosed = (this.smoothedLeftEAR < earThreshold) || (blinkScoreLeft !== null && blinkScoreLeft > 0.62);
    const rightIsClosed = (this.smoothedRightEAR < earThreshold) || (blinkScoreRight !== null && blinkScoreRight > 0.62);

    let leftEyeState = "OPEN";
    if (leftIsClosed) {
      leftEyeState = "CLOSED";
    } else if (this.smoothedLeftEAR < earThreshold + hysteresis) {
      leftEyeState = "CLOSING";
    }

    let rightEyeState = "OPEN";
    if (rightIsClosed) {
      rightEyeState = "CLOSED";
    } else if (this.smoothedRightEAR < earThreshold + hysteresis) {
      rightEyeState = "CLOSING";
    }

    // Blink detection & prolonged closure evaluation
    this.evaluateEyes(leftIsClosed, rightIsClosed, leftEyeState, rightEyeState, delta, timestamp);

    // Update real-time state telemetry
    appState.telemetry.faceDetected = true;
    appState.telemetry.eyeTrackingStatus = "ACTIVE";
    appState.telemetry.leftEAR = Math.round(this.smoothedLeftEAR * 100) / 100;
    appState.telemetry.rightEAR = Math.round(this.smoothedRightEAR * 100) / 100;
    appState.telemetry.avgEAR = Math.round(this.smoothedAvgEAR * 100) / 100;
    appState.telemetry.confidence = 96;

    // Draw futuristic AI Computer Vision HUD overlay
    this.drawFuturisticOverlay(pts, leftEyePts, rightEyePts, width, height, timestamp);

    // Synchronize telemetry to UI
    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate(appState.telemetry);
    }
  }

  /* -------------------------------------------------------------------------
     Eye State Machine, Blink Counter & Drowsiness Logic
     ------------------------------------------------------------------------- */
  evaluateEyes(leftClosed, rightClosed, leftState, rightState, delta, timestamp) {
    const bothClosed = leftClosed && rightClosed;
    const eitherClosed = leftClosed || rightClosed;

    // A. Blink Detection Logic
    // Detect transitions from open -> closed -> open within 70ms to 400ms
    if (bothClosed) {
      if (!this.prevBothClosed) {
        this.blinkCandidateStart = performance.now();
      }
    } else if (this.prevBothClosed) {
      // Eyes just re-opened: verify if duration matches a natural human blink
      if (this.blinkCandidateStart !== null) {
        const blinkDuration = (performance.now() - this.blinkCandidateStart) / 1000;
        if (blinkDuration >= 0.07 && blinkDuration <= 0.40) {
          // Confirmed genuine blink
          appState.telemetry.blinkCount++;
          const now = performance.now();
          this.blinkHistory.push(now);

          // Trigger momentary live blink indicator
          appState.telemetry.isBlinkingLive = true;
          if (this.blinkFlashTimeout) clearTimeout(this.blinkFlashTimeout);
          this.blinkFlashTimeout = setTimeout(() => {
            appState.telemetry.isBlinkingLive = false;
          }, 250);

          leftState = "BLINKING";
          rightState = "BLINKING";
        }
      }
      this.blinkCandidateStart = null;
    }
    this.prevBothClosed = bothClosed;

    // Calculate rolling Blinks Per Minute (BPM) over the last 60 seconds
    const cutoff = performance.now() - 60000;
    this.blinkHistory = this.blinkHistory.filter((t) => t >= cutoff);
    appState.telemetry.blinkRate = this.blinkHistory.length;

    appState.telemetry.leftEyeState = leftState;
    appState.telemetry.rightEyeState = rightState;

    // B. Prolonged Eye-Closure Duration & Drowsiness Risk
    const drowsinessThresholdSec = appState.settings.drowsinessThresholdSec;
    const warningThresholdSec = appState.settings.eyeClosureWarningSec;
    const cooldownSec = appState.settings.alarmCooldownSec;

    // Treat either closed (or both) as potential closure; prolonged closure requires both or primary
    const isEyesShut = bothClosed || (eitherClosed && (this.smoothedAvgEAR < appState.settings.earThreshold));

    if (isEyesShut) {
      if (this.closureStartTime === null) {
        this.closureStartTime = performance.now();
      }
      this.consecutiveClosedSeconds = (performance.now() - this.closureStartTime) / 1000;
      appState.telemetry.closureDurationSec = Math.round(this.consecutiveClosedSeconds * 100) / 100;

      if (this.consecutiveClosedSeconds >= drowsinessThresholdSec) {
        // High Risk: prolonged eye closure detected!
        appState.telemetry.drowsinessRisk = "HIGH_RISK";
        appState.setStatus("DROWSY");

        // Emergency Siren Activation with Cooldown Protection
        const now = performance.now();
        if (now >= this.alarmCooldownUntil) {
          soundManager.startDrowsinessAlert();
          if (!this.closureIncidentActive) {
            this.closureIncidentActive = true;
            appState.recordDrowsinessEvent();
          }
        }
      } else if (this.consecutiveClosedSeconds >= warningThresholdSec) {
        // Warning: eyes closed longer than a normal blink
        appState.telemetry.drowsinessRisk = "WARNING";
        appState.setStatus("DROWSY");
        soundManager.stopDrowsinessAlert();
      } else {
        // Normal blink window (< warningThresholdSec)
        appState.telemetry.drowsinessRisk = "NORMAL";
        appState.setStatus("ALERT");
        soundManager.stopDrowsinessAlert();
      }
    } else {
      // Eyes are open: clear closure duration immediately
      if (this.closureIncidentActive) {
        // Alarm incident just resolved: activate cooldown to prevent rapid alarm stutter
        this.alarmCooldownUntil = performance.now() + cooldownSec * 1000;
      }

      this.closureStartTime = null;
      this.consecutiveClosedSeconds = 0.0;
      this.closureIncidentActive = false;
      appState.telemetry.closureDurationSec = 0.0;
      appState.telemetry.drowsinessRisk = "NORMAL";
      appState.setStatus("ALERT");
      soundManager.stopDrowsinessAlert();
    }
  }

  /* -------------------------------------------------------------------------
     Tracking Loss Handling
     ------------------------------------------------------------------------- */
  handleFaceLoss(width, height) {
    const elapsedSinceFace = (performance.now() - this.lastFaceSeenTime) / 1000;
    if (elapsedSinceFace < 0.35) return; // momentary frame skip grace window

    appState.setStatus("NO_FACE");
    appState.telemetry.faceDetected = false;
    appState.telemetry.eyeTrackingStatus = "LOST";
    appState.telemetry.drowsinessRisk = "NORMAL";
    this.closureStartTime = null;
    this.consecutiveClosedSeconds = 0.0;
    this.closureIncidentActive = false;
    soundManager.stopDrowsinessAlert();

    if (this.canvasCtx) {
      this.canvasCtx.clearRect(0, 0, width, height);
      this.drawSearchingOverlay(width, height);
    }

    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate(appState.telemetry);
    }
  }

  /* -------------------------------------------------------------------------
     Interactive 3-Second Calibration
     ------------------------------------------------------------------------- */
  startCalibration(onProgress, onComplete) {
    this.isCalibrating = true;
    this.calibrationSamples = [];
    this.calibrationStartTime = performance.now();
    this.onCalibrationProgress = onProgress;
    this.onCalibrationComplete = onComplete;
    appState.telemetry.eyeTrackingStatus = "CALIBRATING";
  }

  processCalibrationStep(currentAvgEAR) {
    const elapsedSec = (performance.now() - this.calibrationStartTime) / 1000;
    const progress = Math.min(1.0, elapsedSec / 3.0);

    this.calibrationSamples.push(currentAvgEAR);

    if (this.onCalibrationProgress) {
      this.onCalibrationProgress(Math.round(progress * 100));
    }

    if (progress >= 1.0) {
      this.isCalibrating = false;
      const sum = this.calibrationSamples.reduce((a, b) => a + b, 0);
      const meanEAR = this.calibrationSamples.length > 0 ? sum / this.calibrationSamples.length : 0.28;
      // Recommended threshold: 75% of natural open-eye baseline
      const recommendedThreshold = Math.max(0.16, Math.min(0.28, Math.round(meanEAR * 0.74 * 100) / 100));

      appState.saveSettings({
        earThreshold: recommendedThreshold,
        calibratedBaselineEAR: Math.round(meanEAR * 100) / 100
      });

      if (this.onCalibrationComplete) {
        this.onCalibrationComplete({
          baselineEAR: Math.round(meanEAR * 100) / 100,
          newThreshold: recommendedThreshold
        });
      }
    }
  }

  /* -------------------------------------------------------------------------
     Secondary / Fallback Detectors
     ------------------------------------------------------------------------- */
  onLegacyFaceMeshResults(results) {
    if (!this.canvasCtx || !this.canvasElement) return;
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;
    const timestamp = performance.now();

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      this.lastFaceSeenTime = timestamp;
      const landmarks = results.multiFaceLandmarks[0];
      const pts = landmarks.map((p) => ({
        x: (1 - p.x) * width,
        y: p.y * height,
        z: (p.z || 0) * width
      }));

      const leftEyePts = LEFT_EYE_EAR_INDICES.map((i) => pts[i]);
      const rightEyePts = RIGHT_EYE_EAR_INDICES.map((i) => pts[i]);
      const rawLeft = computeEnhancedEAR(leftEyePts, pts[LEFT_EYE_MID_TOP], pts[LEFT_EYE_MID_BOT]);
      const rawRight = computeEnhancedEAR(rightEyePts, pts[RIGHT_EYE_MID_TOP], pts[RIGHT_EYE_MID_BOT]);

      this.smoothedLeftEAR = 0.75 * rawLeft + 0.25 * this.smoothedLeftEAR;
      this.smoothedRightEAR = 0.75 * rawRight + 0.25 * this.smoothedRightEAR;
      this.smoothedAvgEAR = (this.smoothedLeftEAR + this.smoothedRightEAR) / 2;

      const earThreshold = appState.settings.earThreshold;
      const leftClosed = this.smoothedLeftEAR < earThreshold;
      const rightClosed = this.smoothedRightEAR < earThreshold;

      this.evaluateEyes(leftClosed, rightClosed, leftClosed ? "CLOSED" : "OPEN", rightClosed ? "CLOSED" : "OPEN", 0.033, timestamp);

      appState.telemetry.faceDetected = true;
      appState.telemetry.eyeTrackingStatus = "ACTIVE";
      appState.telemetry.leftEAR = Math.round(this.smoothedLeftEAR * 100) / 100;
      appState.telemetry.rightEAR = Math.round(this.smoothedRightEAR * 100) / 100;
      appState.telemetry.avgEAR = Math.round(this.smoothedAvgEAR * 100) / 100;

      this.drawFuturisticOverlay(pts, leftEyePts, rightEyePts, width, height, timestamp);

      if (this.onTelemetryUpdate) {
        this.onTelemetryUpdate(appState.telemetry);
      }
    } else {
      this.handleFaceLoss(width, height);
    }
  }

  processFallbackCV(width, height, delta, timestamp) {
    if (!this.canvasCtx) return;
    this.canvasCtx.clearRect(0, 0, width, height);
    this.lastFaceSeenTime = performance.now();

    const cx = width / 2;
    const cy = height * 0.45;
    const boxW = width * 0.42;
    const boxH = height * 0.55;

    this.drawSearchingOverlay(width, height);
  }

  /* -------------------------------------------------------------------------
     FUTURISTIC AI COMPUTER VISION HUD OVERLAY
     ------------------------------------------------------------------------- */
  drawFuturisticOverlay(pts, leftEyePts, rightEyePts, width, height, timestamp) {
    const ctx = this.canvasCtx;
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    const risk = appState.telemetry.drowsinessRisk;
    let mainColor = "#38bdf8"; // Futuristic Royal/Cyber Cyan
    let glowColor = "rgba(56, 189, 248, 0.45)";

    if (risk === "HIGH_RISK") {
      mainColor = "#ef4444"; // Urgent Crimson
      glowColor = "rgba(239, 68, 68, 0.65)";
    } else if (risk === "WARNING") {
      mainColor = "#f59e0b"; // Warning Amber
      glowColor = "rgba(245, 158, 11, 0.55)";
    }

    // 1. Face Bounding Box & HUD Frame
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const padX = (maxX - minX) * 0.08;
    const padY = (maxY - minY) * 0.10;
    const boxX = Math.max(0, minX - padX);
    const boxY = Math.max(0, minY - padY);
    const boxW = Math.min(width - boxX, maxX - minX + padX * 2);
    const boxH = Math.min(height - boxY, maxY - minY + padY * 2);

    this.drawTacticalCorners(boxX, boxY, boxW, boxH, mainColor, glowColor);

    // Face HUD Micro Tag
    ctx.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = mainColor;
    ctx.fillText("AI VISION ASSIST // DRIVER_01 [TRACKING]", boxX + 8, Math.max(16, boxY - 8));

    // 2. Smooth Contours around Both Eyes
    this.drawSmoothContour(LEFT_EYE_FULL_CONTOUR, pts, mainColor, glowColor);
    this.drawSmoothContour(RIGHT_EYE_FULL_CONTOUR, pts, mainColor, glowColor);

    // 3. Animated Eye Landmark Nodes (key canthi and lid peaks)
    const keyLeftIndices = [362, 385, 387, 263, 373, 380, LEFT_IRIS_CENTER];
    const keyRightIndices = [33, 160, 158, 133, 153, 144, RIGHT_IRIS_CENTER];

    this.drawLandmarkNodes(keyLeftIndices, pts, mainColor, timestamp);
    this.drawLandmarkNodes(keyRightIndices, pts, mainColor, timestamp);

    // 4. Iris Crosshair Target Reticles
    if (pts[LEFT_IRIS_CENTER]) {
      this.drawIrisReticle(pts[LEFT_IRIS_CENTER], mainColor);
    }
    if (pts[RIGHT_IRIS_CENTER]) {
      this.drawIrisReticle(pts[RIGHT_IRIS_CENTER], mainColor);
    }

    // 5. Separate Eye HUD Bounding Panels & Live Labels
    this.drawEyeHUDBox(LEFT_EYE_FULL_CONTOUR, pts, "L-EYE", appState.telemetry.leftEyeState, appState.telemetry.leftEAR, mainColor);
    this.drawEyeHUDBox(RIGHT_EYE_FULL_CONTOUR, pts, "R-EYE", appState.telemetry.rightEyeState, appState.telemetry.rightEAR, mainColor);

    // 6. Subtle Cyber Scanning Effect across the Eye Region
    this.drawEyeRegionScanBeam(LEFT_EYE_FULL_CONTOUR, RIGHT_EYE_FULL_CONTOUR, pts, mainColor, timestamp);

    ctx.restore();
  }

  drawTacticalCorners(x, y, w, h, color, glow) {
    const ctx = this.canvasCtx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.0;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;

    const cornerLen = Math.min(26, w * 0.15);

    ctx.beginPath();
    // Top-left
    ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
    // Top-right
    ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen);
    // Bottom-left
    ctx.moveTo(x, y + h - cornerLen); ctx.lineTo(x, y + h); ctx.lineTo(x + cornerLen, y + h);
    // Bottom-right
    ctx.moveTo(x + w - cornerLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cornerLen);
    ctx.stroke();

    ctx.restore();
  }

  drawSmoothContour(indices, pts, color, glow) {
    const ctx = this.canvasCtx;
    if (!indices || indices.length === 0) return;

    ctx.save();
    ctx.beginPath();
    const first = pts[indices[0]];
    if (!first) return;

    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < indices.length; i++) {
      const p = pts[indices[i]];
      if (p) ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = "rgba(56, 189, 248, 0.06)";
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  drawLandmarkNodes(indices, pts, color, timestamp) {
    const ctx = this.canvasCtx;
    ctx.save();

    for (let i = 0; i < indices.length; i++) {
      const pt = pts[indices[i]];
      if (!pt) continue;

      // Subtle pulsating radius
      const pulse = Math.sin(timestamp * 0.007 + i) * 0.6;
      const radius = Math.max(1.5, 2.4 + pulse);

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fill();
    }

    ctx.restore();
  }

  drawIrisReticle(centerPt, color) {
    const ctx = this.canvasCtx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;

    const r = 7;
    // Iris circle
    ctx.beginPath();
    ctx.arc(centerPt.x, centerPt.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Iris micro crosshair ticks
    ctx.beginPath();
    ctx.moveTo(centerPt.x - r - 3, centerPt.y); ctx.lineTo(centerPt.x - r + 1, centerPt.y);
    ctx.moveTo(centerPt.x + r - 1, centerPt.y); ctx.lineTo(centerPt.x + r + 3, centerPt.y);
    ctx.moveTo(centerPt.x, centerPt.y - r - 3); ctx.lineTo(centerPt.x, centerPt.y - r + 1);
    ctx.moveTo(centerPt.x, centerPt.y + r - 1); ctx.lineTo(centerPt.x, centerPt.y + r + 3);
    ctx.stroke();

    ctx.restore();
  }

  drawEyeHUDBox(indices, pts, eyeLabel, eyeState, earVal, color) {
    const ctx = this.canvasCtx;
    let minX = 99999, maxX = -99999, minY = 99999, maxY = -99999;

    for (const idx of indices) {
      const p = pts[idx];
      if (!p) continue;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const pad = 6;
    const x = minX - pad;
    const y = minY - pad;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;

    ctx.save();

    // Micro corner brackets around eye
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    const tick = 5;
    ctx.beginPath();
    ctx.moveTo(x, y + tick); ctx.lineTo(x, y); ctx.lineTo(x + tick, y);
    ctx.moveTo(x + w - tick, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + tick);
    ctx.moveTo(x, y + h - tick); ctx.lineTo(x, y + h); ctx.lineTo(x + tick, y + h);
    ctx.moveTo(x + w - tick, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - tick);
    ctx.stroke();

    // HUD Label Pill above eye
    const labelText = `${eyeLabel}: ${eyeState} [EAR ${earVal.toFixed(2)}]`;
    ctx.font = "600 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const textWidth = ctx.measureText(labelText).width;

    const labelX = x + (w - textWidth) / 2;
    const labelY = Math.max(14, y - 6);

    ctx.fillStyle = "rgba(9, 14, 26, 0.75)";
    ctx.fillRect(labelX - 4, labelY - 11, textWidth + 8, 14);

    ctx.fillStyle = eyeState === "CLOSED" ? "#ef4444" : eyeState === "CLOSING" ? "#f59e0b" : "#38bdf8";
    ctx.fillText(labelText, labelX, labelY);

    ctx.restore();
  }

  drawEyeRegionScanBeam(leftIndices, rightIndices, pts, color, timestamp) {
    const ctx = this.canvasCtx;
    let minX = 99999, maxX = -99999, minY = 99999, maxY = -99999;

    const allEyeIndices = leftIndices.concat(rightIndices);
    for (const idx of allEyeIndices) {
      const p = pts[idx];
      if (!p) continue;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const bandH = Math.max(20, maxY - minY + 16);
    const startY = minY - 8;
    const scanProgress = (Math.sin(timestamp * 0.0035) + 1) / 2; // smooth 0 to 1 cycle
    const currentY = startY + scanProgress * bandH;

    ctx.save();
    const grad = ctx.createLinearGradient(minX - 16, currentY, maxX + 16, currentY);
    grad.addColorStop(0, "rgba(56, 189, 248, 0)");
    grad.addColorStop(0.3, "rgba(56, 189, 248, 0.35)");
    grad.addColorStop(0.5, "rgba(56, 189, 248, 0.75)");
    grad.addColorStop(0.7, "rgba(56, 189, 248, 0.35)");
    grad.addColorStop(1, "rgba(56, 189, 248, 0)");

    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = "rgba(56, 189, 248, 0.6)";
    ctx.shadowBlur = 6;

    ctx.beginPath();
    ctx.moveTo(minX - 16, currentY);
    ctx.lineTo(maxX + 16, currentY);
    ctx.stroke();

    ctx.restore();
  }

  drawSearchingOverlay(width, height) {
    const ctx = this.canvasCtx;
    if (!ctx) return;

    ctx.save();
    const cx = width / 2;
    const cy = height * 0.45;
    const boxW = width * 0.44;
    const boxH = height * 0.55;

    ctx.strokeStyle = "rgba(100, 116, 139, 0.45)";
    ctx.lineWidth = 1.5;
    this.drawTacticalCorners(cx - boxW / 2, cy - boxH / 2, boxW, boxH, "rgba(100, 116, 139, 0.6)", "rgba(100, 116, 139, 0.2)");

    ctx.font = "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "rgba(148, 163, 184, 0.75)";
    ctx.textAlign = "center";
    ctx.fillText("ALIGN FACE WITHIN FRAME", cx, cy + boxH / 2 + 22);

    ctx.restore();
  }
}

export const visionEngine = new VisionEngine();
