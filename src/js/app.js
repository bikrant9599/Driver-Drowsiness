/* ==========================================================================
   APPLICATION CONTROLLER & ROUTER
   ========================================================================== */

import { ICONS, formatDuration } from "./utils.js";
import { appState } from "./state.js";
import { visionEngine } from "./vision.js";

// Page modules
import { renderHomePage } from "./pages/home.js";
import { renderDashboardPage } from "./pages/dashboard.js";
import { renderLivePage } from "./pages/live.js";
import { renderReportsPage } from "./pages/reports.js";
import { renderSettingsPage } from "./pages/settings.js";

const PAGE_META = {
  home: { title: "System Overview", subtitle: "AI Driver Drowsiness Detection System" },
  dashboard: { title: "Safety Dashboard", subtitle: "Real-time Vehicle Biometrics & Telematics" },
  live: { title: "Live Vision Console", subtitle: "Webcam Facial Mesh & Eye Aspect Ratio Tracking" },
  reports: { title: "Session Reports", subtitle: "Driver Transit History & Incident Audit Logs" },
  settings: { title: "System Settings", subtitle: "Biometric Sensitivity & Warning Preferences" }
};

class Application {
  constructor() {
    this.root = document.getElementById("app-root");
    this.contentMount = null;
    this.currentViewContainer = null;
    this.clockInterval = null;
    this.sessionTimerInterval = null;
  }

  init() {
    // Apply saved theme
    document.documentElement.setAttribute("data-theme", appState.theme);

    // Render Shell Layout
    this.renderLayout();

    // Bind Global Router
    window.addEventListener("hashchange", () => this.handleRouting());
    this.handleRouting();

    // Start Master Clock & Session Timer
    this.startTimers();

    // Subscribe to State Changes for Header & Badges
    appState.subscribe((changeType) => this.onStateChange(changeType));
  }

  renderLayout() {
    this.root.innerHTML = `
      <!-- Desktop Sidebar -->
      <aside class="sidebar" id="app-sidebar">
        <div class="sidebar-header">
          <div class="brand-logo-icon">
            ${ICONS.logo}
          </div>
          <div class="brand-title">
            <span class="brand-name">VigilDrive <span class="ai-tag">AI</span></span>
            <span class="brand-sub">Driver Drowsiness System</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <a href="#home" class="nav-item" data-route="home">
            ${ICONS.home}
            <span>Home</span>
          </a>
          <a href="#dashboard" class="nav-item" data-route="dashboard">
            ${ICONS.dashboard}
            <span>Dashboard</span>
            <span class="nav-badge" id="nav-alert-badge" style="display: none;">0</span>
          </a>
          <a href="#live" class="nav-item" data-route="live">
            ${ICONS.eye}
            <span>Live Monitoring</span>
            <span class="badge badge-safe" style="font-size: 0.65rem; padding: 2px 6px;" id="nav-live-pill">LIVE</span>
          </a>
          <a href="#reports" class="nav-item" data-route="reports">
            ${ICONS.reports}
            <span>Reports</span>
          </a>
          <a href="#settings" class="nav-item" data-route="settings">
            ${ICONS.settings}
            <span>Settings</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="safety-telemetry-pill">
            <div class="telemetry-indicator">
              <span class="badge-dot" id="sidebar-status-dot" style="background: var(--status-safe);"></span>
              <span id="sidebar-status-text">System Active</span>
            </div>
            <span class="badge badge-info" id="sidebar-mode-badge" style="font-size: 0.65rem;">
              ${appState.monitoringMode === 'sample' ? 'Sample' : 'Hardware'}
            </span>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" style="flex: 1; font-size: 0.75rem;" id="sidebar-theme-toggle">
              ${appState.theme === 'dark' ? ICONS.sun : ICONS.moon}
              <span id="theme-btn-label">${appState.theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- Mobile Backdrop -->
      <div class="mobile-backdrop" id="mobile-backdrop"></div>

      <!-- Main Layout Content Area -->
      <div class="main-wrapper">
        <header class="app-header">
          <div class="header-left">
            <button class="mobile-menu-toggle" id="mobile-menu-btn" aria-label="Open menu">
              ${ICONS.menu}
            </button>
            <div class="page-breadcrumb">
              <h1 class="page-title" id="page-header-title">System Overview</h1>
              <span class="page-subtitle" id="page-header-subtitle">AI Driver Drowsiness Detection System</span>
            </div>
          </div>

          <div class="header-right">
            <div class="telematics-clock" id="telematics-clock" title="Automotive Master UTC Time">
              ${ICONS.gauge}
              <span id="clock-display" class="tabular-nums">00:00:00</span>
            </div>

            <button class="btn btn-secondary btn-icon" id="header-theme-toggle" title="Toggle Theme">
              ${appState.theme === 'dark' ? ICONS.sun : ICONS.moon}
            </button>
          </div>
        </header>

        <main class="main-content" id="main-content-mount"></main>
      </div>

      <!-- Mobile Bottom Navigation Bar -->
      <nav class="mobile-bottom-nav">
        <a href="#home" class="mobile-nav-link" data-route="home">
          ${ICONS.home}
          <span>Home</span>
        </a>
        <a href="#dashboard" class="mobile-nav-link" data-route="dashboard">
          ${ICONS.dashboard}
          <span>Dashboard</span>
        </a>
        <a href="#live" class="mobile-nav-link" data-route="live">
          ${ICONS.eye}
          <span>Live</span>
        </a>
        <a href="#reports" class="mobile-nav-link" data-route="reports">
          ${ICONS.reports}
          <span>Reports</span>
        </a>
        <a href="#settings" class="mobile-nav-link" data-route="settings">
          ${ICONS.settings}
          <span>Settings</span>
        </a>
      </nav>
    `;

    this.contentMount = document.getElementById("main-content-mount");

    // Bind Theme Toggles
    const toggleTheme = () => {
      const nextTheme = appState.theme === "dark" ? "light" : "dark";
      appState.setTheme(nextTheme);
      this.updateThemeIcons();
    };

    document.getElementById("sidebar-theme-toggle").addEventListener("click", toggleTheme);
    document.getElementById("header-theme-toggle").addEventListener("click", toggleTheme);

    // Mobile Drawer Handlers
    const sidebar = document.getElementById("app-sidebar");
    const backdrop = document.getElementById("mobile-backdrop");
    const mobileBtn = document.getElementById("mobile-menu-btn");

    const toggleMobileMenu = () => {
      sidebar.classList.toggle("mobile-open");
      backdrop.classList.toggle("active");
    };

    mobileBtn.addEventListener("click", toggleMobileMenu);
    backdrop.addEventListener("click", toggleMobileMenu);

    // Close mobile menu on item click
    sidebar.querySelectorAll(".nav-item").forEach((link) => {
      link.addEventListener("click", () => {
        sidebar.classList.remove("mobile-open");
        backdrop.classList.remove("active");
      });
    });
  }

