import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { explainFirebaseError } from "../db.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { listNotificacoes, saveNotificacao, removeNotificacao } from "../services/notificacoes-service.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

let currentAdmin = null;
let currentEditing = null;
let notifications = [];
let hasInitialized = false;

function byId(id) {
  return document.getElementById(id);
}

function can(permission) {
  return hasPermission(currentAdmin, "notificacoes", permission);
}

function setStatus(message = "", isError = false) {
  const status = byId("admin-notificacoes-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return value ? "Data inválida" : "Sem data definida";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatInputDate(value) {
  const date = toDate(value);
  if (!date) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function applyDefaultDates() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  byId("notificacao-inicio").value = formatInputDate(now);
  byId("notificacao-fim").value = formatInputDate(tomorrow);
}

function canSaveCurrent() {
  return currentEditing ? can("edit") : can("create");
}

function updateSubmitAccess() {
  document.querySelector('#admin-notificacao-form button[type="submit"]')?.classList.toggle("hidden", !canSaveCurrent());
}

function setFieldAccess(id, permission) {
  const element = byId(id);
  if (!element) return;
  const block = element.closest(".admin-field-block") || element.closest(".admin-check") || element.parentElement;
  block?.classList.toggle("hidden", !permission);
  element.disabled = !permission;
}

function applyFieldPermissions() {
  setFieldAccess("notificacao-popup", can("popup"));
  setFieldAccess("notificacao-popup-mode", can("popup"));
  setFieldAccess("notificacao-topo", can("top"));
  setFieldAccess("notificacao-top-mode", can("top"));
  setFieldAccess("notificacao-botao-texto", can("buttonLink"));
  setFieldAccess("notificacao-botao-link", can("buttonLink"));
  setFieldAccess("notificacao-antes-inicio", can("beforeStart"));
  updateSubmitAccess();
}

function resetForm() {
  byId("admin-notificacao-form")?.reset();
  currentEditing = null;
  byId("notificacao-id").value = "";
  byId("notificacao-ativa").checked = true;
  byId("notificacao-publica").checked = true;
  byId("notificacao-topo").checked = false;
  byId("notificacao-antes-inicio").checked = false;
  byId("notificacao-top-mode").value = "device_once";
  applyDefaultDates();
  updateSubmitAccess();
}

function loadIntoForm(item) {
  if (!can("edit")) return setStatus("Você não tem permissão para editar notificações.", true);
  currentEditing = item;
  byId("notificacao-id").value = item.id;
  byId("notificacao-titulo").value = item.title || "";
  byId("notificacao-mensagem").value = item.message || "";
  byId("notificacao-tipo").value = item.type || item.tipo || "aviso";
  byId("notificacao-ativa").checked = item.active !== false;
  byId("notificacao-popup").checked = item.showPopup === true;
  byId("notificacao-home").checked = item.showHome === true;
  byId("notificacao-publica").checked = item.showPublic !== false;
  byId("notificacao-topo").checked = item.showTop === true;
  byId("notificacao-antes-inicio").checked = item.showBeforeStart === true;
  byId("notificacao-popup-mode").value = item.popupMode || "device_once";
  byId("notificacao-top-mode").value = item.topMode || "device_once";
  byId("notificacao-inicio").value = formatInputDate(item.startsAt);
  byId("notificacao-fim").value = formatInputDate(item.expiresAt);
  byId("notificacao-botao-texto").value = item.buttonText || "";
  byId("notificacao-botao-link").value = item.buttonLink || "";
  updateSubmitAccess();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function protectedValue(permission, currentKey, formValue) {
  return can(permission) ? formValue : (currentEditing?.[currentKey] ?? formValue);
}

function getFormPayload() {
  return {
    title: byId("notificacao-titulo").value.trim(),
    message: byId("notificacao-mensagem").value.trim(),
    type: byId("notificacao-tipo").value || "aviso",
    active: byId("notificacao-ativa").checked,
    showPopup: protectedValue("popup", "showPopup", byId("notificacao-popup").checked),
    showHome: byId("notificacao-home").checked,
    showPublic: byId("notificacao-publica").checked,
    showTop: protectedValue("top", "showTop", byId("notificacao-topo").checked),
    showBeforeStart: protectedValue("beforeStart", "showBeforeStart", byId("notificacao-antes-inicio").checked),
    popupMode: protectedValue("popup", "popupMode", byId("notificacao-popup-mode").value),
    topMode: protectedValue("top", "topMode", byId("notificacao-top-mode").value),
    startsAt: byId("notificacao-inicio").value,
    expiresAt: byId("notificacao-fim").value,
    buttonText: protectedValue("buttonLink", "buttonText", byId("notificacao-botao-texto").value.trim()),
    buttonLink: protectedValue("buttonLink", "buttonLink", byId("notificacao-botao-link").value.trim())
  };
}

function renderList() {
  const box = byId("admin-notificacoes-list");
  if (!box || !currentAdmin) return;
  box.innerHTML = notifications.length ? notifications.map((item) => {
    const type = ["aviso", "novidade", "evento", "destaque"].includes(item.type) ? item.type : "aviso";
    return `
      <div class="admin-list-card admin-notificacao-card ${item.active !== false ? "" : "is-inactive"}">
        <div class="admin-notificacao-content">
          <div class="admin-notificacao-header"><strong>${escapeHtml(item.title || "Sem título")}</strong><span class="notificacao-chip tipo-${type}">${escapeHtml(type)}</span></div>
          <p>${escapeHtml(item.message || "")}</p>
          <div class="admin-notificacao-meta">
            <span>Início: ${escapeHtml(formatDateTime(item.startsAt))}</span>
            <span>Fim: ${escapeHtml(item.expiresAt ? formatDateTime(item.expiresAt) : "Sem expiração")}</span>
            <span>${item.showPopup ? "Popup" : "Sem popup"}</span><span>${item.showHome ? "Home" : "Fora da home"}</span>
            <span>${item.showPublic !== false ? "Página pública" : "Oculta na página pública"}</span><span>${item.showTop ? "Faixa no topo" : "Sem faixa no topo"}</span>
            <span>${item.showBeforeStart ? "Exibe antes do início" : "Não exibe antes do início"}</span><span>${item.active !== false ? "Ativa" : "Inativa"}</span>
          </div>
        </div>
        <div class="admin-list-actions">
          ${can("edit") ? `<button type="button" class="button-outline" data-edit-id="${escapeHtml(item.id)}">Editar</button>` : ""}
          ${can("delete") ? `<button type="button" class="button-danger" data-delete-id="${escapeHtml(item.id)}">Excluir</button>` : ""}
        </div>
      </div>`;
  }).join("") : "<p>Nenhuma notificação cadastrada.</p>";

  box.querySelectorAll("[data-edit-id]").forEach((button) => button.addEventListener("click", () => {
    const item = notifications.find((entry) => entry.id === button.dataset.editId);
    if (item) loadIntoForm(item);
  }));
  box.querySelectorAll("[data-delete-id]").forEach((button) => button.addEventListener("click", async () => {
    const item = notifications.find((entry) => entry.id === button.dataset.deleteId);
    if (!item || !confirm(`Deseja excluir a notificação “${item.title || "Sem título"}”?`)) return;
    button.disabled = true;
    try {
      await removeNotificacao(item.id);
      await recordAdminActivity({ action: "delete", module: "notificacoes", itemId: item.id, itemName: item.title || "Notificação" });
      notifications = notifications.filter((entry) => entry.id !== item.id);
      if (currentEditing?.id === item.id) resetForm();
      renderList();
      setStatus("Notificação excluída com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir notificação:", error);
      setStatus(explainFirebaseError(error), true);
      button.disabled = false;
    }
  }));
  setStatus(`${notifications.length} notificação(ões) cadastrada(s).`);
}

async function loadNotifications() {
  notifications = await listNotificacoes(false);
  renderList();
}

document.addEventListener("DOMContentLoaded", () => {
  resetForm();
  byId("notificacao-reset")?.addEventListener("click", resetForm);
  byId("admin-notificacao-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canSaveCurrent()) return setStatus("Você não tem permissão para salvar esta notificação.", true);
    const id = currentEditing?.id || "";
    const payload = getFormPayload();
    const submit = event.target.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      setStatus("Salvando notificação…");
      const savedId = await saveNotificacao(payload, id);
      await recordAdminActivity({ action: id ? "update" : "create", module: "notificacoes", itemId: savedId, itemName: payload.title });
      resetForm();
      await loadNotifications();
      setStatus("Notificação salva com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar notificação:", error);
      setStatus(explainFirebaseError(error), true);
    } finally {
      submit.disabled = false;
    }
  });
});

watchAuth(async (user) => {
  if (!user?.uid || !user?.email) return;
  try {
    currentAdmin = await getAdminProfileForUser(user);
    if (!currentAdmin) return;
    applyFieldPermissions();
    if (!hasInitialized) {
      setStatus("Carregando notificações…");
      await loadNotifications();
      hasInitialized = true;
    } else renderList();
  } catch (error) {
    console.error("Erro ao preparar notificações:", error);
    setStatus(explainFirebaseError(error), true);
  }
});
