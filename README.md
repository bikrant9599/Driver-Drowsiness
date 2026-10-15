# VigilDrive AI — Driver Drowsiness Detection System

[![Automotive Safety](https://img.shields.io/badge/Telematics-Safety%20System-blue.svg)](https://github.com/bikrant9599/Driver-Drowsiness)
[![Computer Vision](https://img.shields.io/badge/Computer%20Vision-MediaPipe%20%7C%20EAR-cyan.svg)](https://github.com/bikrant9599/Driver-Drowsiness)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Zero Cloud](https://img.shields.io/badge/Privacy-100%25%20On--Device-success.svg)](https://github.com/bikrant9599/Driver-Drowsiness)

An intelligent, production-grade in-cabin automotive safety telematics web application that utilizes client-side computer vision and facial landmark analysis to monitor driver attentiveness in real time. VigilDrive AI calculates the **Eye Aspect Ratio (EAR)**, **Mouth Aspect Ratio (MAR)**, and **Head Pitch Angle** to detect prolonged eye closure, microsleeps, yawning fatigue, and head drooping, triggering instant multi-modal auditory alarms, spoken voice alerts, and visual HUD warnings.

---

## 🚗 System Architecture & Detection Pipeline

```
                     ┌───────────────────────────────┐
                     │   In-Cabin Camera / Webcam    │
                     └──────────────┬────────────────┘
                                    │ WebRTC Video Stream
                                    ▼
                     ┌───────────────────────────────┐
                     │ MediaPipe 478-Point Facial    │
                     │ Landmark 3D Mesh Engine       │
                     └──────────────┬────────────────┘
                                    │ 3D Normalized Coordinates
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────────┐
│ Eye Aspect Ratio (EAR)│ │Mouth Aspect Ratio │ │ Head Pitch Angle &    │
│ Left & Right Eye Mesh │ │(MAR) Lip Separation│ │ Nodding Trigonometry  │
└───────────┬───────────┘ └─────────┬─────────┘ └───────────┬───────────┘
            │                       │                       │
            │ EAR < Threshold       │ MAR > Threshold       │ Pitch < Threshold
            │ for >= 2.0s           │ for >= 1.8s           │ for >= 1.2s
            ▼                       ▼                       ▼
    [ PROLONGED CLOSURE ]       [ YAWN EVENT ]        [ HEAD NOD ADVISORY ]
            │                       │                       │
            └───────────────────────┼───────────────────────┘
                                    ▼
                     ┌───────────────────────────────┐
                     │ Multi-Modal Warning Protocol  │
                     ├───────────────────────────────┤
                     │ 🔊 Web Audio API Synthesizer  │
                     │ 🗣️ Speech Synthesis Voice     │
                     │ 🚨 Perimeter Red HUD Strobe   │
                     │ 📋 Telematics Audit Logger    │
                     └───────────────────────────────┘
```

### 🔬 Mathematical Formulation

#### 1. Eye Aspect Ratio (EAR)
Based on the landmark computer vision research by *Soukupová and Čech (2016)*, EAR measures vertical eye opening relative to horizontal eye width across 6 canonical landmark points per eye:

$$EAR = \frac{||p_2 - p_6|| + ||p_3 - p_5||}{2 \times ||p_1 - p_4||}$$

- **Attentive Driving**: Nominal EAR typically ranges between `0.28` and `0.35`.
- **Subconscious Blinks**: Natural blinks lasting `150ms – 300ms` are filtered out.
- **Prolonged Eye Closure / Microsleep**: EAR sustained below `0.22` (configurable) for `2.0+ seconds` initiates emergency warning protocols.

#### 2. Mouth Aspect Ratio (MAR)
Calculated using vertical inner-lip landmark separation relative to horizontal corner distance to identify deep, sustained fatigue yawns while distinguishing normal conversation.

#### 3. Head Pitch & Downward Nod Angle
Monitors the vertical vector between the nose tip and the chin relative to the eye midpoint plane to detect head nodding or forward drooping during microsleep incidents.

---

## 🌟 Main Features

1. **Hardware Webcam Computer Vision Integration**:
   - Real-time video processing directly in the browser using MediaPipe FaceLandmarker and HTML5 Canvas.
   - Automatic camera enumeration with multi-camera selector (`navigator.mediaDevices.enumerateDevices`).
   - Clean hardware release on session stop to ensure camera privacy.

2. **Optical Sensor Initialization & Guidance**:
   - Animated optical radar pulse overlay displayed while the camera stream initializes and neural models load.
   - Dynamic in-cabin lighting notice that alerts drivers if insufficient lighting, reflective eyewear, or head angle degrades detection.

3. **Multi-Modal Warning System**:
   - **Web Audio API Synthesizer**: Low-latency automotive buzzer, Mercedes-style cabin chime, or high-urgency sweep siren with adjustable volume gain.
   - **Speech Synthesis Voice Prompts**: Spoken vocal safety announcements ("Warning: Driver drowsiness detected! Pull over safely.").
   - **Visual HUD Alert**: Pulsing red perimeter alert border, floating warning badges, and live telemetry status changes.

4. **Biometric Sensitivity Calibration**:
   - Three instant sensitivity presets: **High** (0.24 EAR, 1.5s), **Balanced** (0.22 EAR, 2.0s), and **Low** (0.19 EAR, 2.5s).
   - Fine-grained range sliders for EAR threshold, closure duration, MAR threshold, yawn duration, and head nod pitch.

5. **Telematics Safety Dashboard & History**:
   - Metric overview tiles for verified session count, cumulative monitoring duration, warning incidents, and real-time sensor lock state.
   - Live EAR waveform oscilloscope charting driver vigilance over time.
   - Comprehensive event timeline detailing timestamps, incident types, closure durations, and calculated metrics.

6. **Automotive Cockpit Design & Themes**:
   - Dual theme system: Night-optimized **Dark Navy** cockpit theme to reduce driver glare and daytime **Clean Slate** theme.
   - Persistent theme memory across page refreshes.

7. **Session Audit Reports & Exports**:
   - One-click detailed **CSV** export for fleet analytics.
   - Professional automotive report generation to **PDF** (via jsPDF).
   - Interactive session inspection modal with complete event timelines.

8. **Benchmark Preview Mode**:
   - Built-in simulation suite allowing demonstration of telemetry waveforms, warning banners, audio alerts, and session exports without requiring a webcam.

9. **100% On-Device Privacy Architecture**:
   - Zero video frames or facial photographs are uploaded to external servers or written to disk.
   - Ephemeral or persistent local storage retention modes.
   - Anonymous report generation excluding hardware identifiers.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Core** | Semantic HTML5, Vanilla JavaScript (ES6+ Modules), CSS3 Design Tokens |
| **Build & Tooling** | [Vite](https://vitejs.dev/) (Fast Hot Module Replacement & production bundler) |
| **Computer Vision & AI** | [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) (478-point 3D Face Landmarker), [OpenCV.js](https://docs.opencv.org/) |
| **Audio Processing** | Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`), Web Speech Synthesis API (`window.speechSynthesis`) |
| **Document Generation** | [jsPDF](https://github.com/parallax/jsPDF) (Client-side vector PDF generation) |
| **Icons & Assets** | Handcrafted SVG Automotive Icon Suite, Local AI Telematics Art |

---

## 📦 Required Dependencies & AI Model Assets

All required runtime packages and external AI model assets are bundled or loaded locally:

- **`@mediapipe/tasks-vision`** (`^0.10.18`): Contains the Google MediaPipe WebAssembly and WebGL inference runtime.
- **MediaPipe FaceLandmarker Task Bundle**: The pre-trained neural network model (`face_landmarker.task`, ~3.5MB) is fetched on demand directly from Google's authenticated CDN over HTTPS and cached in browser memory for local WebGL execution.
- **`jspdf`** (`^2.5.2`): Bundled for generating downloadable PDF telematics logs.

---

## 🚀 Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0 or higher recommended)
- [npm](https://www.npmjs.com/) (bundled with Node.js)
- A modern web browser supporting WebRTC and Web Audio API (Google Chrome, Microsoft Edge, Mozilla Firefox, or Apple Safari)
- Built-in webcam or external USB video device

### Step-by-Step Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/bikrant9599/Driver-Drowsiness.git
   cd Driver-Drowsiness
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   *The console will output the local development URL, typically `http://localhost:5173/`.*

4. **Build production bundle**:
   ```bash
   npm run build
   ```
   *Generates an optimized, tree-shaken static production bundle in the `dist/` directory.*

5. **Preview production build locally**:
   ```bash
   npm run preview
   ```

---

## 🔑 Environment Variables

**No environment variables or API keys are required.**

VigilDrive AI is designed as a sovereign, zero-cloud client-side application. All computer vision inference, biometric calculations, audio synthesis, and report exports occur locally within the driver's browser. There are no backend database connection strings or secret third-party API tokens to configure.

---

## 📷 Camera Permissions & Hardware Configuration

When navigating to the **Live Monitoring** console (`#live`) and clicking **Start Monitoring**, your browser will request permission to access your webcam.

### Granting Permissions by Browser

- **Google Chrome / Microsoft Edge**:
  1. A permission prompt will appear: *"vigildrive wants to use your camera"*. Click **Allow**.
  2. If previously blocked, click the **Padlock / Site Settings** icon on the left side of the address bar, toggle **Camera** to **Allow**, and refresh the page.
- **Mozilla Firefox**:
  1. Click **Allow** when the permission pop-up appears. Check *"Remember this decision"* for persistent access.
  2. To manage devices, click the camera icon in the URL bar.
- **Apple Safari**:
  1. Click **Allow** when prompted.
  2. Go to **Safari > Settings > Websites > Camera** to configure default access permissions.

### Selecting a Specific Camera
If multiple video capture devices are connected (e.g. built-in laptop camera and external USB wide-angle dash camera):
1. Navigate to **Settings** (`#settings`).
2. Under **Hardware Camera Selection**, choose the desired device from the dropdown menu.
3. The preference is automatically saved to browser storage.

---

## ⚙️ How to Configure Drowsiness Detection

All detection thresholds are accessible in real-time from the **Settings** view (`#settings`):

1. **Preset Selection**:
   - **High Sensitivity**: Recommended for night driving or unlit rural highways (EAR `0.24`, duration `1.5s`).
   - **Balanced (Default)**: Recommended for standard daylight and highway commuting (EAR `0.22`, duration `2.0s`).
   - **Low Sensitivity**: Recommended for city driving or drivers with naturally narrower eye apertures (EAR `0.19`, duration `2.5s`).
2. **Custom EAR Tuning**:
   - Use the **Eye Aspect Ratio (EAR) Threshold** slider (`0.16` to `0.30`) to fine-tune eyelid closure sensitivity.
3. **Closure Duration Calibration**:
   - Adjust the **Eye-Closure Warning Duration** slider (`1.0s` to `4.0s`) to set the exact delay before triggering audible alarms.
4. **Yawning Analysis**:
   - Toggle **Enable Yawning Detection** and adjust the **Mouth Aspect Ratio (MAR)** threshold (`0.45` to `0.85`, default `0.60`) and duration (`1.0s` to `3.5s`, default `1.8s`).
5. **Head Nodding Detection**:
   - Toggle **Enable Head Position Detection** and calibrate the pitch threshold (`0.45` to `0.85`, default `0.65`) and duration (`0.8s` to `2.5s`, default `1.2s`).
6. **Alarm Sound & Volume**:
   - Toggle the master audible switch, select between `Automotive Pulsing Buzzer`, `Cabin Chime`, or `Sweep Siren`, adjust the volume gain slider (`0%` to `100%`), and click the **Preview** button to verify loudness.

---

## 🔒 Privacy & Security Architecture

VigilDrive AI was engineered from the ground up with a privacy-by-design philosophy:

- **100% On-Device Edge Computing**: Video frames are piped directly to an in-memory HTML5 Canvas and processed solely by local JavaScript/WebAssembly routines.
- **Zero Video Uploads**: No camera footage, snapshots, or biometric facial images are transmitted across the network or stored on remote servers.
- **Zero Photo Storage**: The application does not write video streams or face images to browser storage or local disk.
- **Volatile Frame Disposal**: Video frames are analyzed in transient RAM and discarded immediately after landmark extraction.
- **Configurable Data Retention**:
  - *Persistent Local Storage*: Retains numerical session history across browser restarts.
  - *Ephemeral (Session Only)*: Automatically discards all session telematics when the tab or window is closed.
- **Anonymous Session Reports**: Exported CSV and PDF files contain only numerical timestamps and calculated vigilance metrics, omitting device identifiers or personal data.

---

## ⚠️ Known Limitations

1. **In-Cabin Lighting**: Extreme low-light conditions may degrade the landmark mesh accuracy. An in-cabin notice will appear if face visibility is compromised. Utilizing ambient vehicle cockpit lighting or an IR illumination source resolves this.
2. **Dark Polarized Eyewear**: Deeply tinted sunglasses or reflective mirror lenses can obstruct optical detection of the eyelid contours. Standard clear corrective glasses and light tints operate normally.
3. **Severe Head Rotation**: MediaPipe FaceLandmarker tracks facial features up to approximately ±45° yaw. Extreme sideways head rotation facing away from the windshield will trigger a face-searching warning.
4. **Browser Autoplay Audio Restrictions**: Modern browsers prevent web pages from playing audio until the user has performed at least one click or tap on the page. The system provides an interactive banner to initialize audio context with one click.

---

## 📁 Repository Structure

```
Driver-Drowsiness/
├── index.html                   # Semantic HTML5 shell with SEO metadata & fonts
├── package.json                 # Project configuration, dependencies & Vite scripts
├── package-lock.json            # Exact dependency lockfile
├── .gitignore                   # Excludes node_modules & build artifacts
├── README.md                    # Project documentation & engineering specs
├── public/
│   └── assets/
│       └── images/
│           ├── hero_cockpit_hud.jpg     # Cockpit DMS HUD graphic
│           └── ear_facial_mesh_tech.jpg # Biometric telematics infographic
└── src/
    ├── css/
    │   ├── variables.css        # Automotive theme tokens & color palettes
    │   ├── base.css             # Resets, typography, buttons, and badges
    │   ├── layout.css           # Desktop sidebar, header, and mobile nav
    │   ├── components.css       # Metric tiles, modals, toasts, and switches
    │   ├── home.css             # Hero card, pipeline steps, and disclaimer
    │   ├── dashboard.css        # Telematics gauges and event tables
    │   ├── live.css             # Camera viewport, canvas overlays, and HUD
    │   ├── reports.css          # Session history table and report modal
    │   └── settings.css         # Sensitivity sliders and audio tester
    └── js/
        ├── app.js               # Central router, layout mount, and lifecycle
        ├── state.js             # Reactive state manager with LocalStorage sync
        ├── audio.js             # Web Audio API buzzer, chime & speech synthesis
        ├── vision.js            # MediaPipe FaceMesh & optical telematics engine
        ├── utils.js             # SVG icons, modals, toasts, CSV & PDF export
        └── pages/
            ├── home.js          # System overview & introduction view
            ├── dashboard.js     # Live telematics dashboard view
            ├── live.js          # Live camera monitoring console
            ├── reports.js       # Session audit logs & telemetry exports
            └── settings.js      # Biometric sensitivity & audio preferences
```

---

## ⚠️ Automotive Safety Disclaimer

This application is an auxiliary technological demonstration and safety prototype. It is **not** a certified automotive safety device, nor is it a substitute for attentive driving, manufacturer-certified Driver Monitoring Systems (DMS), or essential biological sleep. Drivers must always remain vigilant, obey local traffic laws, and immediately pull over to a safe rest area when feeling tired or fatigued.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