  updateThemeIcons() {
    const isDark = appState.theme === "dark";
    const headerBtn = document.getElementById("header-theme-toggle");
    if (headerBtn) headerBtn.innerHTML = isDark ? ICONS.sun : ICONS.moon;

    const sidebarBtn = document.getElementById("sidebar-theme-toggle");
    if (sidebarBtn) {
      sidebarBtn.innerHTML = `
        ${isDark ? ICONS.sun : ICONS.moon}
        <span id="theme-btn-label">${isDark ? 'Light Theme' : 'Dark Theme'}</span>
      `;
    }
  }

  async handleRouting() {
    let route = window.location.hash.replace("#", "").toLowerCase() || "home";
    if (!PAGE_META[route]) {
      route = "home";
    }

    appState.currentPage = route;

    // Update Nav Active State
    document.querySelectorAll(".nav-item, .mobile-nav-link").forEach((link) => {
      if (link.dataset.route === route) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    // Update Header Titles
    const meta = PAGE_META[route];
    document.getElementById("page-header-title").textContent = meta.title;
    document.getElementById("page-header-subtitle").textContent = meta.subtitle;

    // Stop active camera if navigating away from live page while session stopped
    if (route !== "live" && !appState.isMonitoring) {
      visionEngine.stopCamera();
    }

    // Mount page view
    this.contentMount.innerHTML = "";
    window.scrollTo({ top: 0, behavior: "instant" });

    let viewNode = null;
    if (route === "home") {
      viewNode = renderHomePage();
    } else if (route === "dashboard") {
      viewNode = renderDashboardPage();
    } else if (route === "live") {
      viewNode = renderLivePage();
    } else if (route === "reports") {
      viewNode = renderReportsPage();
    } else if (route === "settings") {
      viewNode = await renderSettingsPage();
    }

    if (viewNode) {
      this.contentMount.appendChild(viewNode);
    }
  }

  startTimers() {
    // 1. Clock Display (every second)
    const clockEl = document.getElementById("clock-display");
    const updateClock = () => {
      if (clockEl) {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString("en-US", { hour12: false });
      }
    };
    updateClock();
    this.clockInterval = setInterval(updateClock, 1000);

    // 2. Monitoring Session Duration Timer
    this.sessionTimerInterval = setInterval(() => {
      if (appState.isMonitoring && !appState.isPaused) {
        appState.sessionDurationSec++;
      }
    }, 1000);
  }

  onStateChange(changeType) {
    // Update sidebar badges and status indicator
    const dot = document.getElementById("sidebar-status-dot");
    const text = document.getElementById("sidebar-status-text");
    const modeBadge = document.getElementById("sidebar-mode-badge");

    if (dot && text) {
      if (appState.driverStatus === "ALERT") {
        dot.style.background = "var(--status-danger)";
        dot.style.boxShadow = "0 0 8px var(--status-danger)";
        text.textContent = "ALERT!";
      } else if (appState.driverStatus === "POSSIBLE DROWSINESS") {
        dot.style.background = "var(--status-warn)";
        dot.style.boxShadow = "0 0 8px var(--status-warn)";
        text.textContent = "Caution Warning";
      } else if (appState.driverStatus === "FACE NOT DETECTED") {
        dot.style.background = "var(--status-warn)";
        dot.style.boxShadow = "none";
        text.textContent = "Face Not Detected";
      } else if (appState.driverStatus === "CAMERA ERROR") {
        dot.style.background = "var(--status-danger)";
        dot.style.boxShadow = "none";
        text.textContent = "Camera Error";
      } else if (appState.isPaused) {
        dot.style.background = "var(--status-warn)";
        dot.style.boxShadow = "none";
        text.textContent = "Monitoring Paused";
      } else if (appState.isMonitoring) {
        dot.style.background = "var(--status-safe)";
        dot.style.boxShadow = "0 0 8px var(--status-safe)";
        text.textContent = "Monitoring Active";
      } else {
        dot.style.background = "var(--text-muted)";
        dot.style.boxShadow = "none";
        text.textContent = "System Standby";
      }
    }

    if (modeBadge) {
      modeBadge.textContent = appState.monitoringMode === "sample" ? "Sample" : "Hardware";
    }

    if (changeType === "page") {
      this.handleRouting();
    }
  }
}

// Bootstrap on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  const app = new Application();
  app.init();
});
