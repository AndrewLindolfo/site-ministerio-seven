
import { getCifraBySlug, getCifra, listCifras, listCifrasBySlug, getInstrumentLabel, normalizeInstrument, updateCifraMetronome } from "../services/cifras-service.js";
import { getMusica } from "../services/musicas-service.js";
import { watchDocument } from "../db.js";
import { getQueryParam } from "../utils.js";
import { initCifraControls, setOriginalMetaTom } from "../modules/cifra-controls.js";
import { watchAuth, getAdminProfileByEmail } from "../auth.js";
import { bindChordInteractions } from "../modules/chord-interactive.js";
import { createPersonalButtons, refreshPersonalActionButtons } from "../modules/personal-actions.js";

const CHORD_TOKEN_REGEX = /^[A-G](?:#|b)?(?:(?:maj|min|m|sus|dim|aug|add|mmaj)?(?:2|4|5|6|7|7M|9|11|13)?(?:sus2|sus4|add2|add4|add9|maj7|maj9|maj11|maj13|m7|m9|m11|m13|dim7|aug7|7M)?(?:\([^)]+\))?)?(?:\/[A-G](?:#|b)?)?$/i;
const INTRO_LINE_REGEX = /^\s*\[Intro\]\s*$/i;
const INTRO_WITH_CHORDS_REGEX = /^\s*\[Intro\]\s+/i;
const CHORD_COLOR_MAP = {
  padrao: "#FF5C00",
  preto: "#0d0d0d",
  azul: "#3b82f6",
  vermelho: "#ef4444",
  verde: "#22c55e",
  amarelo: "#eab308",
  roxo: "#a855f7",
  laranja: "#FF5C00"
};

function renderPersonalActionsForCifra(cifra) {
  const titleEl = document.getElementById("cifra-titulo");
  if (!titleEl || !cifra?.slug) return;

  let row = document.getElementById("cifra-title-row");
  if (!row) {
    row = document.createElement("div");
    row.id = "cifra-title-row";
    row.className = "page-title-row";
    titleEl.insertAdjacentElement("beforebegin", row);
    row.appendChild(titleEl);
  }

  let wrap = document.getElementById("cifra-title-actions");
  if (!wrap) {
    wrap = document.createElement("span");
    wrap.id = "cifra-title-actions";
    wrap.className = "personal-action-group";
    row.appendChild(wrap);
  }

  wrap.innerHTML = createPersonalButtons({
    type: "cifra",
    title: cifra.title || "",
    href: `./cifra.html?slug=${encodeURIComponent(cifra.slug)}${cifra.instrumento ? `&instrumento=${encodeURIComponent(cifra.instrumento)}` : ""}`,
    slug: cifra.slug || "",
    instrument: cifra.instrumento || ""
  });
  refreshPersonalActionButtons(titleEl.closest(".container") || document);
}

function stripHtmlToPlainText(html = "") {
  const tmp = document.createElement("div");
  tmp.innerHTML = String(html || "").replace(/\u00A0/g, " ");
  return (tmp.innerText || tmp.textContent || "").replace(/\r\n?/g, "\n");
}

function cleanToken(token = "") {
  return String(token || "")
    .trim()
    .replace(/^[\[(\{'"`]+/, "")
    .replace(/[\])\}'"`.,;:!?]+$/, "");
}

function isChordToken(token = "") {
  return CHORD_TOKEN_REGEX.test(cleanToken(token));
}

function isChordOnlyLine(text = "") {
  const tokens = String(text || "")
    .trim()
    .split(/\s+/)
    .map(cleanToken)
    .filter(Boolean);
  if (!tokens.length) return false;
  return tokens.every(isChordToken);
}

function resolveChordColor(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return CHORD_COLOR_MAP.padrao;
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return raw;
  const normalized = raw.toLowerCase();
  return CHORD_COLOR_MAP[normalized] || CHORD_COLOR_MAP.padrao;
}

function applyChordColor(cifra = {}) {
  const contentEl = document.getElementById("cifra-content");
  if (!contentEl) return;
  const resolved = resolveChordColor(cifra.chordColor || "padrao");
  contentEl.dataset.chordColorValue = resolved;
  contentEl.style.setProperty("--seven-chord-color", resolved);
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
    if (isChordToken(part)) {
      const span = document.createElement('span');
      span.className = 'chord-token';
      span.textContent = part;
      span.dataset.chordSymbol = cleanToken(part);
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

function wrapChordLinesFromHtml(html = "") {
  const lines = richHtmlToLineSegments(html);
  let introBlockRemaining = 0;

  return lines.map((segmentHtml) => {
    const text = stripHtmlToPlainText(segmentHtml);
    const trimmed = text.trim();
    let shouldProcess = false;

    if (INTRO_LINE_REGEX.test(trimmed)) {
      introBlockRemaining = 4;
    } else if (INTRO_WITH_CHORDS_REGEX.test(trimmed)) {
      shouldProcess = true;
      introBlockRemaining = 4;
    } else if (introBlockRemaining > 0) {
      if (isChordOnlyLine(trimmed)) {
        shouldProcess = true;
        introBlockRemaining -= 1;
      } else {
        introBlockRemaining = 0;
      }
    } else if (isChordOnlyLine(trimmed)) {
      shouldProcess = true;
    }

    return shouldProcess ? applyChordTokensToInlineHtml(segmentHtml) : segmentHtml;
  }).join("<br>");
}

function wrapChordLinesFromPlainText(text = "") {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  let introBlockRemaining = 0;

  return lines.map((line) => {
    const trimmed = line.trim();
    let shouldProcess = false;

    if (INTRO_LINE_REGEX.test(trimmed)) {
      introBlockRemaining = 4;
    } else if (INTRO_WITH_CHORDS_REGEX.test(trimmed)) {
      shouldProcess = true;
      introBlockRemaining = 4;
    } else if (introBlockRemaining > 0) {
      if (isChordOnlyLine(trimmed)) {
        shouldProcess = true;
        introBlockRemaining -= 1;
      } else {
        introBlockRemaining = 0;
      }
    } else if (isChordOnlyLine(trimmed)) {
      shouldProcess = true;
    }

    const safe = line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/ /g, "&nbsp;");

    return shouldProcess ? applyChordTokensToInlineHtml(safe) : safe;
  }).join("<br>");
}

function ensurePrevNextNav() {
  let nav = document.querySelector(".prev-next-nav");
  if (nav) return nav;
  const container = document.querySelector(".cifra-page .container") || document.querySelector("main .container");
  if (!container) return null;
  nav = document.createElement("nav");
  nav.className = "prev-next-nav";
  container.appendChild(nav);
  return nav;
}

function renderPrevNext(currentSlug = "", currentInstrument = "", items = []) {
  const nav = ensurePrevNextNav();
  if (!nav || !items.length) return;
  const currentIndex = items.findIndex((item) => String(item.slug || "") === String(currentSlug || ""));
  if (currentIndex === -1) {
    nav.innerHTML = "";
    return;
  }
  const previous = currentIndex > 0 ? items[currentIndex - 1] : null;
  const next = currentIndex < items.length - 1 ? items[currentIndex + 1] : null;
  const suffix = currentInstrument ? `&instrumento=${encodeURIComponent(currentInstrument)}` : "";
  nav.innerHTML = `
    ${previous ? `<a href="./cifra.html?slug=${previous.slug}${suffix}" class="prev-link">← Anterior</a>` : `<span class="prev-link is-disabled">← Anterior</span>`}
    <span class="nav-divider"> | </span>
    ${next ? `<a href="./cifra.html?slug=${next.slug}${suffix}" class="next-link">Próxima →</a>` : `<span class="next-link is-disabled">Próxima →</span>`}
  `;
  nav.querySelectorAll('.is-disabled').forEach((el) => {
    el.style.opacity = '.45';
    el.style.pointerEvents = 'none';
  });
}

function renderInstrumentSelector(currentInstrument = "violao", options = [], currentSlug = "") {
  const wrapper = document.getElementById("cifra-instrument-switcher");
  const button = document.getElementById("cifra-instrument-current");
  const menu = document.getElementById("cifra-instrument-menu");
  if (!wrapper || !button || !menu) return;

  const normalizedCurrent = normalizeInstrument(currentInstrument || "violao");
  const unique = Array.from(new Map(options.map((item) => [normalizeInstrument(item.instrumento || "violao"), item])).values());
  button.textContent = getInstrumentLabel(normalizedCurrent);

  if (unique.length <= 1) {
    wrapper.classList.remove("hidden");
    button.classList.add("is-single");
    button.disabled = true;
    button.setAttribute("aria-expanded", "false");
    menu.classList.add("hidden");
    menu.innerHTML = "";
    return;
  }

  wrapper.classList.remove("hidden");
  button.classList.remove("is-single");
  button.disabled = false;
  menu.innerHTML = unique.map((item) => {
    const instrument = normalizeInstrument(item.instrumento || "violao");
    const activeClass = instrument === normalizedCurrent ? " is-active" : "";
    return `<a class="cifra-instrument-option${activeClass}" href="./cifra.html?slug=${encodeURIComponent(currentSlug)}&instrumento=${encodeURIComponent(instrument)}">${getInstrumentLabel(instrument)}</a>`;
  }).join("");

  const closeMenu = () => { menu.classList.add('hidden'); button.setAttribute('aria-expanded','false'); };
  button.onclick = (e) => { e.preventDefault(); const open = menu.classList.toggle('hidden'); button.setAttribute('aria-expanded', open ? 'false':'true'); };
  if (!wrapper.dataset.outsideBound) {
    document.addEventListener('click', (event) => { if (!wrapper.contains(event.target)) closeMenu(); }, { passive: true });
    wrapper.dataset.outsideBound = 'true';
  }
}



function annotateInteractiveChordTokens() {
  const contentEl = document.getElementById("cifra-content");
  if (!contentEl) return;
  contentEl.querySelectorAll(".chord-token").forEach((node) => {
    const symbol = cleanToken(node.dataset.chordSymbol || node.dataset.chordSymbol || node.textContent || "");
    if (!symbol) return;
    node.dataset.chordSymbol = symbol;
    node.setAttribute("data-chord-symbol", symbol);
  });
}

let currentInteractiveInstrument = "violao";
let interactiveChordObserver = null;

function bindInteractiveChordViewer() {
  const contentEl = document.getElementById("cifra-content");
  if (!contentEl) return;
  annotateInteractiveChordTokens();
  bindChordInteractions(contentEl, {
    getInstrument: () => currentInteractiveInstrument || "violao"
  });
}

function initInteractiveChordViewer() {
  const contentEl = document.getElementById("cifra-content");
  if (!contentEl || interactiveChordObserver) return;
  interactiveChordObserver = new MutationObserver(() => {
    window.requestAnimationFrame(() => bindInteractiveChordViewer());
  });
  interactiveChordObserver.observe(contentEl, {
    childList: true,
    subtree: true
  });
  bindInteractiveChordViewer();
}

function renderCifraContent(cifra) {
  const contentEl = document.getElementById("cifra-content");
  if (!contentEl) return;
  const richHtml = String(cifra.cifraHtml || "").replace(/\r\n?/g, "\n");
  const plainText = String(cifra.cifraText || stripHtmlToPlainText(richHtml) || "").replace(/\r\n?/g, "\n");
  if (richHtml) {
    contentEl.innerHTML = wrapChordLinesFromHtml(richHtml);
    contentEl.dataset.originalHtml = richHtml;
  } else {
    contentEl.innerHTML = wrapChordLinesFromPlainText(plainText);
    contentEl.dataset.originalHtml = "";
  }
  contentEl.dataset.originalText = plainText;
  annotateInteractiveChordTokens();
  applyChordColor(cifra);
}


let cifraMiniMetroCtx = null;
let cifraMiniMetroTimer = null;
let cifraMiniMetroBeatIndex = 0;
let cifraMiniMetroBpm = 72;
let cifraMiniMetroSignature = "4/4";

function getCompassoBeats(compasso = "4/4") {
  const raw = String(compasso || "4/4").trim();
  const [num] = raw.split("/");
  const beats = Number(num);
  return Number.isFinite(beats) && beats > 0 ? beats : 4;
}

function updateMiniMetronomePulses(activeIndex = -1) {
  const box = document.getElementById("cifra-mini-metronome-pulses");
  if (!box) return;
  const beats = getCompassoBeats(cifraMiniMetroSignature);
  box.innerHTML = Array.from({ length: beats }).map((_, index) => {
    const classes = [
      "cifra-mini-metronome-pulse",
      index === 0 ? "is-accent" : "",
      index === activeIndex ? "is-active" : ""
    ].filter(Boolean).join(" ");
    return `<span class="${classes}"></span>`;
  }).join("");
}

function setMiniMetronomeButtonState(running) {
  const button = document.getElementById("cifra-mini-metronome-toggle");
  if (button) {
    button.textContent = running ? "⏸" : "▶";
    button.classList.toggle("is-running", !!running);
    button.setAttribute("aria-pressed", running ? "true" : "false");
    button.setAttribute("aria-label", running ? "Parar metrônomo" : "Iniciar metrônomo");
  }
  const floating = document.getElementById("mini-metronome-floating-toggle");
  if (floating) {
    floating.textContent = running ? "⏸" : "▶";
    floating.classList.toggle("is-running", !!running);
    floating.setAttribute("aria-pressed", running ? "true" : "false");
    floating.setAttribute("aria-label", running ? "Parar metrônomo" : "Iniciar metrônomo");
  }
}

let miniMetronomeVisibilityObserver = null;
let miniMetronomeVisibilityBound = false;

function updateFloatingMiniMetronomeVisibility() {
  const wrapper = document.getElementById("cifra-mini-metronome");
  const floating = document.getElementById("mini-metronome-floating-toggle");
  if (!floating) return;
  if (!wrapper || wrapper.classList.contains("hidden")) {
    floating.classList.add("hidden");
    return;
  }
  const rect = wrapper.getBoundingClientRect();
  const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
  const visible = rect.bottom > 0 && rect.top < viewportH;
  floating.classList.toggle("hidden", visible);
}

function initFloatingMiniMetronomeToggle() {
  const wrapper = document.getElementById("cifra-mini-metronome");
  const floating = document.getElementById("mini-metronome-floating-toggle");
  if (!floating) return;

  if (!floating.dataset.boundMiniMetroFloating) {
    floating.dataset.boundMiniMetroFloating = "1";
    floating.addEventListener("click", () => {
      const mainBtn = document.getElementById("cifra-mini-metronome-toggle");
      if (mainBtn) mainBtn.click();
      else if (cifraMiniMetroTimer) stopMiniMetronome();
      else startMiniMetronome();
    });
  }

  if (miniMetronomeVisibilityObserver) {
    miniMetronomeVisibilityObserver.disconnect();
    miniMetronomeVisibilityObserver = null;
  }

  if ("IntersectionObserver" in window && wrapper) {
    miniMetronomeVisibilityObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      const visible = !!entry && entry.isIntersecting;
      floating.classList.toggle("hidden", visible || wrapper.classList.contains("hidden"));
    }, { threshold: 0.01 });
    miniMetronomeVisibilityObserver.observe(wrapper);
  }

  if (!miniMetronomeVisibilityBound) {
    miniMetronomeVisibilityBound = true;
    window.addEventListener("scroll", updateFloatingMiniMetronomeVisibility, { passive: true });
    window.addEventListener("resize", updateFloatingMiniMetronomeVisibility, { passive: true });
  }

  updateFloatingMiniMetronomeVisibility();
}

function ensureMiniMetronomeAudio() {
  if (!cifraMiniMetroCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    cifraMiniMetroCtx = new AudioCtx();
  }
  return cifraMiniMetroCtx;
}

function playMiniMetronomeClick(accent = false) {
  const ctx = ensureMiniMetronomeAudio();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = accent ? 1580 : 1180;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.14, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.08);
}

function stopMiniMetronome() {
  if (cifraMiniMetroTimer) {
    clearInterval(cifraMiniMetroTimer);
    cifraMiniMetroTimer = null;
  }
  cifraMiniMetroBeatIndex = 0;
  updateMiniMetronomePulses(-1);
  setMiniMetronomeButtonState(false);
}

function startMiniMetronome() {
  stopMiniMetronome();
  const intervalMs = 60000 / Math.max(1, Number(cifraMiniMetroBpm || 72));
  const beats = getCompassoBeats(cifraMiniMetroSignature);
  const tick = () => {
    updateMiniMetronomePulses(cifraMiniMetroBeatIndex);
    playMiniMetronomeClick(cifraMiniMetroBeatIndex === 0);
    cifraMiniMetroBeatIndex = (cifraMiniMetroBeatIndex + 1) % beats;
  };
  tick();
  cifraMiniMetroTimer = window.setInterval(tick, intervalMs);
  setMiniMetronomeButtonState(true);
}

function initMiniMetronome(cifra = {}) {
  currentPublicCifra = cifra ? { ...cifra } : null;
  const wrapper = document.getElementById("cifra-mini-metronome");
  const bpmEl = document.getElementById("cifra-mini-metronome-bpm");
  const compassoEl = document.getElementById("cifra-mini-metronome-compasso");
  const button = document.getElementById("cifra-mini-metronome-toggle");
  if (!wrapper || !bpmEl || !compassoEl || !button) return;

  const bpm = String(cifra.bpm || "").trim();
  const compasso = String(cifra.compasso || "").trim();

  if (!bpm || !compasso) {
    wrapper.classList.add("hidden");
    stopMiniMetronome();
    setMiniMetronomeEditVisibility();
    updateFloatingMiniMetronomeVisibility();
    return;
  }

  cifraMiniMetroBpm = Number(bpm) || 72;
  cifraMiniMetroSignature = compasso;
  bpmEl.textContent = `${cifraMiniMetroBpm} BPM`;
  compassoEl.textContent = cifraMiniMetroSignature;
  wrapper.classList.remove("hidden");
  updateMiniMetronomePulses(-1);
  setMiniMetronomeEditVisibility();

  if (!button.dataset.boundMiniMetro) {
    button.dataset.boundMiniMetro = "1";
    button.addEventListener("click", () => {
      if (cifraMiniMetroTimer) stopMiniMetronome();
      else startMiniMetronome();
    });
  }

  initFloatingMiniMetronomeToggle();
}


let currentPublicCifra = null;
let currentAdminCanEditMiniMetronome = false;
let currentPublicCifraLiveUnsubscribe = null;
let currentPublicCifraLiveSignature = "";
const COMPASSO_OPTIONS = ["2/4","3/4","4/4","5/4","6/8","7/8","9/8","12/8"];

function ensureMiniMetronomeEditUi() {
  const wrapper = document.getElementById("cifra-mini-metronome");
  if (!wrapper) return null;

  let editBtn = document.getElementById("cifra-mini-metronome-edit");
  if (!editBtn) {
    editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.id = "cifra-mini-metronome-edit";
    editBtn.textContent = "Edit";
    editBtn.hidden = true;
    editBtn.setAttribute("aria-label", "Editar BPM e compasso do metrônomo");
    editBtn.style.minWidth = "46px";
    editBtn.style.minHeight = "42px";
    editBtn.style.height = "42px";
    editBtn.style.padding = "0 12px";
    editBtn.style.borderRadius = "999px";
    editBtn.style.border = "1px solid rgba(255,255,255,.08)";
    editBtn.style.background = "rgba(255,255,255,.03)";
    editBtn.style.color = "var(--text)";
    editBtn.style.fontWeight = "700";
    editBtn.style.cursor = "pointer";
    wrapper.appendChild(editBtn);
  }

  let modal = document.getElementById("cifra-mini-metronome-edit-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "cifra-mini-metronome-edit-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div data-dialog style="position:fixed; inset:0; z-index:120; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div data-overlay style="position:absolute; inset:0; background:rgba(0,0,0,.55);"></div>
        <div style="position:relative; z-index:1; width:min(92vw, 360px); padding:18px; border-radius:20px; border:1px solid var(--border); background:var(--surface); box-shadow:var(--shadow); color:var(--text);">
          <h3 style="margin:0 0 12px; font-size:1.05rem;">Editar metrônomo</h3>
          <label style="display:block; margin-bottom:10px;">
            <span style="display:block; margin-bottom:6px; color:var(--text-soft); font-size:.92rem;">BPM</span>
            <input id="cifra-mini-metronome-edit-bpm" type="number" min="1" max="400" step="1" style="width:100%; min-height:42px; border-radius:14px; border:1px solid var(--border); background:var(--surface); color:var(--text); padding:0 12px;" />
          </label>
          <label style="display:block; margin-bottom:14px;">
            <span style="display:block; margin-bottom:6px; color:var(--text-soft); font-size:.92rem;">Compasso</span>
            <select id="cifra-mini-metronome-edit-compasso" style="width:100%; min-height:42px; border-radius:14px; border:1px solid var(--border); background:var(--surface); color:var(--text); padding:0 12px;">
              ${COMPASSO_OPTIONS.map(item => `<option value="${item}">${item}</option>`).join("")}
            </select>
          </label>
          <div style="display:flex; gap:10px; justify-content:flex-end;">
            <button type="button" id="cifra-mini-metronome-edit-cancel" style="min-height:40px; padding:0 14px; border-radius:999px; border:1px solid var(--border); background:var(--surface); color:var(--text);">Cancelar</button>
            <button type="button" id="cifra-mini-metronome-edit-save" style="min-height:40px; padding:0 14px; border-radius:999px; border:1px solid var(--border); background:var(--surface); color:var(--text); font-weight:700;">Salvar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => { modal.hidden = true; };
    modal.querySelector('[data-overlay]')?.addEventListener('click', closeModal);
    modal.querySelector('#cifra-mini-metronome-edit-cancel')?.addEventListener('click', closeModal);
  }

  return { wrapper, editBtn, modal };
}

function setMiniMetronomeEditVisibility() {
  const ui = ensureMiniMetronomeEditUi();
  if (!ui) return;
  const bpm = String(currentPublicCifra?.bpm || "").trim();
  const compasso = String(currentPublicCifra?.compasso || "").trim();
  const metrônomoVisível = !!bpm && !!compasso;
  ui.editBtn.hidden = !(currentAdminCanEditMiniMetronome && metrônomoVisível);
}

async function openMiniMetronomeEditModal() {
  if (!currentAdminCanEditMiniMetronome) {
    alert("Administrador não autenticado.");
    return;
  }
  if (!currentPublicCifra?.id) return;

  const ui = ensureMiniMetronomeEditUi();
  if (!ui?.modal) return;

  const bpmInput = ui.modal.querySelector('#cifra-mini-metronome-edit-bpm');
  const compassoSelect = ui.modal.querySelector('#cifra-mini-metronome-edit-compasso');
  const saveBtn = ui.modal.querySelector('#cifra-mini-metronome-edit-save');

  bpmInput.value = String(currentPublicCifra?.bpm || "");
  compassoSelect.value = String(currentPublicCifra?.compasso || "4/4");

  ui.modal.hidden = false;

  const onSave = async () => {
    const bpm = String(bpmInput.value || "").trim();
    const compasso = String(compassoSelect.value || "").trim();

    if (!bpm || !compasso) {
      alert("Informe BPM e compasso.");
      return;
    }

    saveBtn.disabled = true;
    try {
      const next = {
        ...currentPublicCifra,
        bpm,
        compasso
      };
      await updateCifraMetronome(currentPublicCifra.id, bpm, compasso);
      const refreshed = await getCifra(currentPublicCifra.id);
      currentPublicCifra = refreshed ? { ...refreshed } : { ...currentPublicCifra, bpm, compasso };
      currentPublicCifraLiveSignature = buildPublicCifraSignature(currentPublicCifra);
      hideCifraUpdateBanner();
      setOriginalMetaTom(
        currentPublicCifra.originalKey || currentPublicCifra.tonality || currentPublicCifra.tom || "C",
        currentPublicCifra.capo || "",
        bpm
      );
      initMiniMetronome(currentPublicCifra);
      ui.modal.hidden = true;
    } catch (error) {
      console.error("Erro ao salvar mini metrônomo:", error);
      alert("Não foi possível salvar as alterações do metrônomo.");
    } finally {
      saveBtn.disabled = false;
    }
  };

  saveBtn.onclick = onSave;
}

function initMiniMetronomeAdminEdit() {
  const ui = ensureMiniMetronomeEditUi();
  if (!ui) return;

  if (!ui.editBtn.dataset.boundEdit) {
    ui.editBtn.dataset.boundEdit = "1";
    ui.editBtn.addEventListener("click", openMiniMetronomeEditModal);
  }

  watchAuth(async (user) => {
    try {
      const email = String(user?.email || "").trim().toLowerCase();
      const admin = email ? await getAdminProfileByEmail(email) : null;
      currentAdminCanEditMiniMetronome = !!admin;
      setMiniMetronomeEditVisibility();
    } catch (error) {
      console.error("Erro ao validar admin do mini metrônomo:", error);
      currentAdminCanEditMiniMetronome = false;
      setMiniMetronomeEditVisibility();
    }
  });
}

function buildDemoInstrumentOption(baseCifra) {
  const demoText = String(baseCifra.cifraText || stripHtmlToPlainText(baseCifra.cifraHtml || "") || "")
    .replace(/Bb/g, "C")
    .replace(/Gm/g, "Am")
    .replace(/Eb/g, "F")
    .replace(/Fsus/g, "Gsus")
    .replace(/F/g, "G");
  return {
    ...baseCifra,
    id: `${baseCifra.id}-demo-teclado`,
    instrumento: "teclado",
    instrumentLabel: "Teclado",
    cifraText: demoText,
    cifraHtml: `<p><span style="background-color: #f1c40f; color: #000000;">[Exemplo temporário de Teclado]</span></p><p>${demoText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`
  };
}


function buildPublicCifraSignature(cifra = {}) {
  return JSON.stringify({
    id: String(cifra.id || ""),
    slug: String(cifra.slug || ""),
    title: String(cifra.title || ""),
    subtitle: String(cifra.subtitle || ""),
    cifraText: String(cifra.cifraText || ""),
    cifraHtml: String(cifra.cifraHtml || ""),
    originalKey: String(cifra.originalKey || cifra.tonality || cifra.tom || ""),
    capo: String(cifra.capo || ""),
    bpm: String(cifra.bpm || ""),
    compasso: String(cifra.compasso || ""),
    instrumento: String(cifra.instrumento || ""),
    chordColor: String(cifra.chordColor || ""),
    active: cifra.active !== false
  });
}

function ensureCifraUpdateBanner() {
  let banner = document.getElementById("cifra-live-update-banner");
  if (banner) return banner;
  banner = document.createElement("button");
  banner.type = "button";
  banner.id = "cifra-live-update-banner";
  banner.className = "cifra-live-update-banner hidden";
  banner.textContent = "Essa cifra foi atualizada. Toque para atualizar";
  banner.addEventListener("click", () => {
    window.location.reload();
  });
  document.body.appendChild(banner);
  return banner;
}

function showCifraUpdateBanner() {
  ensureCifraUpdateBanner().classList.remove("hidden");
}

function hideCifraUpdateBanner() {
  ensureCifraUpdateBanner().classList.add("hidden");
}

function startPublicCifraLiveWatch(cifra = {}) {
  if (currentPublicCifraLiveUnsubscribe) {
    currentPublicCifraLiveUnsubscribe();
    currentPublicCifraLiveUnsubscribe = null;
  }
  hideCifraUpdateBanner();
  if (!cifra?.id) return;

  currentPublicCifraLiveSignature = buildPublicCifraSignature(cifra);

  currentPublicCifraLiveUnsubscribe = watchDocument("cifras", cifra.id, (nextDoc) => {
    if (!nextDoc) return;
    const nextSignature = buildPublicCifraSignature(nextDoc);
    if (!currentPublicCifraLiveSignature) {
      currentPublicCifraLiveSignature = nextSignature;
      return;
    }
    if (nextSignature !== currentPublicCifraLiveSignature) {
      showCifraUpdateBanner();
    }
  }, (error) => {
    console.error("Erro ao observar atualizações da cifra pública:", error);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const slug = getQueryParam("slug");
    const requestedInstrument = normalizeInstrument(getQueryParam("instrumento") || "violao");
    const demoMode = getQueryParam("demoInstrumentos") === "1";
    const titleEl = document.getElementById("cifra-titulo");
    const subtitleEl = document.getElementById("cifra-subtitulo");
    const letraLink = document.getElementById("ver-letra-link");
    let currentCifra = await getCifraBySlug(slug, requestedInstrument, true);
    if (!currentCifra) {
      if (titleEl) titleEl.textContent = "Cifra não encontrada";
      return;
    }
    let instrumentOptions = await listCifrasBySlug(slug, true, true);
    if (demoMode && instrumentOptions.length === 1) {
      instrumentOptions = [...instrumentOptions, buildDemoInstrumentOption(instrumentOptions[0])];
      if (requestedInstrument === "teclado") {
        currentCifra = instrumentOptions.find((item) => item.instrumento === "teclado") || currentCifra;
      }
    }
    if (titleEl) titleEl.textContent = currentCifra.title || "Título da cifra";
    renderPersonalActionsForCifra(currentCifra);
    if (subtitleEl) { subtitleEl.textContent = currentCifra.subtitle || ""; subtitleEl.hidden = !currentCifra.subtitle; }
    const originalKey = currentCifra.originalKey || currentCifra.tonality || currentCifra.tom || "C";
    setOriginalMetaTom(originalKey, currentCifra.capo || "", currentCifra.bpm || "");
    currentInteractiveInstrument = normalizeInstrument(currentCifra.instrumento || requestedInstrument || "violao");
    renderCifraContent(currentCifra);
    renderInstrumentSelector(currentCifra.instrumento || requestedInstrument, instrumentOptions, slug);
    initMiniMetronomeAdminEdit();
    initMiniMetronome(currentCifra);
    if (letraLink) {
      let musicaSlug = currentCifra.slug || "";
      if (currentCifra.musicaId) {
        const musica = await getMusica(currentCifra.musicaId);
        if (musica?.slug) musicaSlug = musica.slug;
      }
      if (musicaSlug) { letraLink.href = `./musica.html?slug=${musicaSlug}`; letraLink.textContent = "Ver letra"; }
      else { letraLink.removeAttribute('href'); letraLink.textContent = 'Letra indisponível'; }
    }
    const allCifras = await listCifras(true);
    const uniqueBySlug = Array.from(new Map(allCifras.map((item) => [item.slug, item])).values());
    renderPrevNext(currentCifra.slug, currentCifra.instrumento || requestedInstrument, uniqueBySlug);
    startPublicCifraLiveWatch(currentCifra);
    initCifraControls();
    initInteractiveChordViewer();
  } catch (error) {
    console.error("Erro ao carregar cifra pública:", error);
    const titleEl = document.getElementById("cifra-titulo");
    if (titleEl) titleEl.textContent = "Erro ao carregar cifra";
  }
});


window.addEventListener("beforeunload", () => {
  if (currentPublicCifraLiveUnsubscribe) {
    currentPublicCifraLiveUnsubscribe();
    currentPublicCifraLiveUnsubscribe = null;
  }
});
