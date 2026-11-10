# AI Driver Drowsiness Detection System

[![Automotive Safety](https://img.shields.io/badge/Telematics-Safety%20System-blue.svg)](https://github.com/bikrant9599/Driver-Drowsiness)
[![Computer Vision](https://img.shields.io/badge/Computer%20Vision-MediaPipe%20%7C%20EAR-cyan.svg)](https://github.com/bikrant9599/Driver-Drowsiness)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Zero Cloud](https://img.shields.io/badge/Privacy-100%25%20On--Device-success.svg)](https://github.com/bikrant9599/Driver-Drowsiness)

A professional, real-time AI computer-vision in-cabin driver monitoring system (DMS) built with **MediaPipe Face Landmarker (478 3D landmarks)** and real-time **Eye Aspect Ratio (EAR)** telematics. The application delivers continuous eye tracking, distinguishes normal subconscious blinking from dangerous prolonged eye closure, features a futuristic HUD visualization, and deploys a high-priority dual-layered Emergency Siren with cooldown protection.

---

## 🚗 System Architecture & Computer Vision Pipeline

```
                     ┌───────────────────────────────┐
                     │   In-Cabin Camera / Webcam    │
                     └──────────────┬────────────────┘
                                    │ WebRTC 60 FPS Video Stream
                                    ▼
                     ┌───────────────────────────────┐
                     │ MediaPipe Face Landmarker     │
                     │ (478 3D Normalized Landmarks)│
                     └──────────────┬────────────────┘
                                    │ 3D Normalized Coordinates & Blendshapes
             ┌──────────────────────┴──────────────────────┐
             ▼                                             ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│ Left Eye Analysis            │              │ Right Eye Analysis           │
│ • Canonical indices: 362..263│              │ • Canonical indices: 33..133 │
│ • 8-Point 3D EAR Formula     │              │ • 8-Point 3D EAR Formula     │
│ • State: OPEN/CLOSING/CLOSED │              │ • State: OPEN/CLOSING/CLOSED │
│ • Iris Center Ring (473)     │              │ • Iris Center Ring (468)     │
└──────────────┬───────────────┘              └──────────────┬───────────────┘
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │ Eye State & Blink Evaluator   │
                      ├───────────────────────────────┤
                      │ • Normal Blink Filter         │
                      │   (70ms – 400ms duration)     │
                      │ • Rolling Blinks/Minute (BPM) │
                      │ • Consecutive Closure Timer   │
                      └──────────────┬────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
[ NORMAL BLINKING ]          [ WARNING STAGE ]           [ HIGH RISK ACTIVE ]
• Closure < 0.40s            • Closure 0.40s – 2.0s      • Closure >= 2.0s
• Increment Blink Count      • Amber Visual Banner       • Red Perimeter Flashing
• Siren Muted                • Siren Muted               • Dual-Layer Siren Alarm
                                                         • Incident Audit Log
```

---

## 🔬 Mathematical Formulation & Accuracy Enhancements

### 1. 8-Point 3D Eye Aspect Ratio (EAR)
Building upon the seminal work of *Soukupová and Čech (2016)*, this system employs an enhanced 8-point 3D EAR formulation measuring both outer vertical chords as well as the central pupil aperture, normalized by horizontal eye width in true 3D Euclidean space:

$$EAR = \frac{||p_2 - p_6|| + 2 \cdot ||p_{top\_mid} - p_{bot\_mid}|| + ||p_3 - p_5||}{4 \cdot ||p_1 - p_4||}$$

- **3D Spatial Invariance**: Uses 3D Euclidean coordinates ($x, y, z$) to remain invariant to head pitch, yaw, and roll angles up to ±45°.
- **Spectacle Tolerance**: The central aperture measurement reliably detects eyelid drops even behind clear corrective lenses and reading glasses.
- **Neural Blendshape Assistance**: Combines geometric EAR with MediaPipe deep neural blendshapes (`eyeBlinkLeft`, `eyeBlinkRight`) to eliminate borderline ambiguity.

### 2. Adaptive Temporal Smoothing
An Exponential Moving Average (EMA) with asymmetric velocity adaptation provides instant response:
- **Rapid Eye Closure**: Fast adaptation ($\alpha = 0.82$) ensures zero latency upon eyelid drop.
- **Normal Open Eyes**: Smooth stabilization ($\alpha = 0.65$) removes sensor micro-jitter and stabilizes live metric readouts.

### 3. Normal Blinking vs. Prolonged Eye Closure
- **Normal Blinks**: Transient eye closures lasting between `70ms` and `400ms` are recognized as healthy subconscious blinks, incrementing the live blink counter and updating the driver's rolling blink rate (blinks per minute).
- **Prolonged Closure**: Closures exceeding the configurable detection window (default `2.0s`) immediately escalate to `HIGH RISK` and trigger the emergency siren.
- **Cooldown Protection**: After an alarm is silenced upon eye reopening, a configurable rest window (default `3.0s`) prevents stuttering false alarms while keeping visual monitoring active.

---

## 🌟 Futuristic Computer Vision HUD Interface

When the camera detects the driver's face:
1. **Face HUD Reticle**: Tactical cybernetic corner brackets with driver ID tag `AI TARGET: DRIVER_01 [TRACKING]`.
2. **Smooth Contours**: Glowing closed polygonal loops around the exact perimeter of each eye (16 landmarks per eye) rendered in cyber cyan (`#38bdf8`), warning amber (`#f59e0b`), or alert crimson (`#ef4444`).
3. **Animated Landmark Nodes**: Key eyelid canthi and peak vertices pulse subtly in real time.
4. **Iris Crosshair Reticles**: Precision tracking circles with micro crosshairs centered on each pupil (landmarks 468 & 473).
5. **HUD Eye Panels**: Individual floating badges over each eye displaying `L-EYE: OPEN [EAR 0.29]` and `R-EYE: OPEN [EAR 0.30]`.
6. **Holographic Eye Scan Beam**: A subtle cybernetic laser sweep line travels across the eye region for a futuristic cockpit feel without distracting the driver.

---

## 📊 Real-Time Detection Dashboard

During monitoring, the interface displays 7 live telemetry cards:
- **Face Detection**: `ACTIVE` (with pulsing indicator) or `NOT DETECTED`
- **Eye Tracking**: `ACTIVE` / `LOST` / `STANDBY`
- **Left Eye**: State (`OPEN`, `CLOSING`, `CLOSED`, `BLINKING`) and live numerical EAR
- **Right Eye**: State (`OPEN`, `CLOSING`, `CLOSED`, `BLINKING`) and live numerical EAR
- **Blink Detection**: Real-time `LIVE` indicator with flash animation + total count & rate (`XX bpm`)
- **Eye Closure Duration**: Live digital timer (`0.00s`) with an animated color-shifting progress bar filling towards the warning threshold
- **Drowsiness Status**: `NORMAL` / `WARNING` / `HIGH RISK` with animated badges

---

## ⚙️ Interactive Calibration & Configurable Settings

The system includes a dedicated **Detection Settings & Calibration** modal:
- **Closure EAR Threshold**: Slider from `0.16` to `0.32` with instant presets:
  - *Spectacles / Glasses (0.18)*
  - *Standard (0.21)*
  - *High Sensitivity (0.24)*
- **3-Second Auto-Calibration ("Calibrate My Eyes")**: Automatically samples the driver's natural open eyes over 3 seconds, computes their baseline EAR, and sets a customized threshold at 74% of their baseline.
- **Drowsiness Trigger Duration**: Configurable from `1.0s` to `4.0s` (default `2.0s`).
- **Alarm Cooldown**: Configurable from `1.0s` to `5.0s` (default `3.0s`).
- **Emergency Siren Controls**: Mute toggle, Volume slider (0-100%), and 2-second siren test button.

---

## 🔊 Emergency Audio Warning System

Synthesized purely via the Web Audio API without external audio files:
- **Layer 1**: Alternating high-low emergency siren wail (`430Hz – 1070Hz` swept at `3.2Hz`).
- **Layer 2**: Piercing electronic strobe warning pulse (`1450Hz` pulsed at `8Hz`).
- **No Overlapping Sounds**: Singleton alarm instance prevents multiple audio sources from playing simultaneously.
- **Instant Cutoff**: 25ms linear fadeout eliminates audio popping or clicks when the driver opens their eyes or monitoring stops.

---

## 📁 Project Structure

```
Driver-Drowsiness/
├── index.html                   # HTML5 entry with dark navy theme & Google fonts
├── package.json                 # Dependencies & Vite build script
├── package-lock.json            # Exact lockfile
├── .gitignore                   # Ignores node_modules & dist
├── README.md                    # System documentation & technical specs
└── src/
    ├── css/
    │   ├── variables.css        # Navy & royal-blue color tokens and status palettes
    │   ├── base.css             # Resets, typography, and buttons
    │   └── app.css              # Dashboard, camera preview, telemetry grid & HUD
    └── js/
        ├── app.js               # Application controller & 60 FPS telemetry updater
        ├── audio.js             # Dual-layer emergency siren synthesizer
        ├── state.js             # State manager, settings persistence & session history
        ├── utils.js             # SVG icons, time formatters & date utilities
        └── vision.js            # MediaPipe Landmarker, EAR math, HUD & blink tracking
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18.0 or higher recommended)
- A modern web browser with WebRTC and Web Audio support (Chrome, Edge, Firefox, Safari)
- Standard webcam or integrated laptop camera

### Installation & Execution
```bash
# 1. Clone the repository
git clone https://github.com/bikrant9599/Driver-Drowsiness.git
cd Driver-Drowsiness

# 2. Install dependencies
npm install

# 3. Build production bundle
npm run build

# 4. Run local development server
npm run dev
```

---

## ⚠️ Automotive Safety Disclaimer

This software is an educational prototype and auxiliary safety demonstration. It does not replace attentive human driving, adequate sleep, or certified vehicular safety systems. Always obey traffic laws and rest when fatigued.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
