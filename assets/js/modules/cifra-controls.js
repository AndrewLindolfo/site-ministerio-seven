import { transposeText, transposeKeyLabel } from "./cifra-formatter.js";
import { exportCifraPdf } from "../pdf.js";

const FONT_KEY = "seven_cifra_font";
const SPEED_KEY = "seven_scroll_speed";
const FOCUS_KEY = "seven_focus_mode";
const TRANSPOSE_KEY = "seven_transpose_amount";
const SCROLL_PANEL_VISIBLE_KEY = "seven_scroll_panel_visible";
const SCROLL_PANEL_POS_KEY = "seven_scroll_panel_pos";

const SPEED_STEPS = [0.08, 0.18, 0.35, 0.7, 1.2];

let scrollInterval = null;
let scrollSpeed = Number(localStorage.getItem(SPEED_KEY) || "0.35");
let scrollAccumulator = 0;

function $(selector) {
  return document.querySelector(selector);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeDisplayedTom(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return raw;
  const upper = raw.toUpperCase();
  const weirdMinor = upper.match(/^([A-G])([B#])M$/);
  if (weirdMinor) {
    const accidental = weirdMinor[2] === "B" ? "b" : "#";
    return `${weirdMinor[1]}${accidental}m`;
  }
  const flatAlias = raw.match(/^([A-G])d$/i);
  if (flatAlias) return `${flatAlias[1].toUpperCase()}b`;
  return raw;
}

function getTransposeAmount() {
  return Number(localStorage.getItem(TRANSPOSE_KEY) || "0");
}

function setTransposeAmount(value) {
  localStorage.setItem(TRANSPOSE_KEY, String(value));
}

function getStoredScrollPanelPos() {
  try {
    return JSON.parse(localStorage.getItem(SCROLL_PANEL_POS_KEY) || "null");
  } catch {
    return null;
  }
}

function saveScrollPanelPos(pos) {
  localStorage.setItem(SCROLL_PANEL_POS_KEY, JSON.stringify(pos));
}

function isScrollPanelVisible() {
  return localStorage.getItem(SCROLL_PANEL_VISIBLE_KEY) === "1";
}

function nearestSpeedIndex(value) {
  let idx = 0;
  let diff = Infinity;
  SPEED_STEPS.forEach((step, i) => {
    const d = Math.abs(step - value);
    if (d < diff) {
      diff = d;
      idx = i;
    }
  });
  return idx;
}

function applyScrollPanelPos() {
  const bubble = $("#scroll-bubble");
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
    const anchor = document.getElementById("ver-letra-link")?.closest(".page-cross-link") ||
                   document.getElementById("ver-letra-link") ||
                   document.querySelector(".page-cross-link");
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const top = window.scrollY + rect.top - 6;
      const left = window.scrollX + rect.right + 14;
      const maxLeft = Math.max(window.scrollX + 8, window.scrollX + window.innerWidth - bubble.offsetWidth - 8);
      bubble.style.left = `${clamp(left, window.scrollX + 8, maxLeft)}px`;
      bubble.style.top = `${Math.max(window.scrollY + 8, top)}px`;
      bubble.style.right = "auto";
      bubble.style.bottom = "auto";
      return;
    }
    bubble.style.left = `${Math.max(16, window.scrollX + ((window.innerWidth - bubble.offsetWidth) / 2))}px`;
    bubble.style.top = `${Math.max(window.scrollY + 16, window.scrollY + 120)}px`;
    bubble.style.right = "auto";
    bubble.style.bottom = "auto";
    return;
  }

  const maxLeft = Math.max(4, window.innerWidth - bubble.offsetWidth - 4);
  const maxTop = Math.max(4, window.innerHeight - bubble.offsetHeight - 4);

  bubble.style.left = `${clamp(stored.left, 4, maxLeft)}px`;
  bubble.style.top = `${clamp(stored.top, 4, maxTop)}px`;
  bubble.style.right = "auto";
  bubble.style.bottom = "auto";
}

function setScrollPanelVisible(visible) {
  const bubble = $("#scroll-bubble");
  const toggleBtn = $("#scroll-panel-toggle");
  if (!bubble) return;

  bubble.hidden = !visible;
  bubble.classList.toggle("is-hidden", !visible);
  bubble.classList.toggle("is-open", visible);
  bubble.setAttribute("aria-hidden", visible ? "false" : "true");
  localStorage.setItem(SCROLL_PANEL_VISIBLE_KEY, visible ? "1" : "0");

  if (toggleBtn) toggleBtn.classList.toggle("is-active", visible);
  if (visible) requestAnimationFrame(() => applyScrollPanelPos());
  requestAnimationFrame(() => {
    const controls = $(".cifra-top-controls");
    if (controls && window.innerWidth <= 1024) {
      controls.classList.remove("controls-hidden");
    }
  });

  if (!visible && scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
    scrollAccumulator = 0;
    updateScrollButton(false);
  }
}

function toggleScrollPanel() {
  setScrollPanelVisible(!isScrollPanelVisible());
}

function initScrollPanelDrag() {
  if (window.innerWidth <= 1024) return;
  const bubble = $("#scroll-bubble");
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
    startLeft = rect.left;
    startTop = rect.top;
    bubble.classList.add("is-dragging");
    bubble.style.right = "auto";
    bubble.style.bottom = "auto";
    bubble.style.left = `${rect.left}px`;
    bubble.style.top = `${rect.top}px`;
  };

  const move = (clientX, clientY) => {
    if (!dragging) return;
    const maxLeft = Math.max(4, window.innerWidth - bubble.offsetWidth - 4);
    const maxTop = Math.max(4, window.innerHeight - bubble.offsetHeight - 4);
    bubble.style.left = `${clamp(startLeft + (clientX - startX), 4, maxLeft)}px`;
    bubble.style.top = `${clamp(startTop + (clientY - startY), 4, maxTop)}px`;
  };

  const end = () => {
    if (!dragging) return;
    dragging = false;
    bubble.classList.remove("is-dragging");
    saveScrollPanelPos({
      left: parseFloat(bubble.style.left) || bubble.getBoundingClientRect().left,
      top: parseFloat(bubble.style.top) || bubble.getBoundingClientRect().top
    });
  };

  bubble.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    event.preventDefault();
    begin(event.clientX, event.clientY);
  });

  window.addEventListener("pointermove", (event) => move(event.clientX, event.clientY));
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);

  window.addEventListener("resize", () => {
    initMobileScrollBar();
    initResponsiveControlsAutoHide();
    if (isScrollPanelVisible()) applyScrollPanelPos();
  });
}

