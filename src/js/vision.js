/* ==========================================================================
   COMPUTER VISION & EYE-CLOSURE DETECTION ENGINE
   MediaPipe Face Landmarker with real-time Eye Aspect Ratio (EAR) tracking
   ========================================================================== */

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { appState } from "./state.js";
import { soundManager } from "./audio.js";

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
  const p1 = eyeLandmarks[0];
  const p2 = eyeLandmarks[1];
  const p3 = eyeLandmarks[2];
  const p4 = eyeLandmarks[3];
  const p5 = eyeLandmarks[4];
  const p6 = eyeLandmarks[5];

  const vert1 = distance(p2, p6);
  const vert2 = distance(p3, p5);
  const horiz = distance(p1, p4);

  if (horiz === 0) return 0.28;
  return (vert1 + vert2) / (2.0 * horiz);
}

// Landmark indices for eyes
const LEFT_EYE_FULL_CONTOUR = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE_FULL_CONTOUR = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

const LEFT_EYE_EAR_INDICES = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_EAR_INDICES = [362, 385, 387, 263, 373, 380];

class VisionEngine {
  constructor() {
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;
    this.stream = null;
    this.animFrameId = null;

    this.faceLandmarker = null;
    this.isLandmarkerReady = false;
    this.isInitializingLandmarker = false;
    this.isStartingCamera = false;
    this.faceMesh = null;
    this.isFaceMeshReady = false;

    this.lastFrameTime = performance.now();
    this.smoothedEar = 0.28;
    this.consecutiveClosedSeconds = 0.0;
    this.lastFaceSeenTime = performance.now();
    this.closureIncidentActive = false;
    this.drowsinessThresholdSec = 2.0;
    this.earThreshold = 0.22;
  }

  async initFaceLandmarker() {
    if (this.faceLandmarker && this.isLandmarkerReady) return true;
    if (this.isInitializingLandmarker) return false;

    this.isInitializingLandmarker = true;
    try {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

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
      console.warn("MediaPipe FaceLandmarker init failed, using FaceMesh fallback:", err);
      this.isLandmarkerReady = false;
      this.isInitializingLandmarker = false;
      return false;
    }
  }

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

  async startCamera(videoEl, canvasEl) {
    if (this.isStartingCamera) {
      return { success: false, error: "Camera initialization in progress." };
    }
    this.isStartingCamera = true;

    this.videoElement = videoEl;
    this.canvasElement = canvasEl;
    this.canvasCtx = canvasEl ? canvasEl.getContext("2d", { willReadFrequently: true }) : null;

    this.consecutiveClosedSeconds = 0.0;
    this.closureIncidentActive = false;
    this.smoothedEar = 0.28;
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
          width: { ideal: 640 },
          height: { ideal: 480 },
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

      this.initFaceLandmarker().then((ready) => {
        if (!ready) {
          this.initFaceMesh();
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
    this.consecutiveClosedSeconds = 0.0;
    this.closureIncidentActive = false;
  }

  startLoop() {
    const loop = async (timestamp) => {
      if (!appState.isMonitoring) return;

      const delta = Math.min(0.2, (timestamp - this.lastFrameTime) / 1000);
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
          this.handleDetection(results, width, height, delta);
          return;
        } else {
          this.handleFaceLoss(width, height);
          return;
        }
      } catch (err) {
        console.warn("FaceLandmarker error:", err);
      }
    }

    // 2. Secondary: MediaPipe FaceMesh CDN
    if (this.isFaceMeshReady && this.faceMesh) {
      try {
        await this.faceMesh.send({ image: this.videoElement });
        return;
      } catch (err) {}
    }

    // 3. Fallback: Canvas Computer Vision
    this.processFallbackCV(width, height, delta);
  }

  handleDetection(results, width, height, delta) {
    this.lastFaceSeenTime = performance.now();

    const rawLandmarks = results.faceLandmarks[0];
    const pts = rawLandmarks.map((p) => ({
      x: (1 - p.x) * width,
      y: p.y * height,
      z: p.z || 0
    }));

    const leftEyePts = LEFT_EYE_EAR_INDICES.map((i) => pts[i]);
    const rightEyePts = RIGHT_EYE_EAR_INDICES.map((i) => pts[i]);
    const leftEAR = computeEAR(leftEyePts);
    const rightEAR = computeEAR(rightEyePts);
    const avgEAR = (leftEAR + rightEAR) / 2;

    let blinkScore = null;
    if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
      const cats = results.faceBlendshapes[0].categories;
      const bL = cats.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0;
      const bR = cats.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0;
      blinkScore = (bL + bR) / 2;
    }

    const alpha = 0.70;
    this.smoothedEar = alpha * avgEAR + (1 - alpha) * this.smoothedEar;

    this.evaluateDrowsiness(this.smoothedEar, blinkScore, delta);
    this.drawSubtleOverlay(pts, leftEyePts, rightEyePts, width, height);
  }

