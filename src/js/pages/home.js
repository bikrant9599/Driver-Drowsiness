/* ==========================================================================
   VIEW: HOME PAGE
   ========================================================================== */

import { ICONS } from "../utils.js";
import { appState } from "../state.js";

export function renderHomePage() {
  const container = document.createElement("div");
  container.className = "home-container fade-in";

  container.innerHTML = `
    <!-- Hero Presentation -->
    <div class="hero-card">
      <div class="hero-content">
        <div class="hero-tag">
          ${ICONS.shieldCheck} Automotive Safety Telematics
        </div>
        <h1 class="hero-title">
          AI Driver <span class="gradient-text">Drowsiness</span> Detection System
        </h1>
        <p class="hero-description">
          An intelligent in-cabin computer vision system that monitors driver attentiveness, 
          calculates real-time Eye Aspect Ratio (EAR), and emits immediate audible warnings 
          when prolonged eye closure is detected.
        </p>
        <div class="hero-actions">
          <button class="btn btn-primary btn-lg" id="home-start-btn">
            ${ICONS.play} Start Monitoring
          </button>
          <button class="btn btn-secondary btn-lg" id="home-dashboard-btn">
            ${ICONS.dashboard} Safety Dashboard
          </button>
        </div>
      </div>
      <div class="hero-media">
        <img src="/assets/images/hero_cockpit_hud.jpg" alt="Automotive Cockpit Driver Monitoring HUD" loading="lazy" />
        <div class="hero-overlay-badge">
          ${ICONS.eye}
          <div>
            <strong>DMS Active</strong><br/>
            <span style="color: #94a3b8; font-size: 0.7rem;">Real-time Biometric Tracking</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Telematics Highlights -->
    <div class="metric-grid">
      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Detection Metric</span>
          <div class="metric-tile-icon">${ICONS.eye}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value">EAR</span>
          <span class="metric-tile-unit">Eye Aspect Ratio</span>
        </div>
        <div class="metric-tile-footer">
          <span>Continuous pupil & eyelid vectors</span>
          <span class="badge badge-safe">Sub-millisecond</span>
        </div>
      </div>

      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Alert Latency</span>
          <div class="metric-tile-icon">${ICONS.bell}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value">&lt; 0.1</span>
          <span class="metric-tile-unit">seconds</span>
        </div>
        <div class="metric-tile-footer">
          <span>Web Audio synthesizer & speech</span>
          <span class="badge badge-safe">Instant Trigger</span>
        </div>
      </div>

      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Privacy Standard</span>
          <div class="metric-tile-icon">${ICONS.shieldCheck}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value">100%</span>
          <span class="metric-tile-unit">On-Device</span>
        </div>
        <div class="metric-tile-footer">
          <span>No video ever leaves browser</span>
          <span class="badge badge-info">Zero Cloud Upload</span>
        </div>
      </div>

      <div class="metric-tile">
        <div class="metric-tile-header">
          <span class="metric-tile-label">Hardware Profile</span>
          <div class="metric-tile-icon">${ICONS.camera}</div>
        </div>
        <div class="metric-tile-body">
          <span class="metric-tile-value">Standard</span>
          <span class="metric-tile-unit">Webcam / IR</span>
        </div>
        <div class="metric-tile-footer">
          <span>Runs on desktop, laptop & tablet</span>
          <span class="badge badge-safe">Universal</span>
        </div>
      </div>
    </div>

    <!-- How It Works Section -->
    <section>
      <div class="section-header">
        <div class="section-subtitle">Core Architecture</div>
        <h2 class="section-title">How The System Works</h2>
        <p class="section-description">
          A four-stage computer vision and telematics pipeline engineered to prevent fatigue-related road incidents.
        </p>
      </div>

      <div class="how-it-works-grid">
        <div class="step-card">
          <span class="step-number">01</span>
          <div class="step-icon-wrapper">${ICONS.camera}</div>
          <h3 class="step-title">Video Stream Capture</h3>
          <p class="step-desc">
            Direct WebRTC camera feed captures driver facial features at 30-60 frames per second under standard cabin lighting or night mode.
          </p>
        </div>

        <div class="step-card">
          <span class="step-number">02</span>
          <div class="step-icon-wrapper">${ICONS.cpu}</div>
          <h3 class="step-title">Facial Mesh Landmarks</h3>
          <p class="step-desc">
            Neural network extracts 468 3D facial coordinates, isolating 6 key spatial landmarks for both the left and right eye contours.
          </p>
        </div>

        <div class="step-card">
          <span class="step-number">03</span>
          <div class="step-icon-wrapper">${ICONS.gauge}</div>
          <h3 class="step-title">EAR & PERCLOS Logic</h3>
          <p class="step-desc">
            Calculates Eye Aspect Ratio (EAR) dynamically. Distinguishes natural subconscious blinks (&lt;0.3s) from microsleeps and prolonged closure.
          </p>
        </div>

        <div class="step-card">
          <span class="step-number">04</span>
          <div class="step-icon-wrapper">${ICONS.bell}</div>
          <h3 class="step-title">Multi-Modal Alert</h3>
          <p class="step-desc">
            When eye closure exceeds the configured safety threshold (e.g. 2.0s), an audible buzzer, flashing HUD border, and voice warning trigger simultaneously.
          </p>
        </div>
      </div>
    </section>

    <!-- Technical Infographic Presentation -->
    <div class="tech-banner-card">
      <img src="/assets/images/ear_facial_mesh_tech.jpg" alt="EAR Biometric Telematics Analysis" class="tech-banner-img" loading="lazy" />
      <div class="tech-banner-content">
        <span class="badge badge-info" style="margin-bottom: 0.75rem;">Biometric Telematics</span>
        <h3 style="font-size: 1.5rem; margin-bottom: 0.75rem;">Computer Vision Eye Aspect Ratio</h3>
        <p style="font-size: 0.9rem; line-height: 1.6; color: var(--text-secondary); margin-bottom: 1.25rem;">
          Based on the landmark computer vision research by Soukupová and Čech, the Eye Aspect Ratio relates eye opening height to eye opening width. 
          When a driver drifts into drowsiness, EAR drops drastically below 0.20 and remains depressed.
        </p>
        <button class="btn btn-secondary" id="home-view-live-btn">
          ${ICONS.eye} Launch Live Vision Console
        </button>
      </div>
    </div>

    <!-- Key Features Grid -->
    <section>
      <div class="section-header">
        <div class="section-subtitle">System Capabilities</div>
        <h2 class="section-title">Engineered for Driver Vigilance</h2>
        <p class="section-description">
          Built according to automotive telematics benchmarks for distraction and fatigue prevention.
        </p>
      </div>

      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">${ICONS.eye}</div>
          <div class="feature-body">
            <h4>Blink vs Closure Classification</h4>
            <p>Smart temporal filtering distinguishes between standard rapid eye blinks (150-300ms) and hazardous microsleeps.</p>
          </div>
        </div>

        <div class="feature-card">
          <div class="feature-icon">${ICONS.bell}</div>
          <div class="feature-body">
            <h4>Triple-Tone Sound Alarm</h4>
            <p>Customizable automotive warnings including high-pitch buzzer, European vehicle chime, and sweep siren with volume controls.</p>
          </div>
        </div>

        <div class="feature-card">
          <div class="feature-icon">${ICONS.reports}</div>
          <div class="feature-body">
            <h4>Session Telemetry & Audit Logs</h4>
            <p>Records complete session history, duration, average EAR values, and drowsiness timestamps downloadable in CSV or JSON.</p>
          </div>
        </div>

        <div class="feature-card">
          <div class="feature-icon">${ICONS.settings}</div>
          <div class="feature-body">
            <h4>Calibratable Sensitivity</h4>
            <p>Fine-tune both the closure duration trigger threshold (1.0s - 4.0s) and EAR sensitivity to match specific driver eye shapes.</p>
          </div>
        </div>

        <div class="feature-card">
          <div class="feature-icon">${ICONS.moon}</div>
          <div class="feature-body">
            <h4>Automotive Dark & Light Themes</h4>
            <p>High-contrast dark navy mode reduces cabin glare during night transit, with clean daylight slate mode for daytime operation.</p>
          </div>
        </div>

        <div class="feature-card">
          <div class="feature-icon">${ICONS.shieldCheck}</div>
          <div class="feature-body">
            <h4>100% Client-Side Privacy</h4>
            <p>Strict local processing ensures zero video streaming to external servers. All neural calculations execute inside the client CPU/GPU.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Technology Stack Badges -->
    <section style="text-align: center; padding: 1rem 0;">
      <div class="section-subtitle">Underlying Technologies</div>
      <div class="tech-stack-row">
        <span class="tech-tag">${ICONS.cpu} HTML5 WebRTC</span>
        <span class="tech-tag">${ICONS.eye} MediaPipe Face Mesh</span>
        <span class="tech-tag">${ICONS.bell} Web Audio API</span>
        <span class="tech-tag">${ICONS.camera} HTML5 Canvas 2D</span>
        <span class="tech-tag">${ICONS.reports} LocalStorage Persistence</span>
        <span class="tech-tag">${ICONS.shieldCheck} Web Speech Synthesis</span>
      </div>
    </section>

    <!-- Automotive Safety Disclaimer -->
    <div class="disclaimer-card">
      <div class="disclaimer-icon">${ICONS.alertTriangle}</div>
      <div class="disclaimer-text">
        <h4>Critical Automotive Safety Disclaimer</h4>
        <p>
          This AI Driver Drowsiness Detection System is an auxiliary technological assistance tool designed to help increase driver awareness. 
          It does NOT replace safe driving practices, driver responsibility, or adequate physical rest. Never operate a motor vehicle when feeling fatigued. 
          If you experience signs of exhaustion, pull over immediately at a safe designated rest area.
        </p>
      </div>
    </div>
  `;

  // Bind Event Listeners
  container.querySelector("#home-start-btn").addEventListener("click", () => {
    appState.setPage("live");
  });

  container.querySelector("#home-dashboard-btn").addEventListener("click", () => {
    appState.setPage("dashboard");
  });

  container.querySelector("#home-view-live-btn").addEventListener("click", () => {
    appState.setPage("live");
  });

  return container;
}
