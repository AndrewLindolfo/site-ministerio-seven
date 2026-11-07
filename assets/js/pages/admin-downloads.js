import { watchAuth, getAdminProfileByEmail } from "../auth.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { listDownloads, saveDownload, removeDownload } from "../services/downloads-service.js";
import { isGoogleDriveFileUrl, detectGoogleResourceType } from "../utils/google-drive-links.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

function $(selector) {
  return document.querySelector(selector);
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
          <input type="text" id="download-title" required />
        </label>

        <label>
          <span>Link do download</span>
          <input type="url" id="download-url" required />
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
          <textarea id="download-description" rows="3"></textarea>
        </label>

        <label>
          <span>Imagem (opcional)</span>
          <input type="url" id="download-image-url" />\n          <small class="admin-form-hint" id="download-image-hint">Se for arquivo de imagem do Google Drive, será convertido automaticamente em imagem direta ao salvar.</small>
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
  ensureDownloadModal();

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
}

async function onSubmitDownloadForm(event) {
  event.preventDefault();

  const payload = {
    title: $("#download-title").value.trim(),
    url: $("#download-url").value.trim(),
    linkType: $("#download-link-type").value.trim() || "direct-download",
    description: $("#download-description").value.trim(),
    imageUrl: $("#download-image-url").value.trim(),
    active: true
  };

  if (!payload.title || !payload.url) {
    alert("Preencha título e link do download.");
    return;
  }

  const id = $("#download-id").value.trim();

  try {
    const saveBtn = $("#download-save");
    if (saveBtn) saveBtn.disabled = true;
    const savedId = await saveDownload(payload, id);
    await recordAdminActivity({ action: id ? "update" : "create", module: "downloads", itemId: savedId, itemName: payload.title });
    closeDownloadModal();
    await renderList();
  } catch (error) {
    console.error("Erro ao salvar download:", error);
    alert("Não foi possível salvar o download.");
  } finally {
    const saveBtn = $("#download-save");
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function renderList() {
  const box = document.getElementById("admin-downloads-list");
  if (!box) return;

  const all = await listDownloads(false);
  box.innerHTML = `
    ${all.map((item) => `
      <div class="admin-list-card">
        <div><strong>${item.title || ""}</strong>${item.description ? `<p>${item.description}</p>` : ""}</div>
        <div class="admin-list-actions">
          <button class="button-outline" data-edit-id="${item.id}" type="button">Editar</button>
          <button class="button-danger" data-delete-id="${item.id}" type="button">Excluir</button>
        </div>
      </div>
    `).join("")}
  `;

  box.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const allItems = await listDownloads(false);
      const item = allItems.find((x) => x.id === btn.dataset.editId);
      if (!item) return;
      openDownloadModal(item);
    });
  });

  box.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir download?")) return;
      const id = btn.dataset.deleteId;
      const allItems = await listDownloads(false);
      const item = allItems.find((x) => x.id === id);
      await removeDownload(id);
      await recordAdminActivity({ action: "delete", module: "downloads", itemId: id, itemName: item?.title || "Download" });
      await renderList();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  ensureDownloadModal();
  $("#download-url")?.addEventListener("input", updateDownloadTypeHint);
  $("#download-link-type")?.addEventListener("change", updateDownloadTypeHint);
  document.getElementById("new-download-button")?.addEventListener("click", () => openDownloadModal());
  renderList();
});

watchAuth(async (user) => {
  if (!user?.email) return;
  const admin = await getAdminProfileByEmail(user.email);
  if (!admin) return;
  const refresh = async () => {
    await renderList();
    document.getElementById('new-download-button')?.classList.toggle('hidden', !hasPermission(admin,'downloadsGerais','create'));
    document.querySelectorAll('[data-edit-id]').forEach((el)=>el.classList.toggle('hidden', !hasPermission(admin,'downloadsGerais','edit')));
    document.querySelectorAll('[data-delete-id]').forEach((el)=>el.classList.toggle('hidden', !hasPermission(admin,'downloadsGerais','delete')));
  };
  await refresh();
});