  onLegacyFaceMeshResults(results) {
    if (!this.canvasCtx || !this.canvasElement) return;
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      this.lastFaceSeenTime = performance.now();

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

      this.evaluateDrowsiness(this.smoothedEar, null, 0.033);
      this.drawSubtleOverlay(pts, leftEyePts, rightEyePts, width, height);
    } else {
      this.handleFaceLoss(width, height);
    }
  }

  handleFaceLoss(width, height) {
    const elapsedSinceFace = (performance.now() - this.lastFaceSeenTime) / 1000;
    if (elapsedSinceFace < 0.5) return; // momentary tolerance

    appState.setStatus("NO_FACE");
    this.consecutiveClosedSeconds = 0.0;
    this.closureIncidentActive = false;
    soundManager.stopDrowsinessAlert();

    if (this.canvasCtx) {
      this.canvasCtx.clearRect(0, 0, width, height);
    }
  }

  evaluateDrowsiness(earVal, blendshapeBlinkScore, delta) {
    const isClosedByEar = earVal < this.earThreshold;
    const isClosedByBlendshape = blendshapeBlinkScore !== null && blendshapeBlinkScore > 0.65;
    const isClosed = isClosedByEar || isClosedByBlendshape;

    if (isClosed) {
      this.consecutiveClosedSeconds += delta;

      if (this.consecutiveClosedSeconds >= this.drowsinessThresholdSec) {
        // Prolonged eye closure reached detection threshold
        appState.setStatus("DROWSY");
        soundManager.startDrowsinessAlert();

        if (!this.closureIncidentActive) {
          this.closureIncidentActive = true;
          appState.recordDrowsinessEvent();
        }
      } else if (this.consecutiveClosedSeconds >= 0.35) {
        // Possible drowsiness
        appState.setStatus("DROWSY");
        soundManager.stopDrowsinessAlert();
      } else {
        // Natural blink
        appState.setStatus("ALERT");
        soundManager.stopDrowsinessAlert();
      }
    } else {
      // Eyes open and face detected: user appears alert
      this.consecutiveClosedSeconds = 0.0;
      this.closureIncidentActive = false;
      appState.setStatus("ALERT");
      soundManager.stopDrowsinessAlert();
    }
  }

  processFallbackCV(width, height, delta) {
    if (!this.canvasCtx) return;
    this.canvasCtx.clearRect(0, 0, width, height);
    this.lastFaceSeenTime = performance.now();

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
    this.evaluateDrowsiness(this.smoothedEar, null, delta);
    this.drawSimpleReticle(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
  }

  drawSubtleOverlay(pts, leftEyePts, rightEyePts, width, height) {
    const ctx = this.canvasCtx;
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    const isDrowsy = appState.status === "DROWSY";
    const statusColor = isDrowsy ? "#ef4444" : "#10b981";

    // Face reticle
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

    // Eye contours
    const drawEye = (indices) => {
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
    };

    drawEye(LEFT_EYE_FULL_CONTOUR);
    drawEye(RIGHT_EYE_FULL_CONTOUR);

    ctx.restore();
  }

  drawSimpleReticle(x, y, w, h, color = "#10b981") {
    const ctx = this.canvasCtx;
    if (!ctx) return;
    ctx.save();

    const bLen = Math.min(20, w * 0.12);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;

    ctx.beginPath();
    ctx.moveTo(x, y + bLen); ctx.lineTo(x, y); ctx.lineTo(x + bLen, y);
    ctx.moveTo(x + w - bLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + bLen);
    ctx.moveTo(x, y + h - bLen); ctx.lineTo(x, y + h); ctx.lineTo(x + bLen, y + h);
    ctx.moveTo(x + w - bLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - bLen);
    ctx.stroke();

    ctx.restore();
  }
}

export const visionEngine = new VisionEngine();
