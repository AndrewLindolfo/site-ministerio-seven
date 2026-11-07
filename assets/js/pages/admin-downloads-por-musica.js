import { watchAuth, getAdminProfileByEmail } from "../auth.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { listMusicas } from "../services/musicas-service.js";
import { listDownloadsByMusic, saveDownloadByMusic, removeDownloadByMusic } from "../services/downloads-music-service.js";
import { isGoogleDriveFileUrl } from "../utils/google-drive-links.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

function $(selector) {
  return document.querySelector(selector);
}

let MUSICAS_CACHE = [];

function ensureModal() {
  if ($("#download-music-modal")) return;

  const modal = document.createElement("div");
  modal.id = "download-music-modal";
  modal.className = "admin-modal hidden";
  modal.innerHTML = `
    <div class="admin-modal-overlay" data-close-download-music-modal="1"></div>
    <div class="admin-modal-panel">
      <div class="admin-modal-header">
        <h2 id="download-music-modal-title">Novo download por música</h2>
        <button type="button" class="admin-modal-close" data-close-download-music-modal="1">✕</button>
      </div>

      <form id="download-music-form" class="admin-modal-form">
        <input type="hidden" id="download-music-id" />

        <label>
          <span>Música</span>
          <select id="download-music-musica" required></select>
        </label>

        <label>
          <span>Link do PDF</span>
          <input type="url" id="download-music-pdf-url" />\n          <small class="admin-form-hint">Se for arquivo do Google Drive, será convertido automaticamente em download direto ao salvar.</small>
        </label>

        <label>
          <span>Link do PowerPoint</span>
          <input type="url" id="download-music-ppt-url" />\n          <small class="admin-form-hint">Se for arquivo do Google Drive, será convertido automaticamente em download direto ao salvar.</small>
        </label>

        <p class="admin-downloads-music-summary">Preencha pelo menos um dos dois links: PDF ou PPT.</p>

        <div class="admin-modal-actions">
          <button type="button" class="button-outline" id="download-music-cancel">Cancelar</button>
          <button type="submit" class="button-primary" id="download-music-save">Salvar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelectorAll("[data-close-download-music-modal='1']").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  $("#download-music-cancel")?.addEventListener("click", closeModal);
  $("#download-music-form")?.addEventListener("submit", onSubmitForm);
}

function fillMusicSelect(selectedId = "") {
  const select = $("#download-music-musica");
  if (!select) return;
  select.innerHTML = `
    <option value="">Selecione uma música</option>
    ${MUSICAS_CACHE.map((item) => `<option value="${item.id}">${item.title || ""}</option>`).join("")}
  `;
  select.value = selectedId || "";
}

function openModal(item = null) {
  ensureModal();
  $("#download-music-id").value = item?.id || "";
  $("#download-music-pdf-url").value = item?.pdfUrl || "";
  $("#download-music-ppt-url").value = item?.pptUrl || "";
  $("#download-music-modal-title").textContent = item?.id ? "Editar download por música" : "Novo download por música";
  fillMusicSelect(item?.musicaId || "");
  $("#download-music-modal").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  $("#download-music-modal")?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

async function onSubmitForm(event) {
  event.preventDefault();

  const musicaId = $("#download-music-musica").value.trim();
  const musica = MUSICAS_CACHE.find((item) => item.id === musicaId);
  const pdfUrl = $("#download-music-pdf-url").value.trim();
  const pptUrl = $("#download-music-ppt-url").value.trim();

  if (!musicaId || (!pdfUrl && !pptUrl)) {
    alert("Selecione a música e preencha pelo menos um link (PDF ou PPT).");
    return;
  }

  const payload = {
    musicaId,
    title: musica?.title || "",
    slug: musica?.slug || "",
    pdfUrl,
    pptUrl,
    active: true
  };

  try {
    $("#download-music-save").disabled = true;
    const currentId = $("#download-music-id").value.trim();
    const savedId = await saveDownloadByMusic(payload, currentId);
    await recordAdminActivity({ action: currentId ? "update" : "create", module: "downloads_por_musica", itemId: savedId, itemName: payload.title });
    closeModal();
    await renderList();
  } catch (error) {
    console.error("Erro ao salvar download por música:", error);
    alert("Não foi possível salvar o download por música.");
  } finally {
    $("#download-music-save").disabled = false;
  }
}

async function renderList() {
  const box = document.getElementById("admin-downloads-music-list");
  if (!box) return;

  const all = await listDownloadsByMusic(false);
  box.innerHTML = all.length ? all.map((item) => `
    <div class="admin-list-card">
      <div>
        <strong>${item.title || ""}</strong>
        <p>
          ${item.pdfUrl ? "PDF cadastrado" : ""}
          ${item.pdfUrl && item.pptUrl ? " • " : ""}
          ${item.pptUrl ? "PPT cadastrado" : ""}
        </p>
      </div>
      <div class="admin-list-actions">
        <button class="button-outline" data-edit-id="${item.id}" type="button">Editar</button>
        <button class="button-danger" data-delete-id="${item.id}" type="button">Excluir</button>
      </div>
    </div>
  `).join("") : "<p>Nenhum download por música cadastrado.</p>";

  box.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const allItems = await listDownloadsByMusic(false);
      const item = allItems.find((x) => x.id === btn.dataset.editId);
      if (!item) return;
      openModal(item);
    });
  });

  box.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir download por música?")) return;
      const id = btn.dataset.deleteId;
      const allItems = await listDownloadsByMusic(false);
      const item = allItems.find((x) => x.id === id);
      await removeDownloadByMusic(id);
      await recordAdminActivity({ action: "delete", module: "downloads_por_musica", itemId: id, itemName: item?.title || "Download por música" });
      await renderList();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  ensureModal();
  MUSICAS_CACHE = await listMusicas(true);
  document.getElementById("new-download-music-button")?.addEventListener("click", () => openModal());
  renderList();
});

watchAuth(async (user) => {
  if (!user?.email) return;
  const admin = await getAdminProfileByEmail(user.email);
  if (!admin) return;
  const refresh = async () => {
    await renderList();
    document.getElementById('new-download-music-button')?.classList.toggle('hidden', !hasPermission(admin,'downloadsPorMusica','create'));
    document.querySelectorAll('[data-edit-id]').forEach((el)=>el.classList.toggle('hidden', !hasPermission(admin,'downloadsPorMusica','edit')));
    document.querySelectorAll('[data-delete-id]').forEach((el)=>el.classList.toggle('hidden', !hasPermission(admin,'downloadsPorMusica','delete')));
  };
  await refresh();
});
