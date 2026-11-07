
import { exportMusicaPdf } from "../pdf.js";

const FONT_KEY = "seven_musica_font";
const FOCUS_KEY = "seven_musica_focus";
const MUSIC_SCROLL_SPEED_KEY = "seven_musica_scroll_speed";
const MUSIC_SCROLL_VISIBLE_KEY = "seven_musica_scroll_visible";
const MUSIC_SCROLL_POS_KEY = "seven_musica_scroll_pos";

let scrollInterval = null;
let scrollSpeed = Number(localStorage.getItem(MUSIC_SCROLL_SPEED_KEY) || "0.35");
let scrollAccumulator = 0;

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
  panel.className = "scroll-bubble musica-scroll-bubble";
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

function getStoredScrollPanelPos() {
  try {
    return JSON.parse(localStorage.getItem(MUSIC_SCROLL_POS_KEY) || "null");
  } catch {
    return null;
  }
}

function saveScrollPanelPos(pos) {
  localStorage.setItem(MUSIC_SCROLL_POS_KEY, JSON.stringify(pos));
}

function isScrollPanelVisible() {
  return localStorage.getItem(MUSIC_SCROLL_VISIBLE_KEY) === "1";
}

function applyDefaultScrollPanelPos() {
  const bubble = $("#musica-scroll-bubble");
  if (!bubble) return;

  const anchor = document.getElementById("ver-cifra-link")?.closest(".page-cross-link") ||
                 document.getElementById("ver-cifra-link") ||
                 document.querySelector(".page-cross-link");

  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    const top = window.scrollY + rect.top - 6;
    const left = window.scrollX + rect.right + 14;
    const maxLeft = Math.max(8, window.scrollX + window.innerWidth - bubble.offsetWidth - 8);
    bubble.style.left = `${clamp(left, window.scrollX + 8, maxLeft)}px`;
    bubble.style.top = `${Math.max(window.scrollY + 8, top)}px`;
    bubble.style.right = "auto";
    bubble.style.bottom = "auto";
    return;
  }

  bubble.style.left = `${Math.max(16, (window.innerWidth - bubble.offsetWidth) / 2)}px`;
  bubble.style.top = `${Math.max(16, window.scrollY + 120)}px`;
  bubble.style.right = "auto";
  bubble.style.bottom = "auto";
}

function applyScrollPanelPos() {
  const bubble = $("#musica-scroll-bubble");
  if (!bubble) return;

  if (window.innerWidth <= 1024) {
    bubble.style.left = "";
    bubble.style.top = "";
    bubble.style.right = "";
    bubble.style.bottom = "";
    return;
  }

  const stored = getStoredScrollPanelPos();
  if (!stored || typeof stored.left !== "number" || typeof stored.top !== "number") {
    applyDefaultScrollPanelPos();
    return;
  }

  const maxLeft = Math.max(window.scrollX + 8, window.scrollX + window.innerWidth - bubble.offsetWidth - 8);
  const maxTop = Math.max(window.scrollY + 8, window.scrollY + window.innerHeight - bubble.offsetHeight - 8);
  bubble.style.left = `${clamp(stored.left, window.scrollX + 8, maxLeft)}px`;
  bubble.style.top = `${clamp(stored.top, window.scrollY + 8, maxTop)}px`;
  bubble.style.right = "auto";
  bubble.style.bottom = "auto";
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

  bubble.hidden = !visible;
  bubble.classList.toggle("is-hidden", !visible);
  bubble.classList.toggle("is-open", visible);
  bubble.setAttribute("aria-hidden", visible ? "false" : "true");
  localStorage.setItem(MUSIC_SCROLL_VISIBLE_KEY, visible ? "1" : "0");

  if (toggleBtn) toggleBtn.classList.toggle("is-active", visible);
  if (visible) requestAnimationFrame(() => applyScrollPanelPos());
  if (!visible) stopScroll();
}

function toggleScrollPanel() {
  setScrollPanelVisible(!isScrollPanelVisible());
}

