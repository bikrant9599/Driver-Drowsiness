# AI Driver Safety & Drowsiness Detection System

[![Automotive Safety](https://img.shields.io/badge/Telematics-Safety%20System-blue.svg)](https://github.com/bikrant9599/Driver-Drowsiness)
[![Computer Vision](https://img.shields.io/badge/Computer%20Vision-MediaPipe%20%7C%20EAR%20%7C%20ObjectDetector-cyan.svg)](https://github.com/bikrant9599/Driver-Drowsiness)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Zero Cloud](https://img.shields.io/badge/Privacy-100%25%20On--Device-success.svg)](https://github.com/bikrant9599/Driver-Drowsiness)

A comprehensive, real-time AI computer-vision in-cabin driver monitoring system (DMS) built with **MediaPipe Face Landmarker (478 3D landmarks)**, **MediaPipe Object Detector**, and Web Audio API synthesis. The system provides integrated safety monitoring for:
1. **Driver Drowsiness & Microsleep** (8-point 3D EAR & temporal blink filtering)
2. **Seat Belt Compliance Detection** (Diagonal torso strap tracking & lighting validation)
3. **Mobile Phone Distraction Detection** (Real-time device holding & usage detection)
4. **Driver Attention Tracking** (3D head pose gaze angle & 10-second road focus window)
5. **Three-Stage Escalating Warning System** (Stage 1 Initial Beeps → Stage 2 Critical Screen Flash → Stage 3 Emergency Siren)

---

## 🚗 Multi-System Safety Architecture

```
                     ┌───────────────────────────────┐
                     │   In-Cabin Camera / Webcam    │
                     └──────────────┬────────────────┘
                                    │ WebRTC 60 FPS Video Stream
                                    ▼
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐
│ MediaPipe 478 Mesh     │ │ MediaPipe Object       │ │ Torso ROI & Diagonal   │
│ Face & Eye Landmarks   │ │ Detector (Cell Phone)  │ │ Seat Belt Edge Analyzer│
└──────────┬─────────────┘ └──────────┬─────────────┘ └──────────┬─────────────┘
           │                          │                          │
           ▼                          ▼                          ▼
┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐
│ 1. Drowsiness / Eyes   │ │ 2. Phone Detection     │ │ 3. Seat Belt Tracking  │
│ • 8-Point 3D EAR       │ │ • EfficientDet Lite0   │ │ • Lighting validation  │
│ • State machine        │ │ • Score confidence     │ │ • Webbing contrast     │
│ • Blink discrimination │ │ • Bounding box HUD     │ │ • Fastened / Unworn    │
└──────────┬─────────────┘ └──────────┬─────────────┘ └──────────┬─────────────┘
           │                          │                          │
           ▼                          ▼                          ▼
┌────────────────────────┐            │                          │
│ 4. Driver Attention    │            │                          │
│ • 3D Yaw/Pitch Gaze    │            │                          │
│ • 10s Road Cone Window │            │                          │
└──────────┬─────────────┘            │                          │
           │                          │                          │
           └──────────────────────────┼──────────────────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │ Priority Violation Evaluator  │
                      │ (Drowsiness > Attention >     │
                      │  Phone Use > Seat Belt)       │
                      └──────────────┬────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
[ STAGE 1: INITIAL ]        [ STAGE 2: CRITICAL ]       [ STAGE 3: EMERGENCY ]
• 3 Red indicator flashes   • Entire screen red flash   • Full-screen modal
• 3 Short sharp beeps       • Urgent repeating audio    • Dual-layer siren
• Violation title message   • Large warning banner      • Incident audit log
```

---

## 🔬 Safety Features Specification

### 1. Seat Belt Detection
- **Torso & Lighting Validation**: Verifies that the driver's torso is within the camera's field of view and that in-cabin illumination is adequate before evaluation.
- **Three Clear States**:
  - `SEAT BELT: DETECTED` (Green) — Diagonal chest strap verified with high confidence; renders a futuristic holographic strap overlay.
  - `SEAT BELT: DETECTION UNCERTAIN` (Yellow) — Torso partially obscured, camera tilted too high, or low lighting. Prevents false alarms.
  - `SEAT BELT: NOT DETECTED` (Red) — Torso is clear and illuminated, but no diagonal seat belt strap is present.
- **Configurable Warning Delay**: Triggers the warning sequence only when unbuckled continuously for the configured duration (default `5.0s`).

### 2. Mobile Phone Detection
- **Deep Neural Object Detection**: Employs Google's MediaPipe ObjectDetector (`efficientdet_lite0`) running asynchronously in the browser with `categoryAllowlist: ["cell phone"]`.
- **Three Clear States**:
  - `PHONE STATUS: NO PHONE` (Green) — Hands-free safe driving.
  - `PHONE STATUS: POSSIBLE PHONE USE` (Yellow) — Borderline confidence or peripheral detection.
  - `PHONE STATUS: PHONE DETECTED` (Red) — Active device holding or usage detected; renders a cybernetic bounding box on canvas with confidence percentage.
- **Configurable Warning Delay**: Triggers warning sequence after continuous phone usage (default `3.0s`).

### 3. Driver Attention Detection (Road Focus)
- **3D Head Pose Direction**: Computes horizontal Yaw and vertical Pitch from 478 3D facial landmarks with temporal exponential smoothing.
- **Road Cone Forward Focus**: Safe forward gaze cone defined within Yaw $\pm 22^\circ$ and Pitch $\pm 18^\circ$.
- **Normal Glance Tolerance**: Brief glances at mirrors or instruments for a few seconds are accepted as normal driving behavior.
- **10-Second Distraction Window**: If the driver continuously looks away from the forward direction for more than 10 seconds (per user specification), the Three-Stage Warning sequence initiates.
- **Visual Gaze Vector**: Projects an intuitive 3D directional arrow from the nose tip on canvas (Green: Focused, Yellow: Borderline, Red: Distracted).

### 4. Drowsiness & Microsleep Detection
- **Enhanced 8-Point 3D EAR**: Evaluates outer chords and central aperture normalized by eye width in 3D Euclidean space:
  $$EAR = \frac{||p_2 - p_6|| + 2 \cdot ||p_{top\_mid} - p_{bot\_mid}|| + ||p_3 - p_5||}{4 \cdot ||p_1 - p_4||}$$
- **Blink Discrimination**: Closures between $70\,\text{ms}$ and $400\,\text{ms}$ are filtered as subconscious blinks, incrementing the live blink counter and rolling blinks/min (BPM).
- **Prolonged Closure**: Closures exceeding threshold (default `2.0s`) immediately escalate to High Risk.

---

## 🚨 Three-Stage Warning System

All four safety violations feed into a unified, non-overlapping warning sequence with strict priority (`Drowsiness > Attention > Phone > Seat Belt`):

1. **Stage 1 – Initial Warning**:
   - Status banner flashes red exactly three times.
   - Plays three short, sharp warning beeps ($1050\,\text{Hz} \to 880\,\text{Hz}$).
   - Displays violation description (e.g. `[INITIAL WARNING] SEAT BELT NOT DETECTED`).
2. **Stage 2 – Critical Warning**:
   - The entire application screen flashes red (`.critical-screen-flash`).
   - Plays an urgent repeating two-tone warning pulse ($920\,\text{Hz} \to 680\,\text{Hz}$).
   - Large, high-visibility warning message.
3. **Stage 3 – Emergency Alarm**:
   - Full-screen emergency warning modal activates with hazard borders.
   - Continuous dual-layer Emergency Siren wail ($430\,\text{Hz} - 1070\,\text{Hz}$) + piercing strobe ($1450\,\text{Hz}$).
   - Automatically silences immediately when the driver corrects the violation or stops monitoring.
   - Configurable cooldown ($3.0\,\text{s}$) prevents alarm stutter.

---

## 📊 Safety Dashboard & Monitoring Cards

The live interface features 4 prominent Safety Cards:
1. **Drowsiness Detection**: Status (`ALERT` / `CLOSING` / `DROWSY`), indicator dot (Green/Yellow/Red), live EAR and closure timer.
2. **Seat Belt Detection**: Status (`FASTENED` / `UNCERTAIN` / `NOT FASTENED`), indicator dot, confidence percentage, and reason.
3. **Mobile Phone Detection**: Status (`HANDS-FREE` / `POSSIBLE USE` / `PHONE IN USE`), indicator dot, usage timer.
4. **Driver Attention Detection**: Status (`ROAD FOCUSED` / `GAZE AWAY` / `DISTRACTED`), indicator dot, Yaw/Pitch angles, and 10s countdown.

### Warning Violation History
A live audit list records all violations occurring during the session:
- Violation Type & Title
- Time of detection
- Highest warning stage reached (Stage 1 / Stage 2 / Stage 3)
- Retained in persistent session history for safety review

---

## ⚙️ Configurable Safety Settings

The **Safety Settings** modal enables driver customization:
- **Seat Belt Warning Delay**: $2.0\,\text{s} - 10.0\,\text{s}$ (default $5.0\,\text{s}$)
- **Phone Detection Delay**: $1.0\,\text{s} - 8.0\,\text{s}$ (default $3.0\,\text{s}$)
- **Distraction Warning Threshold**: $5.0\,\text{s} - 15.0\,\text{s}$ (default $10.0\,\text{s}$)
- **Closure EAR Threshold**: $0.16 - 0.32$ (presets: Spectacles $0.18$, Standard $0.21$, Sensitive $0.24$)
- **3-Second Eye Auto-Calibration**: Automatically samples natural open eyes to calibrate personalized baseline
- **Alarm Cooldown Period**: $1.0\,\text{s} - 5.0\,\text{s}$ (default $3.0\,\text{s}$)

---

## 🚀 Installation & Local Execution

```bash
# 1. Clone repository
git clone https://github.com/bikrant9599/Driver-Drowsiness.git
cd Driver-Drowsiness

# 2. Install dependencies
npm install

# 3. Build production bundle
npm run build

# 4. Start local development server
npm run dev
```

Open: **`http://localhost:5173/`**

---

## ⚠️ Automotive Safety Disclaimer

This software is an auxiliary driver-assistance prototype and research demonstration. It does not replace attentive driving, seat belt legal requirements, or certified automotive safety hardware. Always remain alert, wear your seat belt, keep hands off mobile devices, and focus on the road.

---

## 📄 License

Licensed under the [MIT License](LICENSE).
