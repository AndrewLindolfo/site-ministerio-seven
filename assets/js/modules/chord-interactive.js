
import { createChordViewerShell, renderChordViewer } from "./chord-viewer.js";
import { normalizeInstrumentName } from "./chord-theory.js";

let hideTimer = null;
let lastFocusedElement = null;

function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function scheduleTooltipHide() {
  clearHideTimer();
  hideTimer = setTimeout(() => {
    hideChordTooltip();
  }, 180);
}

function ensureTooltip() {
  let tooltip = document.getElementById("chord-tooltip");
  if (tooltip) return tooltip;

  tooltip = document.createElement("div");
  tooltip.id = "chord-tooltip";
  tooltip.className = "chord-tooltip hidden";
  tooltip.setAttribute("role", "tooltip");
  tooltip.appendChild(createChordViewerShell());

  tooltip.addEventListener("mouseenter", clearHideTimer);
  tooltip.addEventListener("mouseleave", scheduleTooltipHide);

  document.body.appendChild(tooltip);
  return tooltip;
}

function ensureBottomSheet() {
  let overlay = document.getElementById("chord-sheet-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "chord-sheet-overlay";
  overlay.className = "chord-sheet-overlay hidden";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="chord-sheet" role="dialog" aria-modal="true" aria-label="Visualização do acorde">
      <button type="button" class="chord-sheet__close" aria-label="Fechar visualização">✕</button>
      <div class="chord-sheet__content"></div>
    </div>
  `;

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest(".chord-sheet__close")) {
      closeChordBottomSheet();
    }
  });

  document.body.appendChild(overlay);
  return overlay;
}

function closeChordBottomSheet() {
  const overlay = document.getElementById("chord-sheet-overlay");
  if (!overlay || overlay.classList.contains("hidden")) return;
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
  lastFocusedElement = null;
}

function placeTooltip(tooltip, target) {
  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const desiredLeft = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2);
  const maxLeft = window.scrollX + window.innerWidth - tooltipRect.width - 12;
  const left = Math.max(window.scrollX + 12, Math.min(desiredLeft, maxLeft));
  const top = rect.bottom + window.scrollY + 10;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

export function showChordTooltip(target, symbol, instrument = "violao") {
  if (!target || !symbol) return;
  const tooltip = ensureTooltip();
  const shell = tooltip.querySelector(".chord-viewer");
  renderChordViewer(shell, symbol, normalizeInstrumentName(instrument), 0);
  tooltip.classList.remove("hidden");
  requestAnimationFrame(() => placeTooltip(tooltip, target));
}

export function hideChordTooltip() {
  clearHideTimer();
  const tooltip = document.getElementById("chord-tooltip");
  if (tooltip) tooltip.classList.add("hidden");
}

export function openChordBottomSheet(symbol, instrument = "violao") {
  if (!symbol) return;
  const overlay = ensureBottomSheet();
  const content = overlay.querySelector(".chord-sheet__content");
  content.innerHTML = "";
  const shell = createChordViewerShell();
  content.appendChild(shell);
  renderChordViewer(shell, symbol, normalizeInstrumentName(instrument), 0);
  lastFocusedElement = document.activeElement;
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  overlay.querySelector(".chord-sheet__close")?.focus();
}

export function bindChordInteractions(root, options = {}) {
  if (!root) return;
  const getInstrument = typeof options.getInstrument === "function" ? options.getInstrument : () => "violao";

  root.querySelectorAll("[data-chord-symbol]").forEach((node) => {
    if (node.dataset.chordInteractiveBound === "1") return;
    node.dataset.chordInteractiveBound = "1";

    const symbol = node.getAttribute("data-chord-symbol") || "";
    node.classList.add("is-chord-interactive");
    node.tabIndex = 0;
    node.setAttribute("role", "button");
    node.setAttribute("aria-label", `Visualizar acorde ${symbol}`);

    node.addEventListener("mouseenter", () => {
      if (window.innerWidth <= 1024) return;
      clearHideTimer();
      showChordTooltip(node, symbol, getInstrument());
    });

    node.addEventListener("mouseleave", () => {
      if (window.innerWidth <= 1024) return;
      scheduleTooltipHide();
    });

    node.addEventListener("click", (event) => {
      if (window.innerWidth > 1024) return;
      event.preventDefault();
      openChordBottomSheet(symbol, getInstrument());
    });

    node.addEventListener("focus", () => {
      if (window.innerWidth > 1024) showChordTooltip(node, symbol, getInstrument());
    });

    node.addEventListener("blur", () => {
      if (window.innerWidth > 1024) hideChordTooltip();
    });

    node.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      openChordBottomSheet(symbol, getInstrument());
    });
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeChordBottomSheet();
});
