/* ==========================================================================
   COMPUTER VISION & EYE-CLOSURE DETECTION ENGINE
   MediaPipe Face Landmarker with real-time Eye Aspect Ratio (EAR) tracking
   ========================================================================== */

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { appState } from "./state.js";
import { soundManager } from "./audio.js";
import { showToast } from "./utils.js";

// Euclidean distance between 2D points
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

// 16-point eye contours for subtle overlay
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
    this.isStartingCamera = false;
    this.faceMesh = null; // CDN fallback
    this.isFaceMeshReady = false;

    // Temporal smoothing
    this.lastFrameTime = performance.now();
    this.smoothedEar = 0.28;

    // Duration trackers
    this.consecutiveClosedSeconds = 0.0;
    this.lastFaceSeenTime = performance.now();
    this.faceLossGraceSec = 0.6; // 600ms tolerance for momentary head movement

    // Incident latch to record ONE event per sustained closure
    this.closureIncidentActive = false;

    // Device list
    this.videoDevices = [];
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
   * Start optical camera stream and detection processing
   */
  async startCamera(videoEl, canvasEl) {
    if (this.isStartingCamera) {
      return { success: false, error: "Camera initialization already in progress." };
    }
    this.isStartingCamera = true;

    this.videoElement = videoEl;
    this.canvasElement = canvasEl;
    this.canvasCtx = canvasEl ? canvasEl.getContext("2d", { willReadFrequently: true }) : null;

    // Reset runtime timers and states
    this.consecutiveClosedSeconds = 0.0;
    this.closureIncidentActive = false;
    this.smoothedEar = 0.28;
    this.lastFaceSeenTime = performance.now();
    appState.cameraError = null;

    // Initialize Web Audio early on user gesture
    soundManager.initContext();

    // Check mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.isStartingCamera = false;
      const errDetail = "Camera API is not supported in this browser environment.";
      appState.cameraConnected = false;
      appState.driverStatus = "Unable to Assess";
      appState.eyeState = "Unable to Assess";
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
        await new Promise((resolve) => {
          this.videoElement.onloadedmetadata = () => resolve();
          setTimeout(resolve, 400);
        });
        await this.videoElement.play();
      }

      appState.cameraConnected = true;
      appState.cameraError = null;
      appState.driverStatus = "Unable to Assess"; // Will turn "Alert" once face and eyes are detected
      appState.eyeState = "Unable to Assess";

      this.initFaceLandmarker().then((ready) => {
        if (!ready) {
          this.initFaceMesh();
        }
      });

      this.startLoop();
      return { success: true };
    } catch (err) {
      console.error("Camera access error:", err);
      appState.cameraConnected = false;
      appState.faceDetected = false;
      appState.driverStatus = "Unable to Assess";
      appState.eyeState = "Unable to Assess";

      let errorMsg = "Could not access camera.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMsg = "Camera access was denied. Please allow camera permissions in your browser.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMsg = "No camera found. Please connect a webcam.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errorMsg = "Camera is in use by another application.";
      }

      appState.cameraError = errorMsg;
      showToast("Camera Notice", errorMsg, "danger");
      return { success: false, error: errorMsg };
    } finally {
      this.isStartingCamera = false;
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
    appState.driverStatus = "Unable to Assess";
    appState.eyeState = "Unable to Assess";
    appState.closureSeconds = 0.0;
    this.consecutiveClosedSeconds = 0.0;
    this.closureIncidentActive = false;
  }

  /**
   * Main requestAnimationFrame video processing loop
   */
  startLoop() {
    const loop = async (timestamp) => {
      if (!appState.isMonitoring) return;

      const delta = Math.min(0.2, (timestamp - this.lastFrameTime) / 1000);
      this.lastFrameTime = timestamp;

      // Handle Paused state gracefully
      if (appState.isPaused) {
        soundManager.stopDrowsinessAlert();
        this.drawPausedOverlay();
        this.animFrameId = requestAnimationFrame(loop);
        return;
      }

      await this.processLiveCameraFrame(timestamp, delta);
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
        console.warn("FaceLandmarker detect error:", err);
      }
    }

    // 2. Secondary fallback: MediaPipe FaceMesh (window.FaceMesh)
    if (this.isFaceMeshReady && this.faceMesh) {
      try {
        await this.faceMesh.send({ image: this.videoElement });
        return;
      } catch (err) {
        // Fallback to Canvas CV below
      }
    }

    // 3. Tertiary fallback: Canvas Computer Vision
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

    // Eye Aspect Ratio (EAR)
    const leftEyePts = LEFT_EYE_EAR_INDICES.map((i) => pts[i]);
    const rightEyePts = RIGHT_EYE_EAR_INDICES.map((i) => pts[i]);
    const leftEAR = computeEAR(leftEyePts);
    const rightEAR = computeEAR(rightEyePts);
    const avgEAR = (leftEAR + rightEAR) / 2;

    // Optional neural blendshape score
    let blinkScore = null;
    if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
      const cats = results.faceBlendshapes[0].categories;
      const bL = cats.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0;
      const bR = cats.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0;
      blinkScore = (bL + bR) / 2;
    }

    // Temporal smoothing on EAR
    const alphaEar = 0.70;
    this.smoothedEar = alphaEar * avgEAR + (1 - alphaEar) * this.smoothedEar;
    appState.currentEar = Number(this.smoothedEar.toFixed(2));

    // Core Drowsiness Logic
    this.evaluateDrowsinessLogic(this.smoothedEar, blinkScore, delta);

    // Render subtle visual indicators on canvas
    this.drawSubtleOverlay(pts, leftEyePts, rightEyePts, width, height);
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

      this.smoothedEar = 0.7 * avgEAR + 0.3 * this.smoothedEar;
      appState.currentEar = Number(this.smoothedEar.toFixed(2));

      this.evaluateDrowsinessLogic(this.smoothedEar, null, 0.033);
      this.drawSubtleOverlay(pts, leftEyePts, rightEyePts, width, height);
    } else {
      this.handleFaceLoss(width, height, 0.033);
    }
  }

  /**
   * Graceful face loss handling
   */
  handleFaceLoss(width, height, delta) {
    const timeSinceFace = (performance.now() - this.lastFaceSeenTime) / 1000;

    if (timeSinceFace < this.faceLossGraceSec) {
      return;
    }

    // Face is genuinely absent from camera frame
    appState.faceDetected = false;
    appState.eyeState = "Unable to Assess";
    appState.driverStatus = "Unable to Assess";
    appState.activeWarningType = "";

    // Reset continuous closure timer so lost face does not trigger false drowsiness
    this.consecutiveClosedSeconds = 0.0;
    this.closureIncidentActive = false;
    appState.closureSeconds = 0.0;
    soundManager.stopDrowsinessAlert();

    this.drawFaceLostNotice(width, height);
  }

  /**
   * Core Drowsiness Evaluation Logic
   * Evaluates eye closure using EAR and blendshape scores
   */
  evaluateDrowsinessLogic(earVal, blendshapeBlinkScore, delta) {
    const earThreshold = appState.settings.earThreshold;
    const alertThreshold = appState.settings.drowsinessDurationSec;

    const isClosedByEar = earVal < earThreshold;
    const isClosedByBlendshape = blendshapeBlinkScore !== null && blendshapeBlinkScore > 0.65;
    const isEyeClosed = isClosedByEar || isClosedByBlendshape;

    if (isEyeClosed && appState.faceDetected) {
      this.consecutiveClosedSeconds += delta;
      appState.closureSeconds = Number(this.consecutiveClosedSeconds.toFixed(1));

      if (this.consecutiveClosedSeconds >= alertThreshold) {
        // Prolonged Eye Closure detected! Active warning and audible alarm
        appState.driverStatus = "Possible Drowsiness";
        appState.eyeState = "Eyes Closed";
        appState.activeWarningType = "PROLONGED EYE CLOSURE";
        soundManager.startDrowsinessAlert(appState.activeWarningType);

        if (!this.closureIncidentActive) {
          this.closureIncidentActive = true;
          appState.recordWarningEvent({
            typeLabel: "Prolonged Eye Closure",
            duration: this.consecutiveClosedSeconds
          });
        }
      } else if (this.consecutiveClosedSeconds >= 0.35) {
        // Possible drowsiness / eyes starting to close longer than a blink
        appState.driverStatus = "Possible Drowsiness";
        appState.eyeState = "Eyes Closed";
        appState.activeWarningType = "";
        soundManager.stopDrowsinessAlert();
      } else {
        // Momentary blink
        appState.driverStatus = "Alert";
        appState.eyeState = "Eyes Closed";
        appState.activeWarningType = "";
        soundManager.stopDrowsinessAlert();
      }
    } else {
      // Eyes are open and face is detected
      this.consecutiveClosedSeconds = 0.0;
      appState.closureSeconds = 0.0;
      this.closureIncidentActive = false;
      appState.driverStatus = "Alert";
      appState.eyeState = "Eyes Detected";
      appState.activeWarningType = "";
      soundManager.stopDrowsinessAlert();
    }
  }

  /**
   * Canvas Computer Vision Fallback
   */
  processFallbackCV(width, height, delta) {
    if (!this.canvasCtx) return;

    this.canvasCtx.clearRect(0, 0, width, height);
    this.lastFaceSeenTime = performance.now();
    appState.faceDetected = true;

    const cx = width / 2;
    const cy = height * 0.45;
    const boxW = width * 0.42;
    const boxH = height * 0.55;

    const leftEyeX = cx - boxW * 0.22;
    const rightEyeX = cx + boxW * 0.22;
    const eyesY = cy - boxH * 0.08;
    const eyeRadius = boxW * 0.11;

    let leftEar = 0.28;
    let rightEar = 0.28;

    try {
      const eyeImgData = this.canvasCtx.getImageData(
        Math.max(0, leftEyeX - eyeRadius),
        Math.max(0, eyesY - eyeRadius / 2),
        eyeRadius * 2,
        eyeRadius
      );
      const data = eyeImgData.data;
      let darkCount = 0;
      let totalCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (lum < 55) darkCount++;
        totalCount++;
      }
      const darkRatio = totalCount > 0 ? darkCount / totalCount : 0.2;
      leftEar = rightEar = darkRatio < 0.05 ? 0.16 : 0.28;
    } catch (e) {
      leftEar = rightEar = 0.28;
    }

    const avgEar = (leftEar + rightEar) / 2;
    this.smoothedEar = 0.7 * avgEar + 0.3 * this.smoothedEar;
    appState.currentEar = Number(this.smoothedEar.toFixed(2));

    this.evaluateDrowsinessLogic(this.smoothedEar, null, delta);

    // Draw simple frame outline
    this.drawSimpleReticle(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
  }

  // =========================================================================
  // Clean, Subtle Visual Overlays on Canvas
  // =========================================================================

  drawSubtleOverlay(pts, leftEyePts, rightEyePts, width, height) {
    const ctx = this.canvasCtx;
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    const isDrowsy = appState.activeWarningType !== "";
    const isClosing = appState.driverStatus === "Possible Drowsiness";
    const statusColor = isDrowsy ? "#ef4444" : isClosing ? "#f59e0b" : "#10b981";

    // 1. Calculate Face Bounding Box
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

    const padX = (maxX - minX) * 0.06;
    const padY = (maxY - minY) * 0.08;
    const boxX = Math.max(0, minX - padX);
    const boxY = Math.max(0, minY - padY);
    const boxW = Math.min(width - boxX, maxX - minX + padX * 2);
    const boxH = Math.min(height - boxY, maxY - minY + padY * 2);

    this.drawSimpleReticle(boxX, boxY, boxW, boxH, statusColor);

    // 2. Draw Subtle Eye Contours
    const drawEye = (indices, earPts) => {
      ctx.beginPath();
      const firstPt = pts[indices[0]];
      ctx.moveTo(firstPt.x, firstPt.y);
      for (let i = 1; i < indices.length; i++) {
        const pt = pts[indices[i]];
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();

      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 1.75;
      ctx.stroke();

      // Pupil center indicator when alert
      if (!isClosing && !isDrowsy && earPts.length >= 6) {
        const pupilX = (earPts[0].x + earPts[3].x) / 2;
        const pupilY = (earPts[1].y + earPts[5].y) / 2;
        ctx.beginPath();
        ctx.arc(pupilX, pupilY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#3b82f6";
        ctx.fill();
      }
    };

    drawEye(LEFT_EYE_FULL_CONTOUR, leftEyePts);
    drawEye(RIGHT_EYE_FULL_CONTOUR, rightEyePts);

    ctx.restore();
  }

  drawSimpleReticle(x, y, w, h, color = "#10b981") {
    const ctx = this.canvasCtx;
    if (!ctx) return;
    ctx.save();

    const bLen = Math.min(20, w * 0.12);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;

    // Corner brackets only
    ctx.beginPath();
    ctx.moveTo(x, y + bLen); ctx.lineTo(x, y); ctx.lineTo(x + bLen, y);
    ctx.moveTo(x + w - bLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + bLen);
    ctx.moveTo(x, y + h - bLen); ctx.lineTo(x, y + h); ctx.lineTo(x + bLen, y + h);
    ctx.moveTo(x + w - bLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - bLen);
    ctx.stroke();

    ctx.restore();
  }

  drawFaceLostNotice(width, height) {
    const ctx = this.canvasCtx;
    if (!ctx) return;
    ctx.save();

    ctx.fillStyle = "rgba(7, 13, 25, 0.65)";
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    ctx.fillStyle = "#f59e0b";
    ctx.font = "600 15px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Unable to Assess — Face Not Detected", cx, cy);

    ctx.font = "400 12px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Please position face clearly in the camera view", cx, cy + 24);

    ctx.restore();
  }

  drawPausedOverlay() {
    const ctx = this.canvasCtx;
    if (!ctx || !this.canvasElement) return;
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;

    ctx.save();
    ctx.fillStyle = "rgba(7, 13, 25, 0.75)";
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 18px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Monitoring Paused", cx, cy);

    ctx.font = "400 13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Click Resume to continue", cx, cy + 26);

    ctx.restore();
  }
}

export const visionEngine = new VisionEngine();
