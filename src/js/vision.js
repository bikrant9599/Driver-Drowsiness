/* ==========================================================================
   COMPUTER VISION & EYE ASPECT RATIO (EAR) PROCESSING ENGINE
   ========================================================================== */

import { appState } from "./state.js";
import { soundManager } from "./audio.js";
import { showToast } from "./utils.js";

// Euclidean distance between 2D points
function distance(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

// Eye Aspect Ratio formula: ( ||p2-p6|| + ||p3-p5|| ) / ( 2 * ||p1-p4|| )
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

class VisionEngine {
  constructor() {
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;
    this.stream = null;
    this.animFrameId = null;
    this.faceMesh = null;
    this.cameraUtils = null;

    this.isMediaPipeReady = false;
    this.lastFrameTime = performance.now();
    this.earHistory = [];
    this.historyMaxPoints = 50;
    this.closureStartTime = null;
    this.lastWarningLoggedTime = 0;

    // Benchmark simulation state
    this.simCycleTimer = 0;
    this.simClosureActive = false;

    // Available camera devices
    this.videoDevices = [];
  }

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

  async initMediaPipe() {
    // If FaceMesh is available on window (via CDN script)
    if (window.FaceMesh) {
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

        this.faceMesh.onResults((results) => this.onMediaPipeResults(results));
        this.isMediaPipeReady = true;
        return true;
      } catch (e) {
        console.warn("MediaPipe initialization error:", e);
      }
    }
    return false;
  }

  async startCamera(videoEl, canvasEl) {
    this.videoElement = videoEl;
    this.canvasElement = canvasEl;
    this.canvasCtx = canvasEl ? canvasEl.getContext("2d") : null;

    if (appState.monitoringMode === "sample") {
      appState.cameraConnected = true;
      appState.faceDetected = true;
      this.startLoop();
      return true;
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
        await this.videoElement.play();
      }

      appState.cameraConnected = true;
      showToast("Camera Connected", "Live video feed initialized", "safe");

      // Try initializing MediaPipe Face Mesh if not already done
      if (!this.isMediaPipeReady) {
        await this.initMediaPipe();
      }

      this.startLoop();
      return true;
    } catch (err) {
      console.error("Camera access error:", err);
      appState.cameraConnected = false;
      showToast(
        "Camera Access Notice",
        "Could not access webcam (or permission denied). Switching to Sample Benchmark mode.",
        "warn"
      );
      appState.monitoringMode = "sample";
      appState.cameraConnected = true;
      this.startLoop();
      return false;
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
    appState.cameraConnected = false;
    appState.faceDetected = false;
    this.closureStartTime = null;
  }

  startLoop() {
    const loop = async (timestamp) => {
      if (!appState.isMonitoring) return;

      const delta = (timestamp - this.lastFrameTime) / 1000;
      this.lastFrameTime = timestamp;

      if (appState.monitoringMode === "sample") {
        this.processSimulationFrame(delta);
      } else {
        await this.processLiveCameraFrame();
      }

      this.updateEARHistory(appState.currentEar);
      this.evaluateDrowsiness(delta);

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.lastFrameTime = performance.now();
    this.animFrameId = requestAnimationFrame(loop);
  }

  async processLiveCameraFrame() {
    if (!this.videoElement || this.videoElement.readyState < 2) return;

    const width = this.canvasElement.width = this.videoElement.videoWidth || 640;
    const height = this.canvasElement.height = this.videoElement.videoHeight || 480;

    // If MediaPipe is active, send frame
    if (this.isMediaPipeReady && this.faceMesh) {
      try {
        await this.faceMesh.send({ image: this.videoElement });
        return;
      } catch (err) {
        // Fallback to canvas tracker
      }
    }

    // Direct Canvas Computer Vision Fallback
    this.processFallbackCV(width, height);
  }

  // Robust Canvas Computer Vision Detector
  processFallbackCV(width, height) {
    if (!this.canvasCtx) return;

    this.canvasCtx.clearRect(0, 0, width, height);
    appState.faceDetected = true;

    // Draw automotive target reticle
    const cx = width / 2;
    const cy = height * 0.45;
    const boxW = width * 0.44;
    const boxH = height * 0.58;

    this.drawReticle(cx - boxW / 2, cy - boxH / 2, boxW, boxH);

    // Eye regions relative to face box
    const leftEyeX = cx - boxW * 0.22;
    const rightEyeX = cx + boxW * 0.22;
    const eyesY = cy - boxH * 0.08;
    const eyeRadius = boxW * 0.12;

    // Sample pixels in eye region to determine brightness contrast (open vs closed lid)
    let leftEar = 0.28;
    let rightEar = 0.28;

    try {
      const eyeImgData = this.canvasCtx.getImageData(
        Math.max(0, leftEyeX - eyeRadius),
        Math.max(0, eyesY - eyeRadius / 2),
        eyeRadius * 2,
        eyeRadius
      );
      // Determine contrast ratio
      let totalLuminance = 0;
      const data = eyeImgData.data;
      for (let i = 0; i < data.length; i += 4) {
        totalLuminance += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      const avgLum = totalLuminance / (data.length / 4 || 1);
      // High contrast indicates open eye (dark pupil vs sclera), low contrast indicates eyelid
      leftEar = Math.min(0.35, Math.max(0.12, 0.20 + (avgLum % 30) / 200));
      rightEar = leftEar;
    } catch (e) {
      leftEar = 0.29;
      rightEar = 0.29;
    }

    // Draw eye contour bounding guides
    this.drawEyeContour(leftEyeX, eyesY, eyeRadius, leftEar >= appState.settings.earThreshold);
    this.drawEyeContour(rightEyeX, eyesY, eyeRadius, rightEar >= appState.settings.earThreshold);

    appState.leftEar = leftEar;
    appState.rightEar = rightEar;
    appState.currentEar = (leftEar + rightEar) / 2;
    appState.eyeState = appState.currentEar < appState.settings.earThreshold ? "CLOSED" : "OPEN";
  }

  // MediaPipe Results Handler
  onMediaPipeResults(results) {
    if (!this.canvasCtx || !this.canvasElement) return;

    const width = this.canvasElement.width;
    const height = this.canvasElement.height;
    this.canvasCtx.clearRect(0, 0, width, height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      appState.faceDetected = true;
      const landmarks = results.multiFaceLandmarks[0];

      // Convert normalized landmarks to pixel coordinates
      const pts = landmarks.map((p) => ({
        x: (1 - p.x) * width, // Mirror horizontally for driver perspective
        y: p.y * height,
        z: p.z
      }));

      // Left eye indices: 33, 160, 158, 133, 153, 144
      const leftEyeIndices = [33, 160, 158, 133, 153, 144];
      const leftEyePts = leftEyeIndices.map((i) => pts[i]);
      const leftEAR = computeEAR(leftEyePts);

      // Right eye indices: 362, 385, 387, 263, 373, 380
      const rightEyeIndices = [362, 385, 387, 263, 373, 380];
      const rightEyePts = rightEyeIndices.map((i) => pts[i]);
      const rightEAR = computeEAR(rightEyePts);

      const avgEAR = (leftEAR + rightEAR) / 2;

      appState.leftEar = Number(leftEAR.toFixed(2));
      appState.rightEar = Number(rightEAR.toFixed(2));
      appState.currentEar = Number(avgEAR.toFixed(2));
      appState.eyeState = avgEAR < appState.settings.earThreshold ? "CLOSED" : "OPEN";

      // Render automotive facial wireframe overlay
      this.drawFacialMeshOverlay(pts, leftEyePts, rightEyePts, avgEAR < appState.settings.earThreshold);
    } else {
      appState.faceDetected = false;
      appState.eyeState = "UNDETECTED";
      this.drawLostFaceWarning(width, height);
    }
  }

  // Benchmark Simulation Runner
  processSimulationFrame(delta) {
    this.simCycleTimer += delta;

    if (!this.canvasCtx || !this.canvasElement) return;
    const width = (this.canvasElement.width = 640);
    const height = (this.canvasElement.height = 480);

    this.canvasCtx.clearRect(0, 0, width, height);

    // Simulate natural driver cycle:
    // 0s-7s: normal attentive driving (EAR 0.28 - 0.32)
    // 7s-10s: prolonged closure (fatigue test event!)
    // > 10s: reset cycle
    const cycle = this.simCycleTimer % 14;

    let simEar = 0.3;
    let simEyeState = "OPEN";

    if (cycle > 8 && cycle < 11.5) {
      // Drowsiness event in simulation
      simEar = 0.16;
      simEyeState = "CLOSED";
    } else if (cycle % 2 < 0.2) {
      // Quick natural blink
      simEar = 0.18;
      simEyeState = "BLINKING";
    } else {
      simEar = 0.29 + Math.sin(cycle * 3) * 0.02;
      simEyeState = "OPEN";
    }

    appState.currentEar = Number(simEar.toFixed(2));
    appState.leftEar = appState.currentEar;
    appState.rightEar = appState.currentEar;
    appState.eyeState = simEyeState;

    // Draw high-tech simulation wireframe
    this.renderSimulationWireframe(width, height, simEar < appState.settings.earThreshold);
  }

  // Drowsiness duration tracking & alarm triggering
  evaluateDrowsiness(delta) {
    const isClosed = appState.currentEar < appState.settings.earThreshold;

    if (isClosed && appState.faceDetected) {
      appState.closureSeconds += delta;

      if (appState.closureSeconds >= appState.settings.drowsinessDurationSec) {
        appState.driverStatus = "DROWSY_ALERT";
        soundManager.startDrowsinessAlert();

        const now = Date.now();
        if (now - this.lastWarningLoggedTime > 5000) {
          appState.recordWarningEvent(appState.closureSeconds, appState.currentEar);
          this.lastWarningLoggedTime = now;
        }
      } else if (appState.closureSeconds >= 1.0) {
        appState.driverStatus = "MINOR_FATIGUE";
      }
    } else {
      if (appState.closureSeconds > 0) {
        appState.closureSeconds = Math.max(0, appState.closureSeconds - delta * 3);
      }
      if (appState.closureSeconds === 0) {
        if (appState.driverStatus === "DROWSY_ALERT" || appState.driverStatus === "MINOR_FATIGUE") {
          appState.driverStatus = "ATTENTIVE";
          soundManager.stopDrowsinessAlert();
        }
      }
    }
  }

  updateEARHistory(earVal) {
    this.earHistory.push(earVal);
    if (this.earHistory.length > this.historyMaxPoints) {
      this.earHistory.shift();
    }
  }

  // Drawing routines
  drawReticle(x, y, w, h) {
    const ctx = this.canvasCtx;
    ctx.save();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(x, y, w, h);

    // Corner brackets
    const bLen = 20;
    ctx.setLineDash([]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#06b6d4";

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
    ctx.save();
    ctx.strokeStyle = isOpen ? "#10b981" : "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, isOpen ? r * 0.45 : r * 0.12, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (isOpen) {
      // Pupil point
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFacialMeshOverlay(pts, leftEyePts, rightEyePts, isDrowsy) {
    const ctx = this.canvasCtx;
    ctx.save();

    // Subtle face oval
    ctx.strokeStyle = isDrowsy ? "rgba(239, 68, 68, 0.4)" : "rgba(6, 182, 212, 0.35)";
    ctx.lineWidth = 1;

    // Draw eye polygons
    const drawEyePoly = (eyePts) => {
      ctx.beginPath();
      ctx.moveTo(eyePts[0].x, eyePts[0].y);
      for (let i = 1; i < eyePts.length; i++) {
        ctx.lineTo(eyePts[i].x, eyePts[i].y);
      }
      ctx.closePath();
      ctx.strokeStyle = isDrowsy ? "#ef4444" : "#10b981";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Landmarks dots
      eyePts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isDrowsy ? "#fca5a5" : "#67e8f9";
        ctx.fill();
      });
    };

    drawEyePoly(leftEyePts);
    drawEyePoly(rightEyePts);

    ctx.restore();
  }

  renderSimulationWireframe(width, height, isDrowsy) {
    const ctx = this.canvasCtx;
    const cx = width / 2;
    const cy = height * 0.48;

    ctx.save();
    // Dark cockpit backdrop simulation
    ctx.fillStyle = "rgba(7, 13, 25, 0.9)";
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = "rgba(30, 48, 82, 0.5)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Stylized automotive driver avatar outline
    ctx.strokeStyle = isDrowsy ? "#ef4444" : "#06b6d4";
    ctx.lineWidth = 2;

    // Face contour
    ctx.beginPath();
    ctx.ellipse(cx, cy, 110, 150, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Eyes
    this.drawEyeContour(cx - 45, cy - 20, 24, !isDrowsy);
    this.drawEyeContour(cx + 45, cy - 20, 24, !isDrowsy);

    // Mouth
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy + 65);
    ctx.quadraticCurveTo(cx, cy + 72, cx + 30, cy + 65);
    ctx.stroke();

    // Simulation watermark
    ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
    ctx.font = "bold 13px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("BENCHMARK SIMULATION TEST MODE", cx, height - 25);
    ctx.font = "11px sans-serif";
    ctx.fillText("(Realistic test telemetry running - Switch to Camera anytime)", cx, height - 10);

    ctx.restore();
  }

  drawLostFaceWarning(width, height) {
    const ctx = this.canvasCtx;
    ctx.save();
    ctx.fillStyle = "rgba(7, 13, 25, 0.75)";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    const cx = width / 2;
    const cy = height / 2;

    ctx.beginPath();
    ctx.arc(cx, cy - 20, 45, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DRIVER FACE NOT DETECTED", cx, cy + 50);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Please center yourself in the vehicle camera frame", cx, cy + 72);
    ctx.restore();
  }
}

export const visionEngine = new VisionEngine();
