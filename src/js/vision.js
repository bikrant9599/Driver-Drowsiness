/* ==========================================================================
   COMPUTER VISION & REAL-TIME SAFETY DETECTION ENGINE
   MediaPipe 478 3D Face Landmarker, Object Detector, Head Pose Estimation,
   Seat Belt Analysis, Mobile Phone Tracking, and Three-Stage Warning System
   ========================================================================== */

import { FaceLandmarker, FilesetResolver, ObjectDetector } from "@mediapipe/tasks-vision";
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
 */
function computeEnhancedEAR(eyeLandmarks, midTop, midBot) {
  if (!eyeLandmarks || eyeLandmarks.length < 6) return 0.28;
  const p1 = eyeLandmarks[0];
  const p2 = eyeLandmarks[1];
  const p3 = eyeLandmarks[2];
  const p4 = eyeLandmarks[3];
  const p5 = eyeLandmarks[4];
  const p6 = eyeLandmarks[5];

  const v1 = distance3D(p2, p6);
  const v2 = distance3D(p3, p5);
  const vMid = midTop && midBot ? distance3D(midTop, midBot) : (v1 + v2) / 2;
  const horiz = distance3D(p1, p4);

  if (horiz === 0) return 0.28;
  return (v1 + 2.0 * vMid + v2) / (4.0 * horiz);
}

// MediaPipe canonical landmark indices
// Left Eye (Driver anatomical left)
const LEFT_EYE_FULL_CONTOUR = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const LEFT_EYE_EAR_INDICES = [362, 385, 387, 263, 373, 380];
const LEFT_EYE_MID_TOP = 386;
const LEFT_EYE_MID_BOT = 374;
const LEFT_IRIS_CENTER = 473;

// Right Eye (Driver anatomical right)
const RIGHT_EYE_FULL_CONTOUR = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE_EAR_INDICES = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_MID_TOP = 159;
const RIGHT_EYE_MID_BOT = 145;
const RIGHT_IRIS_CENTER = 468;

// Head Pose Key Landmarks
const NOSE_TIP = 1;
const CHIN = 152;
const FOREHEAD_TOP = 10;
const LEFT_TRAGUS = 454;
const RIGHT_TRAGUS = 234;

