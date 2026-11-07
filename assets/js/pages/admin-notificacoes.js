import { watchAuth, getAdminProfileByEmail } from "../auth.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { listNotificacoes, saveNotificacao, removeNotificacao, getNotificacao } from "../services/notificacoes-service.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

function formatDateTime(value = "") {
  if (!value) return "Sem data definida";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

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


function formatInputDateLocal(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function applyDefaultNotificationDates(force = false) {
  const startInput = document.getElementById("notificacao-inicio");
  const endInput = document.getElementById("notificacao-fim");
  const idInput = document.getElementById("notificacao-id");
  if (!startInput || !endInput) return;
  if (!force && idInput?.value) return;

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (force || !startInput.value) startInput.value = formatInputDateLocal(now);
  if (force || !endInput.value) endInput.value = formatInputDateLocal(tomorrow);
}


function getFormPayload() {
  return {
    title: document.getElementById("notificacao-titulo")?.value?.trim() || "",
    message: document.getElementById("notificacao-mensagem")?.value?.trim() || "",
    type: document.getElementById("notificacao-tipo")?.value || "aviso",
    active: document.getElementById("notificacao-ativa")?.checked === true,
    showPopup: document.getElementById("notificacao-popup")?.checked === true,
    showHome: document.getElementById("notificacao-home")?.checked === true,
    showPublic: document.getElementById("notificacao-publica")?.checked === true,
    showTop: document.getElementById("notificacao-topo")?.checked === true,
    showBeforeStart: document.getElementById("notificacao-antes-inicio")?.checked === true,
    popupMode: document.getElementById("notificacao-popup-mode")?.value || "device_once",
    topMode: document.getElementById("notificacao-top-mode")?.value || "device_once",
    startsAt: document.getElementById("notificacao-inicio")?.value || "",
    expiresAt: document.getElementById("notificacao-fim")?.value || "",
    buttonText: document.getElementById("notificacao-botao-texto")?.value?.trim() || "",
    buttonLink: document.getElementById("notificacao-botao-link")?.value?.trim() || ""
  };
}

function resetForm() {
  document.getElementById("admin-notificacao-form")?.reset();
  const idInput = document.getElementById("notificacao-id");
  if (idInput) idInput.value = "";
  const active = document.getElementById("notificacao-ativa");
  const pub = document.getElementById("notificacao-publica");
  const top = document.getElementById("notificacao-topo");
  const beforeStart = document.getElementById("notificacao-antes-inicio");
  const topMode = document.getElementById("notificacao-top-mode");
  if (active) active.checked = true;
  if (pub) pub.checked = true;
  if (top) top.checked = false;
  if (beforeStart) beforeStart.checked = false;
  if (topMode) topMode.value = "device_once";
  applyDefaultNotificationDates(true);
}

async function loadIntoForm(id) {
  const item = await getNotificacao(id);
  if (!item) return;
  document.getElementById("notificacao-id").value = item.id;
  document.getElementById("notificacao-titulo").value = item.title || "";
  document.getElementById("notificacao-mensagem").value = item.message || "";
  document.getElementById("notificacao-tipo").value = item.type || item.tipo || "aviso";
  document.getElementById("notificacao-ativa").checked = item.active !== false;
  document.getElementById("notificacao-popup").checked = item.showPopup === true;
  document.getElementById("notificacao-home").checked = item.showHome === true;
  document.getElementById("notificacao-publica").checked = item.showPublic !== false;
  document.getElementById("notificacao-topo").checked = item.showTop === true;
  document.getElementById("notificacao-antes-inicio").checked = item.showBeforeStart === true;
  document.getElementById("notificacao-popup-mode").value = item.popupMode || "device_once";
  document.getElementById("notificacao-top-mode").value = item.topMode || "device_once";
  document.getElementById("notificacao-inicio").value = item.startsAt || "";
  document.getElementById("notificacao-fim").value = item.expiresAt || "";
  document.getElementById("notificacao-botao-texto").value = item.buttonText || "";
  document.getElementById("notificacao-botao-link").value = item.buttonLink || "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function renderList() {
  const box = document.getElementById("admin-notificacoes-list");
  if (!box) return;
  const all = await listNotificacoes(false);
  box.innerHTML = all.length ? all.map((item) => `
    <div class="admin-list-card admin-notificacao-card ${item.active !== false ? "" : "is-inactive"}">
      <div class="admin-notificacao-content">
        <div class="admin-notificacao-header">
          <strong>${escapeHtml(item.title || "Sem título")}</strong>
          <span class="notificacao-chip tipo-${escapeHtml(item.type || item.tipo || "aviso")}">${escapeHtml(item.type || item.tipo || "aviso")}</span>
        </div>
        <p>${formatMultilineHtml(item.message || "")}</p>
        <div class="admin-notificacao-meta">
          <span>Início: ${formatDateTime(item.startsAt)}</span>
          <span>Fim: ${item.expiresAt ? formatDateTime(item.expiresAt) : "Sem expiração"}</span>
          <span>${item.showPopup ? "Popup" : "Sem popup"}</span>
          <span>${item.showHome ? "Home" : "Fora da home"}</span>
          <span>${item.showPublic !== false ? "Página pública" : "Oculta na página pública"}</span>
          <span>${item.showTop ? "Faixa no topo" : "Sem faixa no topo"}</span>
          <span>${item.showBeforeStart ? "Exibe antes do início" : "Não exibe antes do início"}</span>
          <span>${item.active !== false ? "Ativa" : "Inativa"}</span>
        </div>
      </div>
      <div class="admin-list-actions">
        <button type="button" class="button-outline" data-edit-id="${item.id}">Editar</button>
        <button type="button" class="button-danger" data-delete-id="${item.id}">Excluir</button>
      </div>
    </div>
  `).join("") : "<p>Nenhuma notificação cadastrada.</p>";

  box.querySelectorAll("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await loadIntoForm(button.dataset.editId);
    });
  });

  box.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Deseja excluir esta notificação?")) return;
      const id = button.dataset.deleteId;
      const item = await getNotificacao(id);
      await removeNotificacao(id);
      await recordAdminActivity({ action: "delete", module: "notificacoes", itemId: id, itemName: item?.title || "Notificação" });
      alert("🗑️ Notificação excluída com sucesso!");
      await renderList();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("admin-notificacao-form");
  const resetButton = document.getElementById("notificacao-reset");
  resetForm();
  applyDefaultNotificationDates(true);
  await renderList();

  resetButton?.addEventListener("click", () => resetForm());

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = document.getElementById("notificacao-id")?.value || "";
    const payload = getFormPayload();

    if (!payload.title || !payload.message) {
      alert("Preencha o título e a mensagem da notificação.");
      return;
    }

    if (payload.startsAt && payload.expiresAt && payload.expiresAt < payload.startsAt) {
      alert("A data de expiração não pode ser menor que a data de início.");
      return;
    }

    const savedId = await saveNotificacao(payload, id);
    await recordAdminActivity({ action: id ? "update" : "create", module: "notificacoes", itemId: savedId, itemName: payload.title });
    alert(id ? "✅ Notificação atualizada com sucesso!" : "✅ Notificação criada com sucesso!");
    resetForm();
    await renderList();
  });
});

