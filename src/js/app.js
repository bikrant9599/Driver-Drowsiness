/* ==========================================================================
   APPLICATION CONTROLLER & ROUTER
   Simple 3-option navigation: Home, Live Monitoring, Session Summary
   ========================================================================== */

import { ICONS } from "./utils.js";
import { appState } from "./state.js";
import { visionEngine } from "./vision.js";

// 3 Primary Pages
import { renderHomePage } from "./pages/home.js";
import { renderLivePage } from "./pages/live.js";
import { renderSummaryPage } from "./pages/summary.js";

const PAGE_META = {
  home: { title: "Home", subtitle: "AI Driver Drowsiness Detection" },
  live: { title: "Live Monitoring", subtitle: "Real-time webcam attentiveness tracking" },
  summary: { title: "Session Summary", subtitle: "Monitoring duration and event timestamps" }
};

class Application {
  constructor() {
    this.root = document.getElementById("app-root");
    this.contentMount = null;
    this.sessionTimerInterval = null;
  }

  init() {
    // Apply saved theme
    document.documentElement.setAttribute("data-theme", appState.theme);

    // Render Shell Layout
    this.renderLayout();

    // Bind Global Hash Router
    window.addEventListener("hashchange", () => this.handleRouting());
    this.handleRouting();

    // Session Duration Timer
    this.startSessionTimer();

    // Subscribe to State Changes
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
            <span class="brand-name">AI Driver Drowsiness</span>
            <span class="brand-sub">Safety Telematics</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <a href="#home" class="nav-item" data-route="home">
            ${ICONS.home}
            <span>Home</span>
          </a>
          <a href="#live" class="nav-item" data-route="live">
            ${ICONS.eye}
            <span>Live Monitoring</span>
          </a>
          <a href="#summary" class="nav-item" data-route="summary">
            ${ICONS.reports}
            <span>Session Summary</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <button class="btn btn-secondary btn-sm" id="sidebar-theme-toggle" style="width: 100%;" title="Toggle Theme">
            ${appState.theme === 'dark' ? ICONS.sun : ICONS.moon}
            <span id="sidebar-theme-label">${appState.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
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
              <h1 class="page-title" id="page-header-title">Home</h1>
              <span class="page-subtitle" id="page-header-subtitle">AI Driver Drowsiness Detection</span>
            </div>
          </div>

          <div class="header-right">
            <button class="btn btn-secondary btn-icon" id="header-theme-toggle" title="Toggle Theme">
              ${appState.theme === 'dark' ? ICONS.sun : ICONS.moon}
            </button>
          </div>
        </header>

        <main class="main-content" id="main-content-mount"></main>
      </div>

      <!-- Mobile Bottom Navigation Bar: Only 3 primary items -->
      <nav class="mobile-bottom-nav">
        <a href="#home" class="mobile-nav-link" data-route="home">
          ${ICONS.home}
          <span>Home</span>
        </a>
        <a href="#live" class="mobile-nav-link" data-route="live">
          ${ICONS.eye}
          <span>Live</span>
        </a>
        <a href="#summary" class="mobile-nav-link" data-route="summary">
          ${ICONS.reports}
          <span>Summary</span>
        </a>
      </nav>
    `;

    this.contentMount = document.getElementById("main-content-mount");

    // Theme Toggle Handler
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
        <span id="sidebar-theme-label">${isDark ? 'Light Mode' : 'Dark Mode'}</span>
      `;
    }
  }

  handleRouting() {
    let rawRoute = window.location.hash.replace("#", "").toLowerCase() || "home";

    let route = rawRoute;
    if (route === "dashboard") route = "home";
    if (route === "reports") route = "summary";
    if (route === "settings") route = "home";

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
    const headerTitle = document.getElementById("page-header-title");
    const headerSubtitle = document.getElementById("page-header-subtitle");
    if (headerTitle) headerTitle.textContent = meta.title;
    if (headerSubtitle) headerSubtitle.textContent = meta.subtitle;

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
    } else if (route === "live") {
      viewNode = renderLivePage();
    } else if (route === "summary") {
      viewNode = renderSummaryPage();
    }

    if (viewNode) {
      this.contentMount.appendChild(viewNode);
    }
  }

  startSessionTimer() {
    this.sessionTimerInterval = setInterval(() => {
      if (appState.isMonitoring) {
        appState.sessionDurationSec++;
      }
    }, 1000);
  }

  onStateChange(changeType) {
    if (changeType === "page") {
      this.handleRouting();
    }
  }
}

// Bootstrap on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  const app = new Application();
  app.init();

  const handleUnexpectedTermination = () => {
    if (appState.isMonitoring && !appState.sessionSaved) {
      appState.stopSession();
    }
  };
  window.addEventListener("beforeunload", handleUnexpectedTermination);
  window.addEventListener("pagehide", handleUnexpectedTermination);
});
