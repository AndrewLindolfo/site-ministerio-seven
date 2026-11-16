
import { exportMusicaPdf } from "../pdf.js";

const FONT_KEY = "seven_musica_font";
const FOCUS_KEY = "seven_musica_focus";
const MUSIC_SCROLL_SPEED_KEY = "seven_musica_scroll_speed";
const MUSIC_SCROLL_VISIBLE_KEY = "seven_musica_scroll_visible";

let scrollInterval = null;
let scrollSpeed = readStoredNumber(MUSIC_SCROLL_SPEED_KEY, 0.35, 0.08, 1.2);
let scrollAccumulator = 0;

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function readStoredNumber(key, fallback, min, max) {
  const raw = readStorage(key);
  if (raw === null || raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

function $(selector) {
  return document.querySelector(selector);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getContent() {
  return $("#musica-letra") ||
         $(".musica-content") ||
         document.querySelector("article.musica-content") ||
         document.querySelector(".musica-page article");
}

function ensureMusicaControls() {
  if (document.getElementById("musica-top-controls")) return;

  const page = document.querySelector(".musica-page .container") ||
               document.querySelector(".musica-page section.container") ||
               document.querySelector("main.musica-page .container") ||
               document.querySelector("main .container");

  const anchor = document.getElementById("ver-cifra-link")?.closest(".page-cross-link") ||
                 document.querySelector(".page-cross-link") ||
                 document.getElementById("musica-meta");

  if (!page) return;

  const controls = document.createElement("div");
  controls.id = "musica-top-controls";
  controls.className = "musica-top-controls cifra-top-controls";
  controls.innerHTML = `
    <button type="button" id="musica-font-down">A-</button>
    <button type="button" id="musica-font-up">A+</button>
    <button type="button" id="musica-focus-toggle" aria-label="Modo foco">👁</button>
    <button type="button" id="musica-fullscreen-toggle" aria-label="Tela cheia">⛶</button>
    <button type="button" id="musica-scroll-panel-toggle" class="scroll-panel-toggle-btn" aria-label="Mostrar ou ocultar auto-rolamento" title="Mostrar ou ocultar auto-rolamento">
      <span class="scroll-panel-toggle-icon" aria-hidden="true"></span>
    </button>
    <button type="button" id="musica-pdf-toggle" class="pdf-modern-btn" aria-label="Baixar PDF" title="Baixar PDF">
      <span class="pdf-btn-icon">⤓</span>
      <span class="pdf-btn-label">PDF</span>
    </button>
  `;

  if (anchor) {
    anchor.insertAdjacentElement("afterend", controls);
  } else {
    const content = getContent();
    if (content && content.parentNode) {
      content.parentNode.insertBefore(controls, content);
    } else {
      page.appendChild(controls);
    }
  }
}

function ensureMusicaScrollPanel() {
  if (document.getElementById("musica-scroll-bubble")) return;
  const panel = document.createElement("div");
  panel.className = "scroll-bubble musica-scroll-bubble reading-scroll-panel";
  panel.id = "musica-scroll-bubble";
  panel.setAttribute("aria-hidden", "true");
  panel.hidden = true;
  panel.innerHTML = `
    <button type="button" id="musica-scroll-bubble-close" class="scroll-bubble-close" aria-label="Fechar auto-rolamento" title="Fechar auto-rolamento">✕</button>
    <button type="button" id="musica-scroll-toggle" aria-label="Iniciar ou pausar rolagem">▶</button>
    <input type="range" id="musica-scroll-slider" class="desktop-scroll-slider" min="0.08" max="1.20" step="0.01" aria-label="Velocidade da rolagem">
  `;
  document.body.appendChild(panel);
}

function isScrollPanelVisible() {
  return readStorage(MUSIC_SCROLL_VISIBLE_KEY) === "1";
}

function updateScrollButton(isRunning) {
  const btn = $("#musica-scroll-toggle");
  if (!btn) return;
  btn.dataset.state = isRunning ? "pause" : "play";
  btn.setAttribute("aria-label", isRunning ? "Pausar rolagem" : "Iniciar rolagem");
  btn.setAttribute("title", isRunning ? "Pausar rolagem" : "Iniciar rolagem");
  btn.textContent = isRunning ? "⏸" : "▶";
}

function reachedEnd() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  return window.scrollY >= maxScroll - 2;
}

function stopScroll() {
  if (scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
    scrollAccumulator = 0;
  }
  updateScrollButton(false);
}

function toggleScroll() {
  if (scrollInterval) {
    stopScroll();
    return;
  }

  scrollInterval = window.setInterval(() => {
    if (reachedEnd()) {
      stopScroll();
      return;
    }
    scrollAccumulator += scrollSpeed;
    const pixels = Math.floor(scrollAccumulator);
    if (pixels >= 1) {
      window.scrollBy({ top: pixels, left: 0, behavior: "auto" });
      scrollAccumulator -= pixels;
    }
  }, 20);

  updateScrollButton(true);
}

function setScrollPanelVisible(visible) {
  const bubble = $("#musica-scroll-bubble");
  const toggleBtn = $("#musica-scroll-panel-toggle");
  if (!bubble) return;

  const isVisible = Boolean(visible);
  bubble.hidden = !isVisible;
  bubble.classList.toggle("is-hidden", !isVisible);
  bubble.classList.toggle("is-open", isVisible);
  bubble.setAttribute("aria-hidden", isVisible ? "false" : "true");
  writeStorage(MUSIC_SCROLL_VISIBLE_KEY, isVisible ? "1" : "0");

  if (toggleBtn) {
    toggleBtn.classList.toggle("is-active", isVisible);
    toggleBtn.setAttribute("aria-expanded", isVisible ? "true" : "false");
  }
  if (!isVisible) stopScroll();
}

function toggleScrollPanel() {
  setScrollPanelVisible(!isScrollPanelVisible());
}

function initScrollPanelControls() {
  const slider = $("#musica-scroll-slider");
  if (slider) {
    slider.value = String(scrollSpeed);
    slider.addEventListener("input", () => {
      scrollSpeed = clamp(Number(slider.value || "0.35"), 0.08, 1.2);
      writeStorage(MUSIC_SCROLL_SPEED_KEY, String(scrollSpeed));
    });
  }

  $("#musica-scroll-panel-toggle")?.addEventListener("click", toggleScrollPanel);
  $("#musica-scroll-toggle")?.addEventListener("click", toggleScroll);
  $("#musica-scroll-bubble-close")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setScrollPanelVisible(false);
  });

  document.addEventListener("click", (event) => {
    const bubble = $("#musica-scroll-bubble");
    if (!bubble || bubble.hidden) return;
    if (event.target.closest("#musica-scroll-bubble, #musica-scroll-panel-toggle")) return;
    setScrollPanelVisible(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setScrollPanelVisible(false);
  });
}

function applyFontStyles(size) {
  const el = getContent();
  if (!el) return;

  el.style.fontSize = `${size}px`;
  el.style.lineHeight = "1.5";

  el.querySelectorAll("*").forEach((node) => {
    node.style.fontSize = "inherit";
    node.style.lineHeight = "inherit";
  });
}

export function increaseMusicaFont() {
  const size = Math.min(40, readStoredNumber(FONT_KEY, 20, 12, 40) + 2);
  writeStorage(FONT_KEY, String(size));
  applyFontStyles(size);
}

export function decreaseMusicaFont() {
  const size = Math.max(12, readStoredNumber(FONT_KEY, 20, 12, 40) - 2);
  writeStorage(FONT_KEY, String(size));
  applyFontStyles(size);
}

function applySavedFont() {
  const size = readStoredNumber(FONT_KEY, 20, 12, 40);
  applyFontStyles(size);
}

export function toggleMusicaFocusMode() {
  document.body.classList.toggle("focus-mode");
  const active = document.body.classList.contains("focus-mode");
  writeStorage(FOCUS_KEY, active ? "1" : "0");
  document.querySelector(".site-header")?.classList.toggle("hidden", active);
  document.querySelector(".site-footer")?.classList.toggle("hidden", active);
}

function applySavedFocus() {
  const active = readStorage(FOCUS_KEY) === "1";
  if (active) {
    document.body.classList.add("focus-mode");
    document.querySelector(".site-header")?.classList.add("hidden");
    document.querySelector(".site-footer")?.classList.add("hidden");
  }
}

export function toggleMusicaFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

export function initMusicaControls() {
  writeStorage(MUSIC_SCROLL_VISIBLE_KEY, "0");
  ensureMusicaControls();
  ensureMusicaScrollPanel();
  applySavedFont();
  applySavedFocus();
  initScrollPanelControls();

  $("#musica-font-up")?.addEventListener("click", increaseMusicaFont);
  $("#musica-font-down")?.addEventListener("click", decreaseMusicaFont);
  $("#musica-focus-toggle")?.addEventListener("click", toggleMusicaFocusMode);
  $("#musica-fullscreen-toggle")?.addEventListener("click", toggleMusicaFullscreen);
  $("#musica-pdf-toggle")?.addEventListener("click", exportMusicaPdf);

  setScrollPanelVisible(false);
}