function initScrollPanelDrag() {
  if (window.innerWidth <= 1024) return;
  const bubble = $("#musica-scroll-bubble");
  if (!bubble || bubble.dataset.dragReady === "1") return;
  bubble.dataset.dragReady = "1";

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const begin = (clientX, clientY) => {
    const rect = bubble.getBoundingClientRect();
    dragging = true;
    startX = clientX;
    startY = clientY;
    startLeft = rect.left + window.scrollX;
    startTop = rect.top + window.scrollY;
    bubble.classList.add("is-dragging");
    bubble.style.right = "auto";
    bubble.style.bottom = "auto";
    bubble.style.left = `${startLeft}px`;
    bubble.style.top = `${startTop}px`;
  };

  const move = (clientX, clientY) => {
    if (!dragging) return;
    const maxLeft = Math.max(window.scrollX + 8, window.scrollX + window.innerWidth - bubble.offsetWidth - 8);
    const maxTop = Math.max(window.scrollY + 8, window.scrollY + window.innerHeight - bubble.offsetHeight - 8);
    bubble.style.left = `${clamp(startLeft + (clientX - startX), window.scrollX + 8, maxLeft)}px`;
    bubble.style.top = `${clamp(startTop + (clientY - startY), window.scrollY + 8, maxTop)}px`;
  };

  const end = () => {
    if (!dragging) return;
    dragging = false;
    bubble.classList.remove("is-dragging");
    saveScrollPanelPos({
      left: parseFloat(bubble.style.left) || (bubble.getBoundingClientRect().left + window.scrollX),
      top: parseFloat(bubble.style.top) || (bubble.getBoundingClientRect().top + window.scrollY)
    });
  };

  bubble.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button,input")) return;
    event.preventDefault();
    begin(event.clientX, event.clientY);
  });

  window.addEventListener("pointermove", (event) => move(event.clientX, event.clientY));
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  window.addEventListener("resize", () => {
    if (isScrollPanelVisible()) applyScrollPanelPos();
  });
}

function initScrollPanelControls() {
  const slider = $("#musica-scroll-slider");
  if (slider) {
    slider.value = String(scrollSpeed);
    slider.addEventListener("input", () => {
      scrollSpeed = Number(slider.value || "0.35");
      localStorage.setItem(MUSIC_SCROLL_SPEED_KEY, String(scrollSpeed));
    });
  }

  $("#musica-scroll-panel-toggle")?.addEventListener("click", toggleScrollPanel);
  $("#musica-scroll-toggle")?.addEventListener("click", toggleScroll);
  $("#musica-scroll-bubble-close")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setScrollPanelVisible(false);
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
  const size = Number(localStorage.getItem(FONT_KEY) || "20") + 2;
  localStorage.setItem(FONT_KEY, String(size));
  applyFontStyles(size);
}

export function decreaseMusicaFont() {
  const size = Math.max(12, Number(localStorage.getItem(FONT_KEY) || "20") - 2);
  localStorage.setItem(FONT_KEY, String(size));
  applyFontStyles(size);
}

function applySavedFont() {
  const size = Number(localStorage.getItem(FONT_KEY) || "20");
  applyFontStyles(size);
}

export function toggleMusicaFocusMode() {
  document.body.classList.toggle("focus-mode");
  const active = document.body.classList.contains("focus-mode");
  localStorage.setItem(FOCUS_KEY, active ? "1" : "0");
  document.querySelector(".site-header")?.classList.toggle("hidden", active);
  document.querySelector(".site-footer")?.classList.toggle("hidden", active);
}

function applySavedFocus() {
  const active = localStorage.getItem(FOCUS_KEY) === "1";
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
  if (localStorage.getItem(MUSIC_SCROLL_VISIBLE_KEY) === null) {
    localStorage.setItem(MUSIC_SCROLL_VISIBLE_KEY, "0");
  }
  ensureMusicaControls();
  ensureMusicaScrollPanel();
  applySavedFont();
  applySavedFocus();
  initScrollPanelControls();
  initScrollPanelDrag();

  $("#musica-font-up")?.addEventListener("click", increaseMusicaFont);
  $("#musica-font-down")?.addEventListener("click", decreaseMusicaFont);
  $("#musica-focus-toggle")?.addEventListener("click", toggleMusicaFocusMode);
  $("#musica-fullscreen-toggle")?.addEventListener("click", toggleMusicaFullscreen);
  $("#musica-pdf-toggle")?.addEventListener("click", exportMusicaPdf);

  setScrollPanelVisible(window.innerWidth > 1024 && isScrollPanelVisible());
}
