import { getPopupNotificacao } from "../services/notificacoes-service.js";
import { normalizeHttpsOrLocalUrl } from "../lib/url-safety.js";

const VALID_TYPES = new Set(["aviso", "novidade", "evento", "destaque"]);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMultilineHtml(value = "") {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function getStorageKey(item) {
  return `seven_popup_notificacao_${item.id}`;
}

function getLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function shouldShowPopup(item) {
  if (!item?.id) return false;
  const key = getStorageKey(item);
  const mode = item.popupMode || "device_once";
  const saved = readLocalStorage(key);
  if (!saved) return true;
  if (mode === "always") return true;
  if (mode === "daily") {
    return saved !== getLocalDateKey();
  }
  return false;
}

function persistPopupView(item) {
  const key = getStorageKey(item);
  const mode = item.popupMode || "device_once";
  if (mode === "daily") {
    writeLocalStorage(key, getLocalDateKey());
    return;
  }
  writeLocalStorage(key, "shown");
}

function closePopup(wrapper, item) {
  persistPopupView(item);
  wrapper.classList.add("hidden");
  setTimeout(() => wrapper.remove(), 180);
}

function getPopupTypeMeta(type = "aviso") {
  const raw = String(type || "aviso").toLowerCase();
  const normalized = VALID_TYPES.has(raw) ? raw : "aviso";
  const map = {
    novidade: { icon: "✨", label: "NOVIDADE" },
    aviso: { icon: "⚠", label: "AVISO" },
    evento: { icon: "📅", label: "EVENTO" },
    destaque: { icon: "⭐", label: "DESTAQUE" },
  };
  return map[normalized];
}

function renderPopup(item) {
  const wrapper = document.createElement("div");
  const rawType = String(item.type || item.tipo || "aviso").toLowerCase();
  const type = VALID_TYPES.has(rawType) ? rawType : "aviso";
  const meta = getPopupTypeMeta(type);
  const buttonUrl = normalizeHttpsOrLocalUrl(item.buttonLink);
  wrapper.className = "notificacao-popup-overlay";
  wrapper.innerHTML = `
    <div class="notificacao-popup-card tipo-${type}" role="dialog" aria-modal="true" aria-label="Notificação">
      <button type="button" class="notificacao-popup-close" aria-label="Fechar">✕</button>
      <span class="notificacao-popup-chip">${meta.icon} ${escapeHtml(meta.label)}</span>
      <h3 class="notificacao-popup-title">${escapeHtml(item.title || "Notificação")}</h3>
      <p class="notificacao-popup-message">${formatMultilineHtml(item.message || "")}</p>
      <div class="notificacao-popup-actions">
        ${buttonUrl && item.buttonText ? `<a class="button-primary" href="${escapeHtml(buttonUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.buttonText)}</a>` : ""}
        <button type="button" class="button-outline notificacao-popup-dismiss">Fechar</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);
  wrapper.querySelector(".notificacao-popup-close")?.addEventListener("click", () => closePopup(wrapper, item));
  wrapper.querySelector(".notificacao-popup-dismiss")?.addEventListener("click", () => closePopup(wrapper, item));
  wrapper.addEventListener("click", (event) => {
    if (event.target === wrapper) closePopup(wrapper, item);
  });
}

export async function initNotificacoesPopup() {
  try {
    const item = await getPopupNotificacao();
    if (!item || !shouldShowPopup(item)) return;
    renderPopup(item);
  } catch (error) {
    console.error("Erro ao inicializar popup de notificação:", error);
  }
}
