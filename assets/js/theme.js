import { $, $$ } from "./utils.js";
import { SITE_CONFIG } from "./config.js";

const STORAGE_KEY = "seven_theme";

export function getSavedTheme() {
  return localStorage.getItem(STORAGE_KEY) || SITE_CONFIG.defaultTheme;
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const headerLogo = $("#header-v7-logo");
  const footerLogo = $("#footer-logo");
  const isLight = theme === "light";

  if (headerLogo) {
    headerLogo.src = isLight
      ? "assets/img/v7/icon_120.png"
      : "assets/img/v7/icon_120.png";
  }

  if (footerLogo) {
    footerLogo.src = isLight
      ? "assets/img/logo/logo_dark.png"
      : "assets/img/logo/logo_light.png";
  }

  const adminV7 = $$(".admin-v7");
  adminV7.forEach((img) => {
    img.src = isLight
      ? "../assets/img/v7/icon_light.png"
      : "../assets/img/v7/icon_dark.png";
  });
}

export function toggleTheme() {
  const current = getSavedTheme();
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme(next);
}

export function initTheme() {
  applyTheme(getSavedTheme());
  const button = $("#theme-toggle");
  if (button) button.addEventListener("click", toggleTheme);
}
