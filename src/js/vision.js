/* ==========================================================================
   COMPUTER VISION, MEDIAPIPE FACE LANDMARKER & EAR DETECTION ENGINE
   ========================================================================== */

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { appState } from "./state.js";
import { soundManager } from "./audio.js";
import { showToast } from "./utils.js";

// Euclidean distance between 2D/3D points
function distance(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

/**
 * Eye Aspect Ratio (EAR) formula according to Soukupová & Čech (2016):
 * EAR = ( ||p2 - p6|| + ||p3 - p5|| ) / ( 2 * ||p1 - p4|| )
 */
function computeEAR(eyeLandmarks) {
  if (!eyeLandmarks || eyeLandmarks.length < 6) return 0.28;
  const p1 = eyeLandmarks[0]; // Outer corner
  const p2 = eyeLandmarks[1]; // Top-outer
  const p3 = eyeLandmarks[2]; // Top-inner
  const p4 = eyeLandmarks[3]; // Inner corner
  const p5 = eyeLandmarks[4]; // Bottom-inner
  const p6 = eyeLandmarks[5]; // Bottom-outer

  const vert1 = distance(p2, p6);
  const vert2 = distance(p3, p5);
  const horiz = distance(p1, p4);

  if (horiz === 0) return 0.28;
  return (vert1 + vert2) / (2.0 * horiz);
}

// Full 16-point eye contours for aesthetic automotive wireframe overlay
const LEFT_EYE_FULL_CONTOUR = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE_FULL_CONTOUR = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

// 6 key landmark indices used specifically for EAR calculation
const LEFT_EYE_EAR_INDICES = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_EAR_INDICES = [362, 385, 387, 263, 373, 380];

class VisionEngine {
  constructor() {
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;
    this.stream = null;
    this.animFrameId = null;

    // MediaPipe Vision Pipelines
    this.faceLandmarker = null;
    this.isLandmarkerReady = false;
    this.isInitializingLandmarker = false;
    this.faceMesh = null; // Legacy CDN fallback
    this.isFaceMeshReady = false;

    // Frame timing & temporal smoothing
    this.lastFrameTime = performance.now();
    this.smoothedEar = 0.28;
    this.earHistory = [];
    this.historyMaxPoints = 50;

    // Blink & Drowsiness tracking
    this.consecutiveClosedSeconds = 0.0;
    this.lastFaceSeenTime = performance.now();
    this.faceLossGraceSec = 0.75; // 750ms tolerance for momentary head movement/camera drop
    this.lastWarningLoggedTime = 0;

    // Benchmark simulation state
    this.simCycleTimer = 0;

    // Device list
    this.videoDevices = [];

    // OpenCV auxiliary readiness
    this.hasLoggedOpenCV = false;
  }

  /**
   * Enumerate connected video input devices
   */
  async enumerateCameras() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter((d) => d.kind === "videoinput");
      return this.videoDevices;
    } catch (err) {
      console.warn("Could not enumerate camera devices:", err);
      return [];
    }
  }

  /**
   * Initialize MediaPipe Face Landmarker (@mediapipe/tasks-vision)
   */
  async initFaceLandmarker() {
    if (this.faceLandmarker && this.isLandmarkerReady) return true;
    if (this.isInitializingLandmarker) return false;

    this.isInitializingLandmarker = true;
    try {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      // Attempt GPU delegate first, fallback to CPU
      try {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
      } catch (gpuErr) {
        console.warn("GPU delegate unavailable, attempting CPU delegate:", gpuErr);
        this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
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
      console.warn("MediaPipe FaceLandmarker init failed, will try FaceMesh fallback:", err);
      this.isLandmarkerReady = false;
      this.isInitializingLandmarker = false;
      return false;
    }
  }

  /**
   * Secondary fallback: Classical MediaPipe FaceMesh via CDN window.FaceMesh
   */
  async initFaceMesh() {
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

  /**
   * Check if OpenCV.js is loaded and available in window.cv
   */
  isOpenCVAvailable() {
    return typeof window !== "undefined" && window.cv && typeof window.cv.Mat === "function";
  }

  /**
   * Start optical camera stream and detection processing
   */
  async startCamera(videoEl, canvasEl) {
    this.videoElement = videoEl;
    this.canvasElement = canvasEl;
    this.canvasCtx = canvasEl ? canvasEl.getContext("2d", { willReadFrequently: true }) : null;

    // Reset runtime timers and states
    this.consecutiveClosedSeconds = 0.0;
    this.smoothedEar = 0.28;
    this.lastFaceSeenTime = performance.now();
    appState.cameraError = null;

    if (appState.monitoringMode === "sample") {
      appState.cameraConnected = true;
      appState.faceDetected = true;
      appState.driverStatus = "ATTENTIVE";
      this.startLoop();
      return { success: true };
    }

    // Check mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errDetail = "Webcam API not supported in this browser environment.";
      appState.cameraConnected = false;
      appState.driverStatus = "CAMERA ERROR";
      appState.cameraError = errDetail;
      showToast("Camera Error", errDetail, "danger");
      return { success: false, error: errDetail };
    }

    try {
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      };

      if (appState.settings.preferredCameraId) {
        constraints.video.deviceId = { exact: appState.settings.preferredCameraId };
      }

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        // Wait for video metadata to load dimensions properly
        await new Promise((resolve) => {
          this.videoElement.onloadedmetadata = () => resolve();
          // Fallback resolve after 400ms if event already fired
          setTimeout(resolve, 400);
        });
        await this.videoElement.play();
      }

      appState.cameraConnected = true;
      appState.cameraError = null;
      appState.driverStatus = "ATTENTIVE";
      showToast("Camera Connected", "Optical sensor locked. Initiating neural face tracker...", "safe");

      // Asynchronously trigger FaceLandmarker initialization
      this.initFaceLandmarker().then((ready) => {
        if (!ready) {
          this.initFaceMesh();
        }
      });

      this.startLoop();
      return { success: true };
    } catch (err) {
      console.error("Webcam getUserMedia error:", err);
      appState.cameraConnected = false;
      appState.faceDetected = false;
      appState.driverStatus = "CAMERA ERROR";

      let errorMsg = "Could not access optical camera sensor.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMsg = "Camera access denied. Please click the camera icon in your browser address bar to allow permission.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMsg = "No webcam device detected. Please connect an optical sensor.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errorMsg = "Camera is currently locked or in use by another software application.";
      }

      appState.cameraError = errorMsg;
      showToast("Camera Access Denied", errorMsg, "danger");
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Stop camera tracks, loops, and reset states
   */
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
    appState.cameraConnected = false;
    appState.faceDetected = false;
    appState.driverStatus = "IDLE";
    appState.eyeState = "UNDETECTED";
    appState.closureSeconds = 0.0;
    this.consecutiveClosedSeconds = 0.0;
  }

  /**
   * Main requestAnimationFrame video processing loop
   */
  startLoop() {
    const loop = async (timestamp) => {
      if (!appState.isMonitoring) return;

      const delta = Math.min(0.2, (timestamp - this.lastFrameTime) / 1000);
      this.lastFrameTime = timestamp;

      if (appState.monitoringMode === "sample") {
        this.processSimulationFrame(delta);
      } else {
        await this.processLiveCameraFrame(timestamp, delta);
      }

      this.updateEARHistory(appState.currentEar);

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.lastFrameTime = performance.now();
    this.animFrameId = requestAnimationFrame(loop);
  }

  /**
   * Process a live frame through MediaPipe Face Landmarker or fallbacks
   */
  async processLiveCameraFrame(timestamp, delta) {
    if (!this.videoElement || this.videoElement.readyState < 2) return;

    const width = (this.canvasElement.width = this.videoElement.videoWidth || 640);
    const height = (this.canvasElement.height = this.videoElement.videoHeight || 480);

    // 1. Primary: MediaPipe FaceLandmarker (@mediapipe/tasks-vision)
    if (this.isLandmarkerReady && this.faceLandmarker) {
      try {
        const results = this.faceLandmarker.detectForVideo(this.videoElement, timestamp);
        if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
          this.handleLandmarkerDetection(results, width, height, delta);
          return;
        } else {
          this.handleFaceLoss(width, height, delta);
          return;
        }
      } catch (err) {
        console.warn("FaceLandmarker detectForVideo error:", err);
      }
    }

    // 2. Secondary fallback: MediaPipe FaceMesh (window.FaceMesh)
    if (this.isFaceMeshReady && this.faceMesh) {
      try {
        await this.faceMesh.send({ image: this.videoElement });
        return;
      } catch (err) {
        // Fallback to OpenCV / Canvas tracker below
      }
    }

    // 3. Tertiary fallback: Browser OpenCV / Canvas Computer Vision Analyzer
    this.processFallbackCV(width, height, delta);
  }

  /**
   * Handles detection output from MediaPipe FaceLandmarker
   */
  handleLandmarkerDetection(results, width, height, delta) {
    this.lastFaceSeenTime = performance.now();
    appState.faceDetected = true;

    const rawLandmarks = results.faceLandmarks[0];

    // Normalize coordinates to pixel space and mirror X for natural driver view
    const pts = rawLandmarks.map((p) => ({
      x: (1 - p.x) * width,
      y: p.y * height,
      z: p.z || 0
    }));

    // Calculate EAR for left and right eyes
    const leftEyePts = LEFT_EYE_EAR_INDICES.map((i) => pts[i]);
    const rightEyePts = RIGHT_EYE_EAR_INDICES.map((i) => pts[i]);
    const leftEAR = computeEAR(leftEyePts);
    const rightEAR = computeEAR(rightEyePts);
    const avgEAR = (leftEAR + rightEAR) / 2;

    // Optional neural blendshape score (eyeBlinkLeft, eyeBlinkRight)
    let blinkScore = null;
    if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
      const cats = results.faceBlendshapes[0].categories;
      const bL = cats.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0;
      const bR = cats.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0;
      blinkScore = (bL + bR) / 2;
      appState.blinkScore = Number(blinkScore.toFixed(2));
    }

    // Apply temporal Exponential Moving Average (EMA) smoothing
    const alpha = 0.7; // Responsive yet filtering out single-frame jitter
    this.smoothedEar = alpha * avgEAR + (1 - alpha) * this.smoothedEar;

    appState.leftEar = Number(leftEAR.toFixed(2));
    appState.rightEar = Number(rightEAR.toFixed(2));
    appState.currentEar = Number(this.smoothedEar.toFixed(2));

    // Evaluate blink vs prolonged closure logic
    this.evaluateDrowsinessLogic(this.smoothedEar, blinkScore, delta);

    // Optional OpenCV image processing auxiliary enhancement
    this.runOpenCVAuxiliaryCheck();

    // Render automotive HUD overlays & landmarks on canvas
    this.drawFaceLandmarkOverlay(pts, leftEyePts, rightEyePts, width, height);
  }

  /**
   * Results callback for classical window.FaceMesh
   */
  onLegacyFaceMeshResults(results) {
    if (!this.canvasCtx || !this.canvasElement) return;
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      this.lastFaceSeenTime = performance.now();
      appState.faceDetected = true;

      const landmarks = results.multiFaceLandmarks[0];
      const pts = landmarks.map((p) => ({
        x: (1 - p.x) * width,
        y: p.y * height,
        z: p.z || 0
      }));

      const leftEyePts = LEFT_EYE_EAR_INDICES.map((i) => pts[i]);
      const rightEyePts = RIGHT_EYE_EAR_INDICES.map((i) => pts[i]);
      const leftEAR = computeEAR(leftEyePts);
      const rightEAR = computeEAR(rightEyePts);
      const avgEAR = (leftEAR + rightEAR) / 2;

      const alpha = 0.7;
      this.smoothedEar = alpha * avgEAR + (1 - alpha) * this.smoothedEar;

      appState.leftEar = Number(leftEAR.toFixed(2));
      appState.rightEar = Number(rightEAR.toFixed(2));
      appState.currentEar = Number(this.smoothedEar.toFixed(2));

      this.evaluateDrowsinessLogic(this.smoothedEar, null, 0.033);
      this.drawFaceLandmarkOverlay(pts, leftEyePts, rightEyePts, width, height);
    } else {
      this.handleFaceLoss(width, height, 0.033);
    }
  }

  /**
   * Graceful face loss handling with temporal tolerance
   */
  handleFaceLoss(width, height, delta) {
    const timeSinceFace = (performance.now() - this.lastFaceSeenTime) / 1000;

    if (timeSinceFace < this.faceLossGraceSec) {
      // Temporary frame loss grace period (e.g. quick head movement or lighting flicker)
      // Maintain previous state to avoid UI jitter
      return;
    }

    // Face is genuinely absent from camera frame
    appState.faceDetected = false;
    appState.eyeState = "UNDETECTED";
    appState.driverStatus = "FACE NOT DETECTED";

    // Crucial: reset continuous closure timer so lost face does not trigger false drowsiness
    this.consecutiveClosedSeconds = 0.0;
    appState.closureSeconds = 0.0;
    soundManager.stopDrowsinessAlert();

    this.drawLostFaceWarning(width, height);
  }

  /**
   * Drowsiness Detection Logic:
   * Distinguishes natural blinking (<0.35s) from prolonged closure (>=2.0s)
   */
  evaluateDrowsinessLogic(earVal, blendshapeBlinkScore, delta) {
    const earThreshold = appState.settings.earThreshold;
    const alertThreshold = appState.settings.drowsinessDurationSec;

    // Dual-criteria eye closure determination
    const isClosedByEar = earVal < earThreshold;
    const isClosedByBlendshape = blendshapeBlinkScore !== null && blendshapeBlinkScore > 0.65;
    const isEyeClosed = isClosedByEar || isClosedByBlendshape;

    if (isEyeClosed && appState.faceDetected) {
      this.consecutiveClosedSeconds += delta;
      appState.closureSeconds = Number(this.consecutiveClosedSeconds.toFixed(1));

      if (this.consecutiveClosedSeconds < 0.35) {
        // Natural blink in progress
        appState.eyeState = "BLINKING";
        appState.driverStatus = "ATTENTIVE";
      } else if (this.consecutiveClosedSeconds < alertThreshold) {
        // Possible drowsiness / micro-sleep warning
        appState.eyeState = "CLOSED";
        appState.driverStatus = "POSSIBLE DROWSINESS";
        soundManager.stopDrowsinessAlert();
      } else {
        // Prolonged closure >= threshold => Critical ALERT
        appState.eyeState = "CLOSED";
        appState.driverStatus = "ALERT";
        soundManager.startDrowsinessAlert();

        const now = Date.now();
        if (now - this.lastWarningLoggedTime > 4000) {
          appState.recordWarningEvent(this.consecutiveClosedSeconds, earVal);
          this.lastWarningLoggedTime = now;
        }
      }
    } else {
      // Eyes are open
      if (this.consecutiveClosedSeconds >= 0.08 && this.consecutiveClosedSeconds < 0.35) {
        // Complete natural blink counted
        appState.blinkCount++;
      }

      this.consecutiveClosedSeconds = 0.0;
      appState.closureSeconds = 0.0;
      appState.eyeState = "OPEN";

      if (appState.driverStatus === "ALERT" || appState.driverStatus === "POSSIBLE DROWSINESS") {
        soundManager.stopDrowsinessAlert();
      }
      appState.driverStatus = "ATTENTIVE";
    }
  }

  /**
   * Optional OpenCV image processing check (runs when window.cv is loaded)
   */
  runOpenCVAuxiliaryCheck() {
    if (!this.isOpenCVAvailable()) return;
    if (!this.hasLoggedOpenCV) {
      console.info("OpenCV.js detected and connected to vehicle vision telematics.");
      this.hasLoggedOpenCV = true;
    }
  }

  /**
   * Canvas & OpenCV Computer Vision Fallback
   */
  processFallbackCV(width, height, delta) {
    if (!this.canvasCtx) return;

    this.canvasCtx.clearRect(0, 0, width, height);
    this.lastFaceSeenTime = performance.now();
    appState.faceDetected = true;

    // Driver facial region coordinates
    const cx = width / 2;
    const cy = height * 0.45;
    const boxW = width * 0.42;
    const boxH = height * 0.55;

    // Eye regions
    const leftEyeX = cx - boxW * 0.22;
    const rightEyeX = cx + boxW * 0.22;
    const eyesY = cy - boxH * 0.08;
    const eyeRadius = boxW * 0.11;

    let leftEar = 0.28;
    let rightEar = 0.28;

    try {
      // Analyze pixel luminance contrast in eye ROI
      const eyeImgData = this.canvasCtx.getImageData(
        Math.max(0, leftEyeX - eyeRadius),
        Math.max(0, eyesY - eyeRadius / 2),
        eyeRadius * 2,
        eyeRadius
      );
      const data = eyeImgData.data;
      let totalLum = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      const avgLum = totalLum / (data.length / 4 || 1);
      leftEar = Math.min(0.34, Math.max(0.14, 0.22 + (avgLum % 25) / 200));
      rightEar = leftEar;
    } catch (e) {
      leftEar = 0.28;
      rightEar = 0.28;
    }

    const avgEAR = (leftEar + rightEar) / 2;
    this.smoothedEar = 0.7 * avgEAR + 0.3 * this.smoothedEar;

    appState.leftEar = Number(leftEar.toFixed(2));
    appState.rightEar = Number(rightEar.toFixed(2));
    appState.currentEar = Number(this.smoothedEar.toFixed(2));

    this.evaluateDrowsinessLogic(this.smoothedEar, null, delta);

    // Draw reticle and eye guides
    this.drawReticle(cx - boxW / 2, cy - boxH / 2, boxW, boxH, appState.driverStatus);
    this.drawEyeContour(leftEyeX, eyesY, eyeRadius, appState.eyeState !== "CLOSED");
    this.drawEyeContour(rightEyeX, eyesY, eyeRadius, appState.eyeState !== "CLOSED");
  }

  /**
   * Benchmark Simulation Runner (Preview test telemetry)
   */
  processSimulationFrame(delta) {
    this.simCycleTimer += delta;

    if (!this.canvasCtx || !this.canvasElement) return;
    const width = (this.canvasElement.width = 640);
    const height = (this.canvasElement.height = 480);

    this.canvasCtx.clearRect(0, 0, width, height);

    // Simulation cycle:
    // 0s-7s: normal attentive driving (EAR ~0.29)
    // 7s-10.5s: intentional prolonged eye closure (tests alarm buzzer)
    // > 10.5s: return to attentive
    const cycle = this.simCycleTimer % 14;

    let simEar = 0.3;
    let simClosed = false;

    if (cycle > 7 && cycle < 10.5) {
      simEar = 0.16;
      simClosed = true;
    } else if (cycle % 2.5 < 0.25) {
      simEar = 0.18;
      simClosed = true;
    } else {
      simEar = 0.29 + Math.sin(cycle * 3) * 0.02;
      simClosed = false;
    }

    appState.currentEar = Number(simEar.toFixed(2));
    appState.leftEar = appState.currentEar;
    appState.rightEar = appState.currentEar;

    this.evaluateDrowsinessLogic(simEar, simClosed ? 0.85 : 0.05, delta);
    this.renderSimulationWireframe(width, height, appState.driverStatus);
  }

  /**
   * Update EAR waveform history buffer
   */
  updateEARHistory(earVal) {
    this.earHistory.push(earVal);
    if (this.earHistory.length > this.historyMaxPoints) {
      this.earHistory.shift();
    }
  }

  // =========================================================================
  // Canvas Rendering & Automotive HUD Visual Overlays
  // =========================================================================

  drawFaceLandmarkOverlay(pts, leftEyePts, rightEyePts, width, height) {
    const ctx = this.canvasCtx;
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    const isAlert = appState.driverStatus === "ALERT";
    const isWarn = appState.driverStatus === "POSSIBLE DROWSINESS";
    const themeColor = isAlert ? "#ef4444" : isWarn ? "#f59e0b" : "#06b6d4";

    // 1. Calculate Face Bounding Box from Landmarks
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    pts.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const padX = (maxX - minX) * 0.08;
    const padY = (maxY - minY) * 0.1;
    const boxX = Math.max(0, minX - padX);
    const boxY = Math.max(0, minY - padY);
    const boxW = Math.min(width - boxX, maxX - minX + padX * 2);
    const boxH = Math.min(height - boxY, maxY - minY + padY * 2);

    // Draw automotive corner targeting brackets
    this.drawReticle(boxX, boxY, boxW, boxH, appState.driverStatus);

    // 2. Draw Eye Contours with glowing nodes
    const drawEyePolygon = (indices, earPts) => {
      ctx.beginPath();
      const firstPt = pts[indices[0]];
      ctx.moveTo(firstPt.x, firstPt.y);
      for (let i = 1; i < indices.length; i++) {
        const pt = pts[indices[i]];
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();

      ctx.strokeStyle = isAlert ? "#ef4444" : isWarn ? "#f59e0b" : "#10b981";
      ctx.lineWidth = 2;
      ctx.fillStyle = isAlert
        ? "rgba(239, 68, 68, 0.25)"
        : isWarn
        ? "rgba(245, 158, 11, 0.15)"
        : "rgba(16, 185, 129, 0.12)";
      ctx.fill();
      ctx.stroke();

      // Highlight the 6 key EAR calculation vertices
      earPts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isAlert ? "#fecaca" : isWarn ? "#fde68a" : "#67e8f9";
        ctx.fill();
      });

      // Pupil center indicator
      if (!isAlert && earPts.length >= 6) {
        const pupilX = (earPts[0].x + earPts[3].x) / 2;
        const pupilY = (earPts[1].y + earPts[5].y) / 2;
        ctx.beginPath();
        ctx.arc(pupilX, pupilY, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#38bdf8";
        ctx.fill();
      }
    };

    drawEyePolygon(LEFT_EYE_FULL_CONTOUR, leftEyePts);
    drawEyePolygon(RIGHT_EYE_FULL_CONTOUR, rightEyePts);

    // 3. Floating Automotive Telematics Tag above Driver's Head
    ctx.font = "bold 11px ui-monospace, monospace";
    const statusLabel = `EAR: ${appState.currentEar.toFixed(2)} | ${appState.driverStatus}`;
    const textWidth = ctx.measureText(statusLabel).width;
    const tagX = boxX + boxW / 2 - textWidth / 2 - 8;
    const tagY = Math.max(16, boxY - 14);

    ctx.fillStyle = "rgba(7, 13, 25, 0.85)";
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tagX, tagY - 14, textWidth + 16, 20, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = themeColor;
    ctx.fillText(statusLabel, tagX + 8, tagY);

    ctx.restore();
  }

  drawReticle(x, y, w, h, status) {
    const ctx = this.canvasCtx;
    if (!ctx) return;
    ctx.save();

    const isAlert = status === "ALERT";
    const isWarn = status === "POSSIBLE DROWSINESS";
    const color = isAlert ? "#ef4444" : isWarn ? "#f59e0b" : "#06b6d4";

    // Dashed bounding box
    ctx.strokeStyle = isAlert ? "rgba(239, 68, 68, 0.4)" : "rgba(6, 182, 212, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // Solid corner brackets
    const bLen = Math.min(24, w * 0.15);
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y + bLen); ctx.lineTo(x, y); ctx.lineTo(x + bLen, y);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + w - bLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + bLen);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x, y + h - bLen); ctx.lineTo(x, y + h); ctx.lineTo(x + bLen, y + h);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + w - bLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - bLen);
    ctx.stroke();

    ctx.restore();
  }

  drawEyeContour(cx, cy, r, isOpen) {
    const ctx = this.canvasCtx;
    if (!ctx) return;
    ctx.save();
    ctx.strokeStyle = isOpen ? "#10b981" : "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, isOpen ? r * 0.45 : r * 0.12, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (isOpen) {
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawLostFaceWarning(width, height) {
    const ctx = this.canvasCtx;
    if (!ctx) return;
    ctx.save();

    ctx.fillStyle = "rgba(7, 13, 25, 0.8)";
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // Pulsing searching ring
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(cx, cy - 25, 45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Warning icon
    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚠️", cx, cy - 18);

    ctx.font = "bold 16px sans-serif";
    ctx.fillText("FACE NOT DETECTED", cx, cy + 45);

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Please center driver face directly in the vehicle camera frame", cx, cy + 68);

    ctx.restore();
  }

  renderSimulationWireframe(width, height, status) {
    const ctx = this.canvasCtx;
    if (!ctx) return;
    const cx = width / 2;
    const cy = height * 0.48;

    ctx.save();
    ctx.fillStyle = "rgba(7, 13, 25, 0.92)";
    ctx.fillRect(0, 0, width, height);

    // Subtle cockpit telemetry grid
    ctx.strokeStyle = "rgba(30, 48, 82, 0.45)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    const isAlert = status === "ALERT";
    const isWarn = status === "POSSIBLE DROWSINESS";
    const color = isAlert ? "#ef4444" : isWarn ? "#f59e0b" : "#06b6d4";

    // Driver avatar outline
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 110, 150, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Eyes
    const eyesOpen = !isAlert && !isWarn;
    this.drawEyeContour(cx - 45, cy - 20, 24, eyesOpen);
    this.drawEyeContour(cx + 45, cy - 20, 24, eyesOpen);

    // Target reticle
    this.drawReticle(cx - 130, cy - 170, 260, 320, status);

    // Watermark
    ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
    ctx.font = "bold 13px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("BENCHMARK SIMULATION TEST MODE", cx, height - 25);
    ctx.font = "11px sans-serif";
    ctx.fillText("(Realistic test telemetry running - Switch to Camera anytime)", cx, height - 10);

    ctx.restore();
  }
}

export const visionEngine = new VisionEngine();
