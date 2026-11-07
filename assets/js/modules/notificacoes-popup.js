import { getPopupNotificacao } from "../services/notificacoes-service.js";

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

function shouldShowPopup(item) {
  if (!item?.id) return false;
  const key = getStorageKey(item);
  const mode = item.popupMode || "device_once";
  const saved = localStorage.getItem(key);
  if (!saved) return true;
  if (mode === "always") return true;
  if (mode === "daily") {
    const today = new Date().toISOString().slice(0, 10);
    return saved !== today;
  }
  return false;
}

function persistPopupView(item) {
  const key = getStorageKey(item);
  const mode = item.popupMode || "device_once";
  if (mode === "daily") {
    localStorage.setItem(key, new Date().toISOString().slice(0, 10));
    return;
  }
  localStorage.setItem(key, "shown");
}

function closePopup(wrapper, item) {
  persistPopupView(item);
  wrapper.classList.add("hidden");
  setTimeout(() => wrapper.remove(), 180);
}

function getPopupTypeMeta(type = "aviso") {
  const normalized = String(type || "aviso").toLowerCase();
  const map = {
    novidade: { icon: "✨", label: "NOVIDADE" },
    aviso: { icon: "⚠", label: "AVISO" },
    evento: { icon: "📅", label: "EVENTO" },
    destaque: { icon: "⭐", label: "DESTAQUE" },
  };
  return map[normalized] || { icon: "📢", label: normalized.toUpperCase() };
}

function renderPopup(item) {
  const wrapper = document.createElement("div");
  const type = escapeHtml(item.type || item.tipo || "aviso");
  const meta = getPopupTypeMeta(type);
  wrapper.className = "notificacao-popup-overlay";
  wrapper.innerHTML = `
    <div class="notificacao-popup-card tipo-${type}" role="dialog" aria-modal="true" aria-label="Notificação">
      <button type="button" class="notificacao-popup-close" aria-label="Fechar">✕</button>
      <span class="notificacao-popup-chip">${meta.icon} ${escapeHtml(meta.label)}</span>
      <h3 class="notificacao-popup-title">${escapeHtml(item.title || "Notificação")}</h3>
      <p class="notificacao-popup-message">${formatMultilineHtml(item.message || "")}</p>
      <div class="notificacao-popup-actions">
        ${item.buttonLink && item.buttonText ? `<a class="button-primary" href="${escapeHtml(item.buttonLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.buttonText)}</a>` : ""}
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
