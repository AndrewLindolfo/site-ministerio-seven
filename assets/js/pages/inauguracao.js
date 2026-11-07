const LAUNCH_DATE = new Date("2026-03-26T19:00:00-04:00").getTime();
const REDIRECT_URL = "./index.html";

const diasEl = document.getElementById("dias");
const horasEl = document.getElementById("horas");
const minutosEl = document.getElementById("minutos");
const segundosEl = document.getElementById("segundos");
const statusEl = document.getElementById("countdown-status");
const countdownGrid = document.getElementById("countdown-grid");
const logoEl = document.getElementById("inauguracao-logo");
const footerLogoEl = document.getElementById("footer-logo");
const v7El = document.getElementById("header-v7-logo");
const themeToggle = document.getElementById("theme-toggle");
const footerYear = document.getElementById("footer-year");

function pad(value){ return String(value).padStart(2, "0"); }

function updateCountdown(){
  const now = Date.now();
  const diff = LAUNCH_DATE - now;
  if (diff <= 0){
    if (statusEl) statusEl.classList.remove("hidden");
    if (countdownGrid) countdownGrid.classList.add("hidden");
    window.setTimeout(() => window.location.replace(REDIRECT_URL), 1200);
    return;
  }
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutos = Math.floor((diff / (1000 * 60)) % 60);
  const segundos = Math.floor((diff / 1000) % 60);

  if (diasEl) diasEl.textContent = pad(dias);
  if (horasEl) horasEl.textContent = pad(horas);
  if (minutosEl) minutosEl.textContent = pad(minutos);
  if (segundosEl) segundosEl.textContent = pad(segundos);
}

function syncThemeAssets(){
  const theme = document.documentElement.getAttribute("data-theme") || "dark";

  // Using the filenames that exist in your /assets/img/v7 folder:
  // icon_dark.png and icon_light.png
  if (v7El) {
    v7El.src = theme === "dark"
      ? "assets/img/v7/icon_dark.png"
      : "assets/img/v7/icon_light.png";
  }

  // Using the filenames expected in /assets/img/logo/
  if (logoEl) {
    logoEl.src = theme === "dark"
      ? "assets/img/logo/logo_dark.png"
      : "assets/img/logo/logo_light.png";
  }

  if (footerLogoEl) {
    footerLogoEl.src = theme === "dark"
      ? "assets/img/logo/logo_dark.png"
      : "assets/img/logo/logo_light.png";
  }

  if (themeToggle) {
    themeToggle.textContent = theme === "dark" ? "🌙" : "☀️";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (footerYear) footerYear.textContent = String(new Date().getFullYear());

  try {
    const saved = localStorage.getItem("seven_theme");
    if (saved === "dark" || saved === "light") {
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }

  syncThemeAssets();
  updateCountdown();
  window.setInterval(updateCountdown, 1000);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("seven_theme", next); } catch (e) {}
      syncThemeAssets();
    });
  }
});
