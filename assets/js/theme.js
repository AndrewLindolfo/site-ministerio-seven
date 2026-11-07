import { $ } from "./utils.js";
import { SITE_CONFIG } from "./config.js";

const STORAGE_KEY = "seven_theme";

export function getSavedTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : SITE_CONFIG.defaultTheme;
  } catch {
    return SITE_CONFIG.defaultTheme;
  }
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
}

export function toggleTheme() {
  const current = getSavedTheme();
  const next = current === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {}
  applyTheme(next);
}

export function initTheme() {
  applyTheme(getSavedTheme());
  const button = $("#theme-toggle");
  if (button) button.addEventListener("click", toggleTheme);
}