function ensureOriginalResetAction() {
  const meta = $("#cifra-meta");
  if (!meta) return;
  const originalValue = meta.dataset.originalTom || "";
  const target = meta.querySelector(".meta-original");
  if (!target) return;

  target.style.cursor = "pointer";
  target.title = `Voltar ao tom original (${originalValue})`;
  target.setAttribute("role", "button");
  target.setAttribute("tabindex", "0");

  if (target.dataset.boundOriginalReset === "1") return;
  target.dataset.boundOriginalReset = "1";

  const reset = () => {
    setTransposeAmount(0);
    rerenderPublicCifra();
  };

  target.addEventListener("click", reset);
  target.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      reset();
    }
  });
}

function renderMeta(meta, currentTom, originalTom, capo, bpm) {
  const parts = [];
  if (currentTom) parts.push(`<span class="meta-item meta-tom">Tom: <strong id="tom-atual">${currentTom}</strong></span>`);
  if (originalTom) parts.push(`<span class="meta-item meta-original">Original: <strong id="tom-original" data-tom="${originalTom}">${originalTom}</strong></span>`);
  if (capo) parts.push(`<span class="meta-item meta-capo">Capotraste: <strong>${capo}</strong></span>`);
  if (bpm) parts.push(`<span class="meta-item meta-bpm">BPM: <strong>${bpm}</strong></span>`);
  meta.innerHTML = parts.join(`<span class="meta-separator" aria-hidden="true"> | </span>`);
  ensureOriginalResetAction();
}