function hideNotificationField(selector) {
  const el = document.querySelector(selector);
  if (!el) return;
  const block = el.closest('.admin-field-block') || el.closest('.admin-check') || el.parentElement;
  block?.classList.add('hidden');
}
watchAuth(async (user) => {
  if (!user?.email) return;
  const admin = await getAdminProfileByEmail(user.email);
  if (!admin) return;
  document.querySelector('#admin-notificacao-form button[type="submit"]')?.classList.toggle('hidden', !(hasPermission(admin,'notificacoes','create') || hasPermission(admin,'notificacoes','edit')));
  document.querySelectorAll('[data-edit-id]').forEach((el)=>el.classList.toggle('hidden', !hasPermission(admin,'notificacoes','edit')));
  document.querySelectorAll('[data-delete-id]').forEach((el)=>el.classList.toggle('hidden', !hasPermission(admin,'notificacoes','delete')));
  if (!hasPermission(admin,'notificacoes','popup')) {
    hideNotificationField('#notificacao-popup');
    hideNotificationField('#notificacao-popup-mode');
  }
  if (!hasPermission(admin,'notificacoes','top')) {
    hideNotificationField('#notificacao-topo');
    hideNotificationField('#notificacao-top-mode');
  }
  if (!hasPermission(admin,'notificacoes','buttonLink')) {
    hideNotificationField('#notificacao-botao-texto');
    hideNotificationField('#notificacao-botao-link');
  }
  if (!hasPermission(admin,'notificacoes','beforeStart')) {
    hideNotificationField('#notificacao-antes-inicio');
  }
});
