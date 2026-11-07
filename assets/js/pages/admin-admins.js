import { listAdmins, saveSecondaryAdmin, removeSecondaryAdmin, DEFAULT_PERMISSIONS, cloneDefaultPermissions, getEffectivePermissions, isPrimaryAdmin } from "../services/admin-permissions-service.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

const LABELS = {
  musicas: { create: "Pode criar", edit: "Pode editar", delete: "Pode excluir" },
  cifras: { create: "Pode criar", edit: "Pode editar", delete: "Pode excluir", capo: "Editar capotraste", bpm: "Editar BPM", compasso: "Editar compasso", inst_violao: "Instrumento: Violão", inst_guitarra: "Instrumento: Guitarra", inst_baixo: "Instrumento: Baixo", inst_teclado: "Instrumento: Teclado" },
  programacoes: { create: "Pode criar", edit: "Pode editar", delete: "Pode excluir" },
  fotos: { create: "Pode criar", edit: "Pode editar", delete: "Pode excluir" },
  downloadsGerais: { create: "Pode criar", edit: "Pode editar", delete: "Pode excluir" },
  downloadsPorMusica: { create: "Pode criar", edit: "Pode editar", delete: "Pode excluir" },
  contatos: { view: "Pode ver", delete: "Pode excluir" },
  notificacoes: { create: "Pode criar", edit: "Pode editar", delete: "Pode excluir", popup: "Usar pop-up", top: "Usar exibir no topo", buttonLink: "Usar botão/link", beforeStart: "Usar exibir antes da data de início" },
  ensaios: { create: "Pode criar", edit: "Pode editar", delete: "Pode excluir" },
  logs: { view: "Pode ver" }
};

