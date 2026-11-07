import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { explainFirebaseError } from "../db.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { listDownloads, saveDownload, removeDownload } from "../services/downloads-service.js";
import { detectGoogleResourceType } from "../utils/google-drive-links.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

function $(selector) {
  return document.querySelector(selector);
}

let currentAdmin = null;
let currentEditing = null;
let allDownloads = [];
let hasInitialized = false;

function setStatus(message = "", isError = false) {
  const status = $("#admin-downloads-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function can(action) {
  return hasPermission(currentAdmin, "downloadsGerais", action);
}

function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function ensureDownloadModal() {
  if ($("#download-modal")) return;

  const modal = document.createElement("div");
  modal.id = "download-modal";
  modal.className = "admin-modal hidden";
  modal.innerHTML = `
    <div class="admin-modal-overlay" data-close-download-modal="1"></div>
    <div class="admin-modal-panel">
      <div class="admin-modal-header">
        <h2 id="download-modal-title">Novo download</h2>
        <button type="button" class="admin-modal-close" data-close-download-modal="1">✕</button>
      </div>

      <form id="download-form" class="admin-modal-form">
        <input type="hidden" id="download-id" />

        <label>
          <span>Título do download</span>
          <input type="text" id="download-title" maxlength="200" required />
        </label>

        <label>
          <span>Link do download</span>
          <input type="url" id="download-url" maxlength="1000" required />
        </label>

        <label>
          <span>Tipo do link</span>
          <select id="download-link-type">
            <option value="keep">Manter link original</option>
            <option value="drive-folder">Pasta / Link do Drive</option>
            <option value="direct-download" selected>Arquivo para download</option>
            <option value="pdf">PDF</option>
            <option value="powerpoint">PowerPoint / Google Slides</option>
          </select>
          <small class="admin-form-hint" id="download-url-hint">Escolha como o site deve tratar o link no salvar.</small>
        </label>

        <label>
          <span>Descrição (opcional)</span>
          <textarea id="download-description" rows="3" maxlength="1000"></textarea>
        </label>

        <label>
          <span>Imagem (opcional)</span>
          <input type="url" id="download-image-url" maxlength="1000" />\n          <small class="admin-form-hint" id="download-image-hint">Se for arquivo de imagem do Google Drive, será convertido automaticamente em imagem direta ao salvar.</small>
        </label>

        <div class="admin-modal-actions">
          <button type="button" class="button-outline" id="download-cancel">Cancelar</button>
          <button type="submit" class="button-primary" id="download-save">Salvar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelectorAll("[data-close-download-modal='1']").forEach((el) => {
    el.addEventListener("click", closeDownloadModal);
  });

  $("#download-cancel")?.addEventListener("click", closeDownloadModal);
  $("#download-form")?.addEventListener("submit", onSubmitDownloadForm);
}


function updateDownloadTypeHint() {
  const urlInput = $("#download-url");
  const typeSelect = $("#download-link-type");
  const hint = $("#download-url-hint");
  if (!urlInput || !typeSelect || !hint) return;

  const value = urlInput.value.trim();
  const type = typeSelect.value;
  const resourceType = detectGoogleResourceType(value);

  if (!value) {
    hint.textContent = "Escolha como o site deve tratar o link no salvar.";
    return;
  }

  if (type === "keep") {
    hint.textContent = "O link será salvo exatamente como você colou.";
    return;
  }
  if (type === "drive-folder") {
    hint.textContent = "Use esta opção para pastas ou links do Drive que não devem ser convertidos.";
    return;
  }
  if (type === "pdf") {
    hint.textContent = resourceType === "google-slides"
      ? "Link de Google Slides detectado: será convertido para exportação em PDF."
      : "O link será convertido para PDF direto quando possível.";
    return;
  }
  if (type === "powerpoint") {
    hint.textContent = resourceType === "google-slides"
      ? "Link de Google Slides detectado: será convertido para exportação em PPTX."
      : "O link será tratado como PowerPoint / apresentação para download direto.";
    return;
  }
  hint.textContent = "O link será convertido para download direto quando possível.";
}


function openDownloadModal(item = null) {
  if (!can(item?.id ? "edit" : "create")) return setStatus("Você não tem permissão para esta ação.", true);
  ensureDownloadModal();
  currentEditing = item;

  $("#download-id").value = item?.id || "";
  $("#download-title").value = item?.title || "";
  $("#download-url").value = item?.url || "";
  $("#download-description").value = item?.description || "";
  $("#download-link-type").value = item?.linkType || "direct-download";
  $("#download-image-url").value = item?.imageUrl || "";
  $("#download-modal-title").textContent = item?.id ? "Editar download" : "Novo download";

  $("#download-modal").classList.remove("hidden");
  document.body.classList.add("modal-open");
  updateDownloadTypeHint();
  setTimeout(() => $("#download-title")?.focus(), 50);
}

function closeDownloadModal() {
  $("#download-modal")?.classList.add("hidden");
  document.body.classList.remove("modal-open");
  currentEditing = null;
}

async function onSubmitDownloadForm(event) {
  event.preventDefault();

  const id = $("#download-id").value.trim();
  if (!can(id ? "edit" : "create")) return setStatus("Você não tem permissão para salvar este download.", true);

  const payload = {
    title: $("#download-title").value.trim(),
    url: $("#download-url").value.trim(),
    linkType: $("#download-link-type").value.trim() || "direct-download",
    description: $("#download-description").value.trim(),
    imageUrl: $("#download-image-url").value.trim(),
    active: id ? currentEditing?.active !== false : true
  };

  if (!payload.title || !payload.url) {
    alert("Preencha título e link do download.");
    return;
  }

  try {
    const saveBtn = $("#download-save");
    if (saveBtn) saveBtn.disabled = true;
    const savedId = await saveDownload(payload, id);
    await recordAdminActivity({ action: id ? "update" : "create", module: "downloads", itemId: savedId, itemName: payload.title });
    closeDownloadModal();
    await loadDownloads();
    setStatus("Download salvo com sucesso.");
  } catch (error) {
    console.error("Erro ao salvar download:", error);
    setStatus(explainFirebaseError(error), true);
  } finally {
    const saveBtn = $("#download-save");
    if (saveBtn) saveBtn.disabled = false;
  }
}

function renderList() {
  const box = document.getElementById("admin-downloads-list");
  if (!box) return;

  box.innerHTML = `
    ${allDownloads.map((item) => `
      <div class="admin-list-card">
        <div><strong>${escapeHtml(item.title || "")}</strong>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}</div>
        <div class="admin-list-actions">
          ${can("edit") ? `<button class="button-outline" data-edit-id="${escapeHtml(item.id)}" type="button">Editar</button>` : ""}
          ${can("delete") ? `<button class="button-danger" data-delete-id="${escapeHtml(item.id)}" type="button">Excluir</button>` : ""}
        </div>
      </div>
    `).join("")}
  `;

  box.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = allDownloads.find((x) => x.id === btn.dataset.editId);
      if (!item) return;
      openDownloadModal(item);
    });
  });

  box.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir download?")) return;
      const id = btn.dataset.deleteId;
      const item = allDownloads.find((x) => x.id === id);
      btn.disabled = true;
      try {
        await removeDownload(id);
        await recordAdminActivity({ action: "delete", module: "downloads", itemId: id, itemName: item?.title || "Download" });
        allDownloads = allDownloads.filter((entry) => entry.id !== id);
        renderList();
        setStatus("Download excluído com sucesso.");
      } catch (error) {
        console.error("Erro ao excluir download:", error);
        setStatus(explainFirebaseError(error), true);
        btn.disabled = false;
      }
    });
  });
  setStatus(`${allDownloads.length} download(s) cadastrado(s).`);
}

async function loadDownloads() {
  allDownloads = await listDownloads(false);
  renderList();
}

document.addEventListener("DOMContentLoaded", () => {
  ensureDownloadModal();
  $("#download-url")?.addEventListener("input", updateDownloadTypeHint);
  $("#download-link-type")?.addEventListener("change", updateDownloadTypeHint);
  document.getElementById("new-download-button")?.addEventListener("click", () => openDownloadModal());
});

watchAuth(async (user) => {
  if (!user?.uid || !user?.email) return;
  try {
    currentAdmin = await getAdminProfileForUser(user);
    if (!currentAdmin) return;
    document.getElementById("new-download-button")?.classList.toggle("hidden", !can("create"));
    if (!hasInitialized) {
      setStatus("Carregando downloads…");
      await loadDownloads();
      hasInitialized = true;
    } else renderList();
  } catch (error) {
    console.error("Erro ao preparar downloads:", error);
    setStatus(explainFirebaseError(error), true);
  }
});