function ensureDesktopSpeedSlider() {
  const bubble = $("#scroll-bubble");
  if (!bubble) return null;
  let slider = document.getElementById("scroll-speed-slider");
  if (!slider) {
    slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0.08";
    slider.max = "1.20";
    slider.step = "0.01";
    slider.id = "scroll-speed-slider";
    slider.className = "desktop-scroll-slider";
    slider.setAttribute("aria-label", "Velocidade da rolagem");
    const toggleBtn = $("#scroll-toggle");
    if (toggleBtn) bubble.insertBefore(slider, toggleBtn.nextSibling);
    else bubble.appendChild(slider);
    slider.addEventListener("input", () => {
      scrollSpeed = Number(slider.value || "0.35");
      localStorage.setItem(SPEED_KEY, String(scrollSpeed));
    });
  }
  return slider;
}

function updateSpeedIndicator() {
  const desktopSlider = ensureDesktopSpeedSlider();
  if (desktopSlider) desktopSlider.value = String(scrollSpeed);

  const mobileSlider = $("#scroll-bubble .mobile-scroll-slider");
  if (mobileSlider) mobileSlider.value = String(scrollSpeed);
}

function updateScrollButton(isRunning) {
  const btn = $("#scroll-toggle");
  if (!btn) return;
  btn.dataset.state = isRunning ? "pause" : "play";
  btn.setAttribute("aria-label", isRunning ? "Pausar rolagem" : "Iniciar rolagem");
  btn.setAttribute("title", isRunning ? "Pausar rolagem" : "Iniciar rolagem");
  btn.textContent = isRunning ? "⏸" : "▶";
}

function initMobileScrollBar() {
  const bubble = $("#scroll-bubble");
  if (!bubble) return;

  const isMobileOrTablet = window.innerWidth <= 1024;
  bubble.classList.toggle("is-mobile-scroll-bar", isMobileOrTablet);

  let slider = bubble.querySelector(".mobile-scroll-slider");
  if (!slider) {
    slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0.08";
    slider.max = "1.20";
    slider.step = "0.01";
    slider.className = "mobile-scroll-slider";
    slider.setAttribute("aria-label", "Velocidade da rolagem");
    const toggleBtn = $("#scroll-toggle");
    if (toggleBtn) bubble.insertBefore(slider, toggleBtn);
    else bubble.appendChild(slider);

    slider.addEventListener("input", () => {
      scrollSpeed = Number(slider.value || "0.35");
      localStorage.setItem(SPEED_KEY, String(scrollSpeed));
      updateSpeedIndicator();
    });
  }

  slider.value = String(scrollSpeed);
  ensureDesktopSpeedSlider();
}

function initResponsiveControlsAutoHide() {
  const controls = $(".cifra-top-controls");
  if (!controls || controls.dataset.autoHideReady === "1") return;
  controls.dataset.autoHideReady = "1";

  let lastY = window.scrollY || 0;
  let ticking = false;
  const MOBILE_MAX = 1024;
  const DELTA = 10;

  const apply = () => {
    ticking = false;
    const isMobileOrTablet = window.innerWidth <= MOBILE_MAX;
    const scrollPanelOpen = isScrollPanelVisible();

    if (!isMobileOrTablet) {
      controls.classList.remove("controls-hidden");
      lastY = window.scrollY || 0;
      return;
    }

    if (scrollPanelOpen) {
      controls.classList.remove("controls-hidden");
      lastY = window.scrollY || 0;
      return;
    }

    const currentY = window.scrollY || 0;
    const diff = currentY - lastY;

    if (currentY <= 12) {
      controls.classList.remove("controls-hidden");
    } else if (diff > DELTA) {
      controls.classList.add("controls-hidden");
      lastY = currentY;
      return;
    } else if (diff < -DELTA) {
      controls.classList.remove("controls-hidden");
      lastY = currentY;
      return;
    }

    lastY = currentY;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(apply);
    }
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (window.innerWidth > MOBILE_MAX) {
      controls.classList.remove("controls-hidden");
    } else {
      apply();
    }
  }, { passive: true });

  apply();
}