function qs(sel){ return document.querySelector(sel); }

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setStatus(message = "", isError = false) {
  const status = qs("#admin-secondary-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function setFormBusy(busy) {
  const form = qs("#admin-admin-form");
  form?.querySelectorAll("input, button").forEach((control) => {
    control.disabled = busy;
  });
}

function updateUidStatusText(item = null) {
  const status = qs("#admin-uid-status-text");
  if (!status) return;
  const uid = String(item?.uid || "").trim();
  status.textContent = uid
    ? `Este ADM já está vinculado ao UID: ${uid}`
    : "Ao primeiro login válido, o UID da conta Google será vinculado automaticamente a este ADM.";
}

function renderPermissionToggles() {
  Object.entries(DEFAULT_PERMISSIONS).forEach(([moduleKey, modulePerms]) => {
    const root = document.querySelector(`[data-module="${moduleKey}"]`);
    if (!root) return;
    root.innerHTML = Object.keys(modulePerms).map((permKey) => `
      <label class="admin-permission-row">
        <span>${LABELS[moduleKey][permKey]}</span>
        <span class="admin-switch">
          <input type="checkbox" data-permission="${moduleKey}.${permKey}" />
          <span class="admin-switch-slider"></span>
        </span>
      </label>
    `).join("");
  });
}

function readPermissionsFromForm() {
  const output = cloneDefaultPermissions();
  document.querySelectorAll("[data-permission]").forEach((input) => {
    const [moduleKey, permKey] = input.dataset.permission.split(".");
    if (output[moduleKey] && permKey in output[moduleKey]) {
      output[moduleKey][permKey] = input.checked === true;
    }
  });
  return output;
}

function writePermissionsToForm(permissions = {}) {
  const effective = getEffectivePermissions({ permissions });
  document.querySelectorAll("[data-permission]").forEach((input) => {
    const [moduleKey, permKey] = input.dataset.permission.split(".");
    input.checked = effective?.[moduleKey]?.[permKey] === true;
  });
}

function resetForm() {
  qs("#admin-secondary-id").value = "";
  qs("#admin-secondary-name").value = "";
  qs("#admin-secondary-email").value = "";
  writePermissionsToForm(cloneDefaultPermissions());
  updateUidStatusText(null);
}

function summarizePermissions(item) {
  const perms = getEffectivePermissions(item);
  const tags = [];
  Object.keys(perms).forEach((moduleKey) => {
    if (Object.values(perms[moduleKey]).some(Boolean)) {
      tags.push(moduleKey);
    }
  });
  return tags;
}

async function renderList() {
  const root = qs("#admin-secondary-list");
  if (!root) return;
  setStatus("Carregando administradores…");
  const secondary = (await listAdmins()).filter((item) => !isPrimaryAdmin(item));

  root.innerHTML = secondary.length ? secondary.map((item) => `
    <div class="admin-list-card">
      <div>
        <strong>${escapeHtml(item.name || item.nome || "")}</strong>
        <p class="admin-admin-email">${escapeHtml(item.email || "")}</p>
        <p class="admin-admin-email">${item.uid ? `UID vinculado: ${escapeHtml(item.uid)}` : "UID ainda não vinculado"}</p>
        <div class="admin-admin-tags">
          ${summarizePermissions(item).map((tag) => `<span class="admin-admin-tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>
      <div class="admin-list-actions">
        <button type="button" class="button-outline" data-edit-id="${escapeHtml(item.id)}">Editar</button>
        <button type="button" class="button-danger" data-delete-id="${escapeHtml(item.id)}">Excluir</button>
      </div>
    </div>
  `).join("") : "<p>Nenhum administrador secundário cadastrado.</p>";
  setStatus(secondary.length ? `${secondary.length} administrador(es) secundário(s).` : "");

  root.querySelectorAll("[data-edit-id]").forEach((btn) => btn.addEventListener("click", () => {
    const item = secondary.find((entry) => entry.id === btn.dataset.editId);
    if (!item) return;
    qs("#admin-secondary-id").value = item.id || "";
    qs("#admin-secondary-name").value = item.name || item.nome || "";
    qs("#admin-secondary-email").value = item.email || "";
    writePermissionsToForm(item.permissions || {});
    updateUidStatusText(item);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));

  root.querySelectorAll("[data-delete-id]").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("Excluir este administrador secundário?")) return;
    const item = secondary.find((entry) => entry.id === btn.dataset.deleteId);
    btn.disabled = true;
    try {
      await removeSecondaryAdmin(btn.dataset.deleteId);
      await recordAdminActivity({ action: "delete", module: "admins", itemId: btn.dataset.deleteId, itemName: item?.name || item?.email || "Administrador secundário" });
      await renderList();
    } catch (error) {
      console.error("Erro ao excluir administrador:", error);
      setStatus(error?.message || "Não foi possível excluir o administrador.", true);
      btn.disabled = false;
    }
  }));
}

document.addEventListener("DOMContentLoaded", async () => {
  renderPermissionToggles();
  resetForm();
  try {
    await renderList();
  } catch (error) {
    console.error("Erro ao carregar administradores:", error);
    setStatus(error?.message || "Não foi possível carregar os administradores.", true);
  }

  qs("#admin-secondary-reset")?.addEventListener("click", resetForm);

  qs("#admin-admin-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      name: qs("#admin-secondary-name").value.trim(),
      email: qs("#admin-secondary-email").value.trim(),
      permissions: readPermissionsFromForm(),
      active: true
    };
    const existingId = qs("#admin-secondary-id").value.trim();
    setFormBusy(true);
    setStatus("Salvando administrador…");
    try {
      const savedId = await saveSecondaryAdmin(payload, existingId);
      await recordAdminActivity({ action: existingId ? "update" : "create", module: "admins", itemId: savedId, itemName: payload.name, details: payload.email });
      resetForm();
      await renderList();
      setStatus("Administrador salvo com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar administrador:", error);
      setStatus(error?.message || "Não foi possível salvar o administrador.", true);
    } finally {
      setFormBusy(false);
    }
  });
});