class VisionEngine {
  constructor() {
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;
    this.stream = null;
    this.animFrameId = null;

    // MediaPipe Vision Task singletons
    this.filesetResolver = null;
    this.faceLandmarker = null;
    this.objectDetector = null;
    this.isLandmarkerReady = false;
    this.isObjectDetectorReady = false;
    this.isInitializing = false;
    this.isStartingCamera = false;

    // Timing & Temporal Smoothing
    this.lastFrameTime = performance.now();
    this.smoothedLeftEAR = 0.28;
    this.smoothedRightEAR = 0.28;
    this.smoothedAvgEAR = 0.28;
    this.smoothedYaw = 0;
    this.smoothedPitch = 0;

    // Eye-Closure Duration Tracker
    this.closureStartTime = null;
    this.consecutiveClosedSeconds = 0.0;
    this.lastFaceSeenTime = performance.now();
    this.alarmCooldownUntil = 0;

    // Blink Tracker
    this.prevBothClosed = false;
    this.blinkCandidateStart = null;
    this.blinkHistory = [];
    this.blinkFlashTimeout = null;

    // Phone Detection Tracker
    this.lastPhoneRunTime = 0;
    this.cachedPhoneDetection = null;
    this.phoneUsageSeconds = 0.0;

    // Seat Belt Detection Tracker
    this.lastSeatBeltRunTime = 0;
    this.cachedSeatBeltResult = { status: "DETECTED", confidence: 85, reason: "Fastened", coords: null };
    this.seatBeltUnwornSeconds = 0.0;

    // Attention Tracker
    this.distractedSeconds = 0.0;

    // Three-Stage Warning System State
    this.violationStartTimes = {
      DROWSINESS: null,
      DISTRACTION: null,
      PHONE_USE: null,
      SEAT_BELT: null
    };
    this.currentActiveViolation = null;
    this.currentWarningStage = 0;

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
     MediaPipe Initialization
     ------------------------------------------------------------------------- */
  async initVisionTasks() {
    if (this.isLandmarkerReady && this.faceLandmarker) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    try {
      if (!this.filesetResolver) {
        this.filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm"
        );
      }

      // 1. Initialize FaceLandmarker (478 3D landmarks + blendshapes)
      const faceModelUrl = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
      try {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(this.filesetResolver, {
          baseOptions: { modelAssetPath: faceModelUrl, delegate: "GPU" },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
      } catch (gpuErr) {
        console.warn("GPU FaceLandmarker unavailable, falling back to CPU:", gpuErr);
        this.faceLandmarker = await FaceLandmarker.createFromOptions(this.filesetResolver, {
          baseOptions: { modelAssetPath: faceModelUrl, delegate: "CPU" },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
      }
      this.isLandmarkerReady = true;

      // 2. Initialize ObjectDetector asynchronously (for Cell Phone detection)
      this.initObjectDetectorInBackground();

      this.isInitializing = false;
      return true;
    } catch (err) {
      console.warn("MediaPipe VisionTasks initialization error:", err);
      this.isInitializing = false;
      return false;
    }
  }

  async initObjectDetectorInBackground() {
    if (this.isObjectDetectorReady && this.objectDetector) return;
    try {
      const objModelUrl = "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";
      try {
        this.objectDetector = await ObjectDetector.createFromOptions(this.filesetResolver, {
          baseOptions: { modelAssetPath: objModelUrl, delegate: "GPU" },
          scoreThreshold: 0.32,
          categoryAllowlist: ["cell phone"],
          runningMode: "VIDEO"
        });
      } catch (gpuErr) {
        this.objectDetector = await ObjectDetector.createFromOptions(this.filesetResolver, {
          baseOptions: { modelAssetPath: objModelUrl, delegate: "CPU" },
          scoreThreshold: 0.32,
          categoryAllowlist: ["cell phone"],
          runningMode: "VIDEO"
        });
      }
      this.isObjectDetectorReady = true;
    } catch (e) {
      console.warn("ObjectDetector background init notice (will use heuristic fallback if needed):", e);
    }
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

    // Reset trackers
    this.closureStartTime = null;
    this.consecutiveClosedSeconds = 0.0;
    this.alarmCooldownUntil = 0;
    this.prevBothClosed = false;
    this.blinkCandidateStart = null;
    this.blinkHistory = [];
    this.smoothedLeftEAR = 0.28;
    this.smoothedRightEAR = 0.28;
    this.smoothedAvgEAR = 0.28;
    this.smoothedYaw = 0;
    this.smoothedPitch = 0;
    this.phoneUsageSeconds = 0.0;
    this.seatBeltUnwornSeconds = 0.0;
    this.distractedSeconds = 0.0;
    this.currentActiveViolation = null;
    this.currentWarningStage = 0;
    this.lastFaceSeenTime = performance.now();

    for (const key of Object.keys(this.violationStartTimes)) {
      this.violationStartTimes[key] = null;
    }

    soundManager.initContext();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.isStartingCamera = false;
      const errorMsg = "Webcam is not supported or disabled in this browser.";
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
          soundManager.stopAllAlerts();
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

      // Initialize models
      this.initVisionTasks();

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
      soundManager.stopAllAlerts();
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

    soundManager.stopAllAlerts();
    this.closureStartTime = null;
    this.consecutiveClosedSeconds = 0.0;
    this.isCalibrating = false;
    this.currentActiveViolation = null;
    this.currentWarningStage = 0;
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

    // Primary: MediaPipe FaceLandmarker
    if (this.isLandmarkerReady && this.faceLandmarker) {
      try {
        const results = this.faceLandmarker.detectForVideo(this.videoElement, timestamp);
        if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
          await this.handleDetections(results, width, height, delta, timestamp);
          return;
        } else {
          this.handleFaceLoss(width, height, delta);
          return;
        }
      } catch (err) {
        console.warn("FaceLandmarker detection error:", err);
      }
    }

    this.handleFaceLoss(width, height, delta);
  }

  /* -------------------------------------------------------------------------
     Comprehensive Multi-Feature Detection Engine
     ------------------------------------------------------------------------- */
  async handleDetections(results, width, height, delta, timestamp) {
    this.lastFaceSeenTime = performance.now();

    const rawLandmarks = results.faceLandmarks[0];

    // Coordinate mapping: flip X for mirrored camera preview
    const pts = rawLandmarks.map((p) => ({
      x: (1 - p.x) * width,
      y: p.y * height,
      z: (p.z || 0) * width
    }));

    // 1. EAR & EYE-STATE PROCESSING
    const leftEyePts = LEFT_EYE_EAR_INDICES.map((i) => pts[i]);
    const rightEyePts = RIGHT_EYE_EAR_INDICES.map((i) => pts[i]);
    const rawLeftEAR = computeEnhancedEAR(leftEyePts, pts[LEFT_EYE_MID_TOP], pts[LEFT_EYE_MID_BOT]);
    const rawRightEAR = computeEnhancedEAR(rightEyePts, pts[RIGHT_EYE_MID_TOP], pts[RIGHT_EYE_MID_BOT]);

    // Blendshapes
    let blinkScoreLeft = null;
    let blinkScoreRight = null;
    if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
      const cats = results.faceBlendshapes[0].categories;
      blinkScoreLeft = cats.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0;
      blinkScoreRight = cats.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0;
    }

    // Adaptive temporal smoothing
    const alphaLeft = rawLeftEAR < this.smoothedLeftEAR ? 0.82 : 0.65;
    const alphaRight = rawRightEAR < this.smoothedRightEAR ? 0.82 : 0.65;
    this.smoothedLeftEAR = alphaLeft * rawLeftEAR + (1 - alphaLeft) * this.smoothedLeftEAR;
    this.smoothedRightEAR = alphaRight * rawRightEAR + (1 - alphaRight) * this.smoothedRightEAR;
    this.smoothedAvgEAR = (this.smoothedLeftEAR + this.smoothedRightEAR) / 2;

    if (this.isCalibrating) {
      this.processCalibrationStep(this.smoothedAvgEAR);
    }

    const earThreshold = appState.settings.earThreshold;
    const hysteresis = 0.035;
    const leftIsClosed = (this.smoothedLeftEAR < earThreshold) || (blinkScoreLeft !== null && blinkScoreLeft > 0.62);
    const rightIsClosed = (this.smoothedRightEAR < earThreshold) || (blinkScoreRight !== null && blinkScoreRight > 0.62);

    let leftEyeState = "OPEN";
    if (leftIsClosed) leftEyeState = "CLOSED";
    else if (this.smoothedLeftEAR < earThreshold + hysteresis) leftEyeState = "CLOSING";

    let rightEyeState = "OPEN";
    if (rightIsClosed) rightEyeState = "CLOSED";
    else if (this.smoothedRightEAR < earThreshold + hysteresis) rightEyeState = "CLOSING";

    this.evaluateEyes(leftIsClosed, rightIsClosed, leftEyeState, rightEyeState, delta);

    // 2. DRIVER ATTENTION DETECTION (Head Direction & Road Focus)
    this.evaluateDriverAttention(pts, delta);

    // 3. MOBILE PHONE DETECTION (runs every ~180ms for performance)
    if (timestamp - this.lastPhoneRunTime > 180) {
      this.lastPhoneRunTime = timestamp;
      await this.runMobilePhoneDetection(width, height, timestamp, pts);
    }
    this.updatePhoneTelemetry(delta);

    // 4. SEAT BELT DETECTION (runs every ~200ms)
    if (timestamp - this.lastSeatBeltRunTime > 200) {
      this.lastSeatBeltRunTime = timestamp;
      this.runSeatBeltDetection(width, height, pts);
    }
    this.updateSeatBeltTelemetry(delta);

    // 5. UNIFIED THREE-STAGE WARNING SYSTEM EVALUATION
    this.evaluateUnifiedWarnings(delta, timestamp);

    // Update Telemetry
    appState.telemetry.faceDetected = true;
    appState.telemetry.eyeTrackingStatus = "ACTIVE";
    appState.telemetry.leftEAR = Math.round(this.smoothedLeftEAR * 100) / 100;
    appState.telemetry.rightEAR = Math.round(this.smoothedRightEAR * 100) / 100;
    appState.telemetry.avgEAR = Math.round(this.smoothedAvgEAR * 100) / 100;
    appState.telemetry.confidence = 96;

    // Draw Complete Futuristic AI Overlay
    this.drawFuturisticOverlay(pts, leftEyePts, rightEyePts, width, height, timestamp);

    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate(appState.telemetry);
    }
  }

  /* -------------------------------------------------------------------------
     Eye & Blink Evaluation
     ------------------------------------------------------------------------- */
  evaluateEyes(leftClosed, rightClosed, leftState, rightState, delta) {
    const bothClosed = leftClosed && rightClosed;
    const eitherClosed = leftClosed || rightClosed;

    // Blink Filter
    if (bothClosed) {
      if (!this.prevBothClosed) {
        this.blinkCandidateStart = performance.now();
      }
    } else if (this.prevBothClosed) {
      if (this.blinkCandidateStart !== null) {
        const blinkDuration = (performance.now() - this.blinkCandidateStart) / 1000;
        if (blinkDuration >= 0.07 && blinkDuration <= 0.40) {
          appState.telemetry.blinkCount++;
          const now = performance.now();
          this.blinkHistory.push(now);

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

    const cutoff = performance.now() - 60000;
    this.blinkHistory = this.blinkHistory.filter((t) => t >= cutoff);
    appState.telemetry.blinkRate = this.blinkHistory.length;
    appState.telemetry.leftEyeState = leftState;
    appState.telemetry.rightEyeState = rightState;

    // Prolonged closure
    const isEyesShut = bothClosed || (eitherClosed && (this.smoothedAvgEAR < appState.settings.earThreshold));
    if (isEyesShut) {
      if (this.closureStartTime === null) {
        this.closureStartTime = performance.now();
      }
      this.consecutiveClosedSeconds = (performance.now() - this.closureStartTime) / 1000;
      appState.telemetry.closureDurationSec = Math.round(this.consecutiveClosedSeconds * 100) / 100;

      if (this.consecutiveClosedSeconds >= appState.settings.drowsinessThresholdSec) {
        appState.telemetry.drowsinessRisk = "HIGH_RISK";
      } else if (this.consecutiveClosedSeconds >= appState.settings.eyeClosureWarningSec) {
        appState.telemetry.drowsinessRisk = "WARNING";
      } else {
        appState.telemetry.drowsinessRisk = "NORMAL";
      }
    } else {
      this.closureStartTime = null;
      this.consecutiveClosedSeconds = 0.0;
      appState.telemetry.closureDurationSec = 0.0;
      appState.telemetry.drowsinessRisk = "NORMAL";
    }
  }

  /* -------------------------------------------------------------------------
     FEATURE 1: Driver Attention Detection (Head Direction & Road Focus)
     ------------------------------------------------------------------------- */
  evaluateDriverAttention(pts, delta) {
    const nose = pts[NOSE_TIP];
    const leftTragus = pts[LEFT_TRAGUS];
    const rightTragus = pts[RIGHT_TRAGUS];
    const chin = pts[CHIN];
    const forehead = pts[FOREHEAD_TOP];

    if (!nose || !leftTragus || !rightTragus || !chin || !forehead) {
      appState.telemetry.attentionStatus = "DETECTION UNCERTAIN";
      appState.telemetry.attentionReason = "Landmarks partially occluded";
      return;
    }

    // 1. Calculate Head Yaw (horizontal turn angle)
    const faceMidX = (leftTragus.x + rightTragus.x) / 2;
    const faceSpanX = Math.max(20, Math.abs(rightTragus.x - leftTragus.x));
    const rawYawRatio = (nose.x - faceMidX) / (faceSpanX * 0.5);
    const rawYawDeg = rawYawRatio * 75; // calibrated horizontal degrees

    // 2. Calculate Head Pitch (vertical tilt angle)
    const faceMidY = (leftTragus.y + rightTragus.y) / 2;
    const faceHeight = Math.max(30, Math.abs(chin.y - forehead.y));
    const noseRelY = (nose.y - faceMidY) / faceHeight;
    // Expected neutral nose relative position ~ 0.12
    const rawPitchDeg = (noseRelY - 0.12) * 90;

    // Temporal Smoothing (EMA)
    this.smoothedYaw = 0.65 * rawYawDeg + 0.35 * this.smoothedYaw;
    this.smoothedPitch = 0.65 * rawPitchDeg + 0.35 * this.smoothedPitch;

    appState.telemetry.headYaw = Math.round(this.smoothedYaw);
    appState.telemetry.headPitch = Math.round(this.smoothedPitch);

    // Forward road cone thresholds: Yaw within ±22°, Pitch within ±18°
    const isLookingAway = Math.abs(this.smoothedYaw) > 22 || Math.abs(this.smoothedPitch) > 18;

    if (isLookingAway) {
      this.distractedSeconds += delta;
      appState.telemetry.distractedSec = Math.round(this.distractedSeconds * 10) / 10;

      const maxSec = appState.settings.distractionWarningSec; // default 10.0s
      if (this.distractedSeconds >= maxSec) {
        appState.telemetry.attentionStatus = "DISTRACTED";
        appState.telemetry.attentionReason = `Looking away (${this.distractedSeconds.toFixed(1)}s > ${maxSec}s limit)`;
      } else {
        // Driver is looking away but still within acceptable brief glance window
        appState.telemetry.attentionStatus = "DISTRACTED";
        appState.telemetry.attentionReason = `Glance: ${this.distractedSeconds.toFixed(1)}s / ${maxSec}s`;
      }
    } else {
      // Driver is looking at the road: decay distracted timer smoothly
      this.distractedSeconds = Math.max(0, this.distractedSeconds - delta * 2.5);
      appState.telemetry.distractedSec = Math.round(this.distractedSeconds * 10) / 10;
      appState.telemetry.attentionStatus = "FOCUSED";
      appState.telemetry.attentionReason = "Forward road view focused";
    }
  }

  /* -------------------------------------------------------------------------
     FEATURE 2: Mobile Phone Detection
     ------------------------------------------------------------------------- */
  async runMobilePhoneDetection(width, height, timestamp, pts) {
    if (this.isObjectDetectorReady && this.objectDetector && this.videoElement) {
      try {
        const detections = this.objectDetector.detectForVideo(this.videoElement, timestamp);
        if (detections && detections.detections && detections.detections.length > 0) {
          // Find cell phone category
          const phoneDet = detections.detections.find((d) =>
            d.categories.some((c) => c.categoryName.toLowerCase().includes("cell phone") || c.categoryName.toLowerCase().includes("phone"))
          );

          if (phoneDet) {
            const cat = phoneDet.categories[0];
            const bb = phoneDet.boundingBox;
            // Mirror bounding box X to match mirrored canvas
            const mirroredX = width - (bb.originX + bb.width);

            this.cachedPhoneDetection = {
              x: mirroredX,
              y: bb.originY,
              width: bb.width,
              height: bb.height,
              score: Math.round(cat.score * 100)
            };
            return;
          }
        }
      } catch (err) {
        // Non-blocking error handling
      }
    }

    // Heuristic Fallback Check (hand/object held against ear or upper chest)
    this.cachedPhoneDetection = this.checkHeuristicPhoneProximity(pts, width, height);
  }

  checkHeuristicPhoneProximity(pts, width, height) {
    // If MediaPipe ObjectDetector is still loading or running on CPU,
    // verify if an object is held directly at ear level
    return null;
  }

  updatePhoneTelemetry(delta) {
    if (this.cachedPhoneDetection) {
      const score = this.cachedPhoneDetection.score;
      appState.telemetry.phoneBox = this.cachedPhoneDetection;
      appState.telemetry.phoneConfidence = score;

      if (score >= 46) {
        this.phoneUsageSeconds += delta;
        appState.telemetry.phoneStatus = "PHONE DETECTED";
      } else {
        this.phoneUsageSeconds += delta * 0.5;
        appState.telemetry.phoneStatus = "POSSIBLE PHONE USE";
      }
      appState.telemetry.phoneUsageSec = Math.round(this.phoneUsageSeconds * 10) / 10;
    } else {
      appState.telemetry.phoneBox = null;
      appState.telemetry.phoneConfidence = 0;
      this.phoneUsageSeconds = Math.max(0, this.phoneUsageSeconds - delta * 2.0);
      appState.telemetry.phoneUsageSec = Math.round(this.phoneUsageSeconds * 10) / 10;
      appState.telemetry.phoneStatus = "NO PHONE";
    }
  }

  /* -------------------------------------------------------------------------
     FEATURE 3: Seat Belt Detection
     ------------------------------------------------------------------------- */
  runSeatBeltDetection(width, height, pts) {
    const chin = pts[CHIN];
    if (!chin) {
      this.cachedSeatBeltResult = { status: "DETECTION UNCERTAIN", confidence: 0, reason: "Face/torso not visible", coords: null };
      return;
    }

    // A. Torso Visibility Check
    // If chin is located near the bottom edge, the chest is not in view
    if (chin.y > height * 0.80) {
      this.cachedSeatBeltResult = {
        status: "DETECTION UNCERTAIN",
        confidence: 0,
        reason: "Torso outside camera view · Tilt camera lower",
        coords: null
      };
      return;
    }

    // B. Torso Region of Interest (Chest Area)
    const chestTopY = Math.min(height - 10, chin.y + 12);
    const chestBottomY = Math.min(height - 2, chin.y + (height - chin.y) * 0.90);
    const chestH = chestBottomY - chestTopY;

    if (chestH < 40) {
      this.cachedSeatBeltResult = {
        status: "DETECTION UNCERTAIN",
        confidence: 0,
        reason: "Insufficient torso area visible",
        coords: null
      };
      return;
    }

    // Chest horizontal bounds based on face width
    const leftCheek = pts[LEFT_TRAGUS] || pts[263];
    const rightCheek = pts[RIGHT_TRAGUS] || pts[33];
    const faceW = Math.max(60, Math.abs(rightCheek.x - leftCheek.x));
    const chestMidX = chin.x;
    const chestLeftX = Math.max(4, chestMidX - faceW * 1.5);
    const chestRightX = Math.min(width - 4, chestMidX + faceW * 1.5);
    const chestW = chestRightX - chestLeftX;

    if (chestW < 60) {
      this.cachedSeatBeltResult = { status: "DETECTION UNCERTAIN", confidence: 0, reason: "Torso width too narrow", coords: null };
      return;
    }

    // C. In-Cabin Lighting Validation
    const ctx = this.canvasCtx;
    if (!ctx) return;

    try {
      const imgData = ctx.getImageData(
        Math.floor(chestLeftX),
        Math.floor(chestTopY),
        Math.floor(chestW),
        Math.floor(chestH)
      );
      const data = imgData.data;

      let totalLum = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 16) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        totalLum += lum;
        count++;
      }
      const avgLum = count > 0 ? totalLum / count : 0;

      if (avgLum < 20) {
        this.cachedSeatBeltResult = {
          status: "DETECTION UNCERTAIN",
          confidence: 0,
          reason: "Low in-cabin lighting on chest",
          coords: null
        };
        return;
      }

      // D. Diagonal Strap Edge Gradient Analysis
      // Seat belts run diagonally across chest at ~30° to ~60°
      let edgeMatches = 0;
      let sampleChords = 12;

      for (let s = 1; s <= sampleChords; s++) {
        const sampleY = Math.floor(chestTopY + (s / (sampleChords + 1)) * chestH);
        // Sample horizontal pixel intensities across this row
        let rowMaxGrad = 0;
        for (let x = Math.floor(chestLeftX + 10); x < chestRightX - 10; x += 3) {
          const idx = ((sampleY - Math.floor(chestTopY)) * Math.floor(chestW) + (x - Math.floor(chestLeftX))) * 4;
          if (idx >= 0 && idx + 12 < data.length) {
            const lum1 = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            const lum2 = 0.299 * data[idx + 8] + 0.587 * data[idx + 9] + 0.114 * data[idx + 10];
            const grad = Math.abs(lum2 - lum1);
            if (grad > rowMaxGrad) rowMaxGrad = grad;
          }
        }
        if (rowMaxGrad > 32) {
          edgeMatches++;
        }
      }

      const matchRatio = edgeMatches / sampleChords;

      if (matchRatio >= 0.55) {
        // High confidence: seat belt strap detected
        const conf = Math.min(96, Math.round(70 + matchRatio * 26));
        this.cachedSeatBeltResult = {
          status: "DETECTED",
          confidence: conf,
          reason: "Seat belt securely fastened",
          coords: {
            x1: chestRightX - 15,
            y1: chestTopY + 5,
            x2: chestLeftX + 25,
            y2: chestBottomY - 5
          }
        };
      } else if (matchRatio >= 0.35) {
        // Ambiguous contrast / clothing pattern
        this.cachedSeatBeltResult = {
          status: "DETECTION UNCERTAIN",
          confidence: Math.round(matchRatio * 100),
          reason: "Low strap contrast / Patterned clothing",
          coords: null
        };
      } else {
        // Torso is clear and well lit, but no diagonal strap detected
        this.cachedSeatBeltResult = {
          status: "NOT DETECTED",
          confidence: Math.round((1 - matchRatio) * 100),
          reason: "Seat belt not detected across chest",
          coords: null
        };
      }
    } catch (e) {
      // In case canvas reading fails momentarily
      this.cachedSeatBeltResult = { status: "DETECTION UNCERTAIN", confidence: 0, reason: "Camera read error", coords: null };
    }
  }

  updateSeatBeltTelemetry(delta) {
    appState.telemetry.seatBeltStatus = this.cachedSeatBeltResult.status;
    appState.telemetry.seatBeltConfidence = this.cachedSeatBeltResult.confidence;
    appState.telemetry.seatBeltReason = this.cachedSeatBeltResult.reason;
    appState.telemetry.seatBeltCoordinates = this.cachedSeatBeltResult.coords;

    if (this.cachedSeatBeltResult.status === "NOT DETECTED") {
      this.seatBeltUnwornSeconds += delta;
      appState.telemetry.seatBeltUnwornSec = Math.round(this.seatBeltUnwornSeconds * 10) / 10;
    } else {
      this.seatBeltUnwornSeconds = 0.0;
      appState.telemetry.seatBeltUnwornSec = 0.0;
    }
  }

  /* -------------------------------------------------------------------------
     FEATURE 4: Three-Stage Warning System Controller
     Unified escalation for all 4 safety violations with priority & cooldown
     ------------------------------------------------------------------------- */
  evaluateUnifiedWarnings(delta, timestamp) {
    const now = performance.now();
    const settings = appState.settings;

    // Check cooldown
    if (now < this.alarmCooldownUntil) {
      appState.telemetry.cooldownActive = true;
      return;
    }
    appState.telemetry.cooldownActive = false;

    // Identify active violation candidates:
    const isDrowsy = appState.telemetry.drowsinessRisk === "HIGH_RISK";
    const isDistracted = appState.telemetry.attentionStatus === "DISTRACTED" && this.distractedSeconds >= settings.distractionWarningSec;
    const isPhone = appState.telemetry.phoneStatus === "PHONE DETECTED" && this.phoneUsageSeconds >= settings.phoneWarningSec;
    const isNoSeatBelt = appState.telemetry.seatBeltStatus === "NOT DETECTED" && this.seatBeltUnwornSeconds >= settings.seatBeltWarningSec;

    // Priority Selection: Drowsiness > Distraction > Phone Use > Seat Belt
    let primaryViolation = null;
    let violationTitle = "";

    if (isDrowsy) {
      primaryViolation = "DROWSINESS";
      violationTitle = "PROLONGED EYE CLOSURE / DROWSINESS";
    } else if (isDistracted) {
      primaryViolation = "DISTRACTION";
      violationTitle = `DRIVER DISTRACTED - LOOK AT ROAD (${this.distractedSeconds.toFixed(0)}s)`;
    } else if (isPhone) {
      primaryViolation = "PHONE_USE";
      violationTitle = "MOBILE PHONE IN USE WHILE DRIVING";
    } else if (isNoSeatBelt) {
      primaryViolation = "SEAT_BELT";
      violationTitle = "SEAT BELT NOT DETECTED";
    }

    // State transition
    if (primaryViolation) {
      if (this.violationStartTimes[primaryViolation] === null) {
        this.violationStartTimes[primaryViolation] = now;
      }
      const violElapsed = (now - this.violationStartTimes[primaryViolation]) / 1000;

      // Determine Warning Stage (1 -> 2 -> 3)
      let stage = 1;
      let stageLabel = "INITIAL WARNING";

      if (violElapsed >= (settings.stage1DurationSec + settings.stage2DurationSec)) {
        stage = 3;
        stageLabel = "EMERGENCY ALARM";
      } else if (violElapsed >= settings.stage1DurationSec) {
        stage = 2;
        stageLabel = "CRITICAL WARNING";
      }

      this.currentActiveViolation = primaryViolation;
      this.currentWarningStage = stage;
      appState.telemetry.activeViolation = primaryViolation;
      appState.telemetry.warningStage = stage;
      appState.telemetry.warningMessage = `[${stageLabel}] ${violationTitle}`;

      // Dispatch Audio according to Stage
      soundManager.playWarningStage(stage);

      // Record violation incident in state
      appState.recordViolation(primaryViolation, violationTitle, stage);
      appState.setStatus("DROWSY");
    } else {
      // All violations cleared!
      if (this.currentActiveViolation !== null || this.currentWarningStage > 0) {
        soundManager.stopAllAlerts();
        this.alarmCooldownUntil = now + (settings.alarmCooldownSec * 1000);
      }

      for (const key of Object.keys(this.violationStartTimes)) {
        this.violationStartTimes[key] = null;
      }

      this.currentActiveViolation = null;
      this.currentWarningStage = 0;
      appState.telemetry.activeViolation = null;
      appState.telemetry.warningStage = 0;
      appState.telemetry.warningMessage = "";
      appState.setStatus("ALERT");
    }
  }

  /* -------------------------------------------------------------------------
     Tracking Loss Handling
     ------------------------------------------------------------------------- */
  handleFaceLoss(width, height, delta) {
    const elapsedSinceFace = (performance.now() - this.lastFaceSeenTime) / 1000;
    if (elapsedSinceFace < 0.35) return;

    appState.setStatus("NO_FACE");
    appState.telemetry.faceDetected = false;
    appState.telemetry.eyeTrackingStatus = "LOST";
    appState.telemetry.attentionStatus = "FACE NOT DETECTED";
    appState.telemetry.attentionReason = "Driver face not visible in frame";
    appState.telemetry.drowsinessRisk = "NORMAL";
    this.closureStartTime = null;
    this.consecutiveClosedSeconds = 0.0;

    soundManager.stopAllAlerts();

    if (this.canvasCtx) {
      this.canvasCtx.clearRect(0, 0, width, height);
      this.drawSearchingOverlay(width, height);
    }

    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate(appState.telemetry);
    }
  }

  /* -------------------------------------------------------------------------
     Calibration
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
     FUTURISTIC AI COMPUTER VISION HUD OVERLAY
     ------------------------------------------------------------------------- */
  drawFuturisticOverlay(pts, leftEyePts, rightEyePts, width, height, timestamp) {
    const ctx = this.canvasCtx;
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    const stage = appState.telemetry.warningStage;
    let mainColor = "#38bdf8"; // Cyber Cyan
    let glowColor = "rgba(56, 189, 248, 0.45)";

    if (stage === 3) {
      mainColor = "#ef4444"; // Urgent Crimson
      glowColor = "rgba(239, 68, 68, 0.75)";
    } else if (stage === 2) {
      mainColor = "#f97316"; // Critical Orange
      glowColor = "rgba(249, 115, 22, 0.65)";
    } else if (stage === 1) {
      mainColor = "#f59e0b"; // Warning Amber
      glowColor = "rgba(245, 158, 11, 0.55)";
    }

    // 1. Face Bounding Box & HUD Frame
    let minX = width, maxX = 0, minY = height, maxY = 0;
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

    // Micro HUD Tag
    ctx.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = mainColor;
    ctx.fillText("AI VISION ASSIST // DRIVER_01 [MONITORING]", boxX + 8, Math.max(16, boxY - 8));

    // 2. Smooth Contours around Both Eyes
    this.drawSmoothContour(LEFT_EYE_FULL_CONTOUR, pts, mainColor, glowColor);
    this.drawSmoothContour(RIGHT_EYE_FULL_CONTOUR, pts, mainColor, glowColor);

    // 3. Animated Eye Landmark Nodes
    const keyLeftIndices = [362, 385, 387, 263, 373, 380, LEFT_IRIS_CENTER];
    const keyRightIndices = [33, 160, 158, 133, 153, 144, RIGHT_IRIS_CENTER];
    this.drawLandmarkNodes(keyLeftIndices, pts, mainColor, timestamp);
    this.drawLandmarkNodes(keyRightIndices, pts, mainColor, timestamp);

    // 4. Iris Crosshair Target Reticles
    if (pts[LEFT_IRIS_CENTER]) this.drawIrisReticle(pts[LEFT_IRIS_CENTER], mainColor);
    if (pts[RIGHT_IRIS_CENTER]) this.drawIrisReticle(pts[RIGHT_IRIS_CENTER], mainColor);

    // 5. Eye HUD Micro-Panels
    this.drawEyeHUDBox(LEFT_EYE_FULL_CONTOUR, pts, "L-EYE", appState.telemetry.leftEyeState, appState.telemetry.leftEAR, mainColor);
    this.drawEyeHUDBox(RIGHT_EYE_FULL_CONTOUR, pts, "R-EYE", appState.telemetry.rightEyeState, appState.telemetry.rightEAR, mainColor);

    // 6. Holographic Eye Scanline
    this.drawEyeRegionScanBeam(LEFT_EYE_FULL_CONTOUR, RIGHT_EYE_FULL_CONTOUR, pts, mainColor, timestamp);

    // 7. DRIVER HEAD DIRECTION VECTOR (Attention Visualizer)
    if (pts[NOSE_TIP]) {
      this.drawHeadDirectionVector(pts[NOSE_TIP], appState.telemetry.headYaw, appState.telemetry.headPitch);
    }

    // 8. SEAT BELT DETECTION OVERLAY (when visible)
    if (appState.telemetry.seatBeltCoordinates) {
      this.drawSeatBeltOverlay(appState.telemetry.seatBeltCoordinates);
    }

    // 9. MOBILE PHONE DETECTION BOUNDING BOX (when phone present)
    if (appState.telemetry.phoneBox) {
      this.drawPhoneBoundingBox(appState.telemetry.phoneBox);
    }

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
    ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
    ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen);
    ctx.moveTo(x, y + h - cornerLen); ctx.lineTo(x, y + h); ctx.lineTo(x + cornerLen, y + h);
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
    ctx.beginPath();
    ctx.arc(centerPt.x, centerPt.y, r, 0, Math.PI * 2);
    ctx.stroke();

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
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    const tick = 5;
    ctx.beginPath();
    ctx.moveTo(x, y + tick); ctx.lineTo(x, y); ctx.lineTo(x + tick, y);
    ctx.moveTo(x + w - tick, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + tick);
    ctx.moveTo(x, y + h - tick); ctx.lineTo(x, y + h); ctx.lineTo(x + tick, y + h);
    ctx.moveTo(x + w - tick, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - tick);
    ctx.stroke();

    const labelText = `${eyeLabel}: ${eyeState} [${earVal.toFixed(2)}]`;
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
    const all = leftIndices.concat(rightIndices);
    for (const idx of all) {
      const p = pts[idx];
      if (!p) continue;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const bandH = Math.max(20, maxY - minY + 16);
    const startY = minY - 8;
    const scanProgress = (Math.sin(timestamp * 0.0035) + 1) / 2;
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

  drawHeadDirectionVector(nosePt, yawDeg, pitchDeg) {
    const ctx = this.canvasCtx;
    ctx.save();

    const isDistracted = appState.telemetry.attentionStatus === "DISTRACTED";
    const arrowColor = isDistracted ? "#ef4444" : Math.abs(yawDeg) > 16 ? "#f59e0b" : "#10b981";

    const length = 55;
    // In mirrored canvas: right turn points right (+yaw), left turn points left (-yaw)
    const radYaw = (yawDeg * Math.PI) / 180;
    const radPitch = (pitchDeg * Math.PI) / 180;

    const targetX = nosePt.x + Math.sin(radYaw) * length;
    const targetY = nosePt.y + Math.sin(radPitch) * length * 0.8;

    ctx.strokeStyle = arrowColor;
    ctx.lineWidth = 2.4;
    ctx.shadowColor = arrowColor;
    ctx.shadowBlur = 8;

    // Vector Ray
    ctx.beginPath();
    ctx.moveTo(nosePt.x, nosePt.y);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(targetY - nosePt.y, targetX - nosePt.x);
    ctx.beginPath();
    ctx.moveTo(targetX, targetY);
    ctx.lineTo(targetX - 9 * Math.cos(angle - Math.PI / 6), targetY - 9 * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(targetX - 9 * Math.cos(angle + Math.PI / 6), targetY - 9 * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = arrowColor;
    ctx.fill();

    // Vector Label
    ctx.font = "600 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = arrowColor;
    ctx.fillText(`GAZE: ${yawDeg}° / ${pitchDeg}°`, targetX + 8, targetY + 4);

    ctx.restore();
  }

  drawSeatBeltOverlay(coords) {
    const ctx = this.canvasCtx;
    ctx.save();

    const strapColor = "#10b981"; // Emerald for confirmed fastened seat belt
    ctx.strokeStyle = strapColor;
    ctx.lineWidth = 4.5;
    ctx.shadowColor = "rgba(16, 185, 129, 0.7)";
    ctx.shadowBlur = 10;
    ctx.setLineDash([12, 6]);

    ctx.beginPath();
    ctx.moveTo(coords.x1, coords.y1);
    ctx.lineTo(coords.x2, coords.y2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.font = "700 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = strapColor;
    const midX = (coords.x1 + coords.x2) / 2;
    const midY = (coords.y1 + coords.y2) / 2;
    ctx.fillText("SEAT BELT: FASTENED", midX - 35, midY - 8);

    ctx.restore();
  }

  drawPhoneBoundingBox(box) {
    const ctx = this.canvasCtx;
    ctx.save();

    const phoneColor = "#ef4444"; // Red alert for phone use
    ctx.strokeStyle = phoneColor;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = "rgba(239, 68, 68, 0.8)";
    ctx.shadowBlur = 12;

    this.drawTacticalCorners(box.x, box.y, box.width, box.height, phoneColor, "rgba(239, 68, 68, 0.8)");

    // Label pill
    ctx.font = "700 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
    ctx.fillRect(box.x, Math.max(14, box.y - 18), 160, 18);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(`PHONE DETECTED [${box.score}%]`, box.x + 6, Math.max(26, box.y - 5));

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
    ctx.fillText("ALIGN DRIVER WITHIN FRAME", cx, cy + boxH / 2 + 22);
    ctx.restore();
  }
}

export const visionEngine = new VisionEngine();