const CHORD_TOKEN_REGEX = /^[A-G](?:#|b)?(?:(?:maj|min|m|sus|dim|aug|add|mmaj)?(?:2|4|5|6|7|7M|9|11|13)?(?:sus2|sus4|add2|add4|add9|maj7|maj9|maj11|maj13|m7|m9|m11|m13|dim7|aug7|7M)?(?:\([^)]+\))?)?(?:\/[A-G](?:#|b)?)?$/i;
const INTRO_LINE_REGEX = /^\s*\[Intro\]\s*$/i;
const INTRO_WITH_CHORDS_REGEX = /^\s*\[Intro\]\s+/i;

function cleanChordToken(token = "") {
  return String(token || "")
    .trim()
    .replace(/^[\[(\{'"`]+/, "")
    .replace(/[\])\}'"`.,;:!?]+$/, "");
}

function isChordTokenForStyle(token = "") {
  return CHORD_TOKEN_REGEX.test(cleanChordToken(token));
}

function isChordOnlyLineForStyle(text = "") {
  const tokens = String(text || "")
    .trim()
    .split(/\s+/)
    .map(cleanChordToken)
    .filter(Boolean);
  if (!tokens.length) return false;
  return tokens.every(isChordTokenForStyle);
}

function wrapTokensInTextNode(node) {
  const text = node.nodeValue || "";
  if (!text.trim()) return;
  const parts = text.split(/(\s+)/);
  let changed = false;
  const frag = document.createDocumentFragment();
  for (const part of parts) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      frag.appendChild(document.createTextNode(part));
      continue;
    }
    if (isChordTokenForStyle(part)) {
      const span = document.createElement('span');
      span.className = 'chord-token';
      span.textContent = part;
      frag.appendChild(span);
      changed = true;
    } else {
      frag.appendChild(document.createTextNode(part));
    }
  }
  if (changed) node.replaceWith(frag);
}

function applyChordTokensToInlineHtml(html = "") {
  const wrapper = document.createElement('span');
  wrapper.innerHTML = html;
  const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let current;
  while ((current = walker.nextNode())) nodes.push(current);
  nodes.forEach(wrapTokensInTextNode);
  return wrapper.innerHTML;
}

function richHtmlToLineSegments(html = "") {
  let normalized = String(html || "")
    .replace(/\r\n?/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<\/div>\s*<div[^>]*>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "")
    .replace(/<div[^>]*>/gi, "")
    .replace(/<\/div>/gi, "");
  return normalized.split("\n");
}

function wrapChordLinesInHtml(html = "") {
  const lines = richHtmlToLineSegments(html);
  let introBlockRemaining = 0;
  return lines.map((segmentHtml) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = segmentHtml;
    const text = String(tmp.textContent || '').replace(/\u00A0/g, ' ');
    const trimmed = text.trim();
    let shouldProcess = false;
    if (INTRO_LINE_REGEX.test(trimmed)) {
      introBlockRemaining = 4;
    } else if (INTRO_WITH_CHORDS_REGEX.test(trimmed)) {
      shouldProcess = true;
      introBlockRemaining = 4;
    } else if (introBlockRemaining > 0) {
      if (isChordOnlyLineForStyle(trimmed)) {
        shouldProcess = true;
        introBlockRemaining -= 1;
      } else {
        introBlockRemaining = 0;
      }
    } else if (isChordOnlyLineForStyle(trimmed)) {
      shouldProcess = true;
    }
    return shouldProcess ? applyChordTokensToInlineHtml(segmentHtml) : segmentHtml;
  }).join('<br>');
}

function applyChordStylesAfterRender(content) {
  if (!content) return;
  const chordColor = content.dataset.chordColorValue || '';
  if (chordColor) content.style.setProperty('--seven-chord-color', chordColor);
  else content.style.removeProperty('--seven-chord-color');
}

function transposeRichHtml(html = "", steps = 0) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let current;
  while ((current = walker.nextNode())) textNodes.push(current);
  textNodes.forEach((node) => {
    node.nodeValue = transposeText(node.nodeValue || "", steps);
  });
  return wrapChordLinesInHtml(wrapper.innerHTML);
}

export function setOriginalMetaTom(originalTom = "C", capo = "", bpm = "") {
  const meta = $("#cifra-meta");
  if (!meta) return;
  const normalizedOriginalTom = normalizeDisplayedTom(originalTom);
  meta.dataset.originalTom = normalizedOriginalTom;
  meta.dataset.capo = capo;
  meta.dataset.bpm = bpm;
  meta.dataset.currentTom = normalizedOriginalTom;
  renderMeta(meta, normalizedOriginalTom, normalizedOriginalTom, capo, bpm);
}

export function rerenderPublicCifra() {
  const meta = $("#cifra-meta");
  const content = $("#cifra-content");
  if (!meta || !content) return;

  const originalTom = normalizeDisplayedTom(meta.dataset.originalTom || "");
  const capo = meta.dataset.capo || "";
  const bpm = meta.dataset.bpm || "";
  const originalText = content.dataset.originalText || content.textContent || "";
  const originalHtml = content.dataset.originalHtml || "";
  const steps = getTransposeAmount();
  const currentTom = originalTom ? transposeKeyLabel(originalTom, steps) : originalTom;

  if (originalHtml) {
    content.innerHTML = transposeRichHtml(originalHtml, steps);
  } else {
    content.textContent = transposeText(originalText, steps);
  }
  applyChordStylesAfterRender(content);

  meta.dataset.currentTom = currentTom;
  renderMeta(meta, currentTom, originalTom, capo, bpm);
}


export function increaseFont() {
  const content = $("#cifra-content");
  if (!content) return;
  const next = Number(localStorage.getItem(FONT_KEY) || "18") + 1;
  localStorage.setItem(FONT_KEY, String(next));
  content.style.fontSize = `${next}px`;
}

export function decreaseFont() {
  const content = $("#cifra-content");
  if (!content) return;
  const next = Math.max(12, Number(localStorage.getItem(FONT_KEY) || "18") - 1);
  localStorage.setItem(FONT_KEY, String(next));
  content.style.fontSize = `${next}px`;
}

function applySavedFont() {
  const content = $("#cifra-content");
  if (!content) return;
  const current = Number(localStorage.getItem(FONT_KEY) || "18");
  content.style.fontSize = `${current}px`;
}

export function toggleFocusMode() {
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

export function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

export function transposeSemitone(step = 1) {
  const next = getTransposeAmount() + step;
  setTransposeAmount(next);
  rerenderPublicCifra();
}

export function changeSpeed(delta = 1) {
  const idx = nearestSpeedIndex(scrollSpeed);
  const nextIdx = Math.max(0, Math.min(SPEED_STEPS.length - 1, idx + delta));
  scrollSpeed = SPEED_STEPS[nextIdx];
  localStorage.setItem(SPEED_KEY, String(scrollSpeed));
  updateSpeedIndicator();
}

function reachedEnd() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  return window.scrollY >= maxScroll - 2;
}

export function toggleScroll() {
  if (scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
    scrollAccumulator = 0;
    updateScrollButton(false);
    return;
  }

  scrollInterval = window.setInterval(() => {
    if (reachedEnd()) {
      clearInterval(scrollInterval);
      scrollInterval = null;
      scrollAccumulator = 0;
      updateScrollButton(false);
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

export function initCifraControls() {
  if (localStorage.getItem(SCROLL_PANEL_VISIBLE_KEY) === null) {
    localStorage.setItem(SCROLL_PANEL_VISIBLE_KEY, "0");
  }

  initMobileScrollBar();
  initScrollPanelDrag();
  initResponsiveControlsAutoHide();
  applySavedFont();
  applySavedFocus();
  rerenderPublicCifra();

  $("#transpose-up")?.addEventListener("click", () => transposeSemitone(1));
  $("#transpose-down")?.addEventListener("click", () => transposeSemitone(-1));
  $("#font-up")?.addEventListener("click", increaseFont);
  $("#font-down")?.addEventListener("click", decreaseFont);
  $("#focus-toggle")?.addEventListener("click", toggleFocusMode);
  $("#fullscreen-toggle")?.addEventListener("click", toggleFullscreen);
  $("#scroll-panel-toggle")?.addEventListener("click", toggleScrollPanel);
  $("#pdf-toggle")?.addEventListener("click", exportCifraPdf);
  $("#scroll-toggle")?.addEventListener("click", toggleScroll);
  $("#scroll-bubble-close")?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); setScrollPanelVisible(false); });

  updateScrollButton(false);
  updateSpeedIndicator();
  if (window.innerWidth <= 1024) {
    setScrollPanelVisible(false);
  } else {
    setScrollPanelVisible(isScrollPanelVisible());
  }
}

