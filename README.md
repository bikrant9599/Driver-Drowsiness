# VigilDrive AI — Driver Drowsiness Detection System

[![Automotive Safety](https://img.shields.io/badge/Telematics-Safety%20System-blue.svg)](https://github.com/bikrant9599/Driver-Drowsiness)
[![Computer Vision](https://img.shields.io/badge/Computer%20Vision-MediaPipe%20%7C%20EAR-cyan.svg)](https://github.com/bikrant9599/Driver-Drowsiness)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Zero Cloud](https://img.shields.io/badge/Privacy-100%25%20On--Device-success.svg)](https://github.com/bikrant9599/Driver-Drowsiness)

An intelligent, modern in-cabin automotive safety telematics web application that utilizes client-side computer vision and facial landmark analysis to monitor driver attentiveness in real time. It calculates the **Eye Aspect Ratio (EAR)** and triggers multi-modal auditory alarms, visual HUD warnings, and voice alerts when prolonged eye closure is detected.

---

## 🚗 Core System Architecture

```
[ In-Cabin Camera / Webcam ]
            │
            ▼
[ Facial Mesh Landmark Extraction (MediaPipe / Canvas CV) ]
            │
            ▼
[ Eye Contour Coordinate Tracking: Left (6 pts) & Right (6 pts) ]
            │
            ▼
[ Real-Time Eye Aspect Ratio (EAR) Calculation ]
            │
            ▼
[ Prolonged Closure Stopwatch & PERCLOS Evaluation ]
            │
      ┌─────┴──────────────────────────┐
      ▼                                ▼
[ EAR >= Threshold (0.22) ]    [ EAR < Threshold for >= 2.0s ]
      │                                │
      ▼                                ▼
[ Attentive Status (Green) ]    [ DROWSINESS ALERT (Red) ]
                                       │
                        ┌──────────────┼──────────────┐
                        ▼              ▼              ▼
                 [Audio Buzzer]  [Voice Synth]  [HUD Flashing]
```

### 🔬 The Eye Aspect Ratio (EAR) Metric
Based on the computer vision research by *Soukupová and Čech (2016)*, EAR measures eye opening height relative to horizontal eye width:

$$EAR = \frac{||p_2 - p_6|| + ||p_3 - p_5||}{2 \times ||p_1 - p_4||}$$

- **Attentive Driving**: Nominal EAR typically ranges between `0.28` and `0.35`.
- **Subconscious Blinks**: Brief dips lasting `150ms - 300ms` are filtered out.
- **Prolonged Eye Closure / Microsleep**: EAR drops below `0.22` for `2.0+ seconds`, initiating emergency warning protocols.

---

## 🌟 Key Features

1. **Dual Detection Modes**:
   - **Live AI Computer Vision**: Hardware webcam stream with 468-point 3D facial mesh overlay, pupil tracking, and live EAR calculation.
   - **Benchmark Simulation Mode**: Built-in testing suite to preview and test drowsiness warning triggers, alarms, and telemetry without requiring a camera.
2. **Multi-Modal Warning System**:
   - **Web Audio API Synthesizer**: Low-latency automotive buzzer, European cabin chime, and high-urgency sweep siren.
   - **Speech Synthesis Voice Prompts**: Spoken vocal warnings urging the driver to remain alert and pull over safely.
   - **Visual HUD Alert**: Perimeter flashing alert and prominent dashboard status warning.
3. **Telematics Safety Dashboard**:
   - Live camera connection indicator, driver vigilance classification, session stopwatch, and real-time EAR waveform chart.
4. **Comprehensive Reporting & Export**:
   - Incident audit log with timestamps, closure durations, and severity ratings.
   - One-click export to **CSV** or **JSON**, plus a printable report view.
5. **Calibratable Biometrics & Settings**:
   - Configurable prolonged closure threshold (1.0s to 4.0s).
   - Adjustable EAR sensitivity limit (0.16 to 0.30).
   - Camera device selector (`navigator.mediaDevices.enumerateDevices`).
6. **Automotive UI & Dual Themes**:
   - Night-optimized **Dark Navy** cockpit theme to reduce glare.
   - Daylight **Light Slate** theme with persistent preference storage.
7. **100% Privacy Guarantee**:
   - All computer vision computations execute in-browser on the local device. No video frames or biometric data leave the user's machine.

---

## 📁 Repository Structure

```
Driver-Drowsiness/
├── index.html                   # Semantic HTML5 shell with SEO metadata & fonts
├── package.json                 # Project configuration and Vite scripts
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
        ├── vision.js            # MediaPipe FaceMesh & canvas fallback tracker
        ├── utils.js             # SVG icons library, modals, toasts, and CSV export
        └── pages/
            ├── home.js          # System overview & introduction view
            ├── dashboard.js     # Live telematics dashboard view
            ├── live.js          # Live camera monitoring console
            ├── reports.js       # Session audit logs & telemetry exports
            └── settings.js      # Biometric sensitivity & audio preferences
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0 or higher recommended)
- A modern web browser with WebRTC and Web Audio API support (Chrome, Edge, Firefox, Safari)
- Built-in or external USB webcam

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/bikrant9599/Driver-Drowsiness.git
   cd Driver-Drowsiness
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   Navigate to `http://localhost:5173/`

5. **Build for production**:
   ```bash
   npm run build
   ```

---

## ⚠️ Automotive Safety Disclaimer

This software is an auxiliary technological demonstration and safety prototype. It is **not** a certified replacement for attentive driving, manufacturer-integrated Advanced Driver Assistance Systems (ADAS), or essential rest. Drivers must always remain vigilant and pull over safely when fatigued.

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
