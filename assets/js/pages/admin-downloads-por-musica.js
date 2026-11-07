import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { explainFirebaseError } from "../db.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { listMusicas } from "../services/musicas-service.js";
import { listDownloadsByMusic, saveDownloadByMusic, removeDownloadByMusic } from "../services/downloads-music-service.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

function $(selector) {
  return document.querySelector(selector);
}

let MUSICAS_CACHE = [];
let currentAdmin = null;
let currentEditing = null;
let allDownloads = [];
let hasInitialized = false;

function setStatus(message = "", isError = false) {
  const status = $("#admin-downloads-music-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function can(action) {
  return hasPermission(currentAdmin, "downloadsPorMusica", action);
}

function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

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
          <input type="url" id="download-music-pdf-url" maxlength="1000" />\n          <small class="admin-form-hint">Se for arquivo do Google Drive, será convertido automaticamente em download direto ao salvar.</small>
        </label>

        <label>
          <span>Link do PowerPoint</span>
          <input type="url" id="download-music-ppt-url" maxlength="1000" />\n          <small class="admin-form-hint">Se for arquivo do Google Drive, será convertido automaticamente em download direto ao salvar.</small>
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
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecione uma música";
  select.append(placeholder);
  MUSICAS_CACHE.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.title || "Música sem título";
    select.append(option);
  });
  select.value = selectedId || "";
}

function openModal(item = null) {
  if (!can(item?.id ? "edit" : "create")) return setStatus("Você não tem permissão para esta ação.", true);
  ensureModal();
  currentEditing = item;
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
  currentEditing = null;
}

async function onSubmitForm(event) {
  event.preventDefault();

  const currentId = $("#download-music-id").value.trim();
  if (!can(currentId ? "edit" : "create")) return setStatus("Você não tem permissão para salvar este download.", true);

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
    active: currentId ? currentEditing?.active !== false : true
  };

  try {
    $("#download-music-save").disabled = true;
    const savedId = await saveDownloadByMusic(payload, currentId);
    await recordAdminActivity({ action: currentId ? "update" : "create", module: "downloads_por_musica", itemId: savedId, itemName: payload.title });
    closeModal();
    await loadDownloads();
    setStatus("Download por música salvo com sucesso.");
  } catch (error) {
    console.error("Erro ao salvar download por música:", error);
    setStatus(explainFirebaseError(error), true);
  } finally {
    $("#download-music-save").disabled = false;
  }
}

function renderList() {
  const box = document.getElementById("admin-downloads-music-list");
  if (!box) return;

  box.innerHTML = allDownloads.length ? allDownloads.map((item) => `
    <div class="admin-list-card">
      <div>
        <strong>${escapeHtml(item.title || "")}</strong>
        <p>
          ${item.pdfUrl ? "PDF cadastrado" : ""}
          ${item.pdfUrl && item.pptUrl ? " • " : ""}
          ${item.pptUrl ? "PPT cadastrado" : ""}
        </p>
      </div>
      <div class="admin-list-actions">
        ${can("edit") ? `<button class="button-outline" data-edit-id="${escapeHtml(item.id)}" type="button">Editar</button>` : ""}
        ${can("delete") ? `<button class="button-danger" data-delete-id="${escapeHtml(item.id)}" type="button">Excluir</button>` : ""}
      </div>
    </div>
  `).join("") : "<p>Nenhum download por música cadastrado.</p>";

  box.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = allDownloads.find((x) => x.id === btn.dataset.editId);
      if (!item) return;
      openModal(item);
    });
  });

  box.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir download por música?")) return;
      const id = btn.dataset.deleteId;
      const item = allDownloads.find((x) => x.id === id);
      btn.disabled = true;
      try {
        await removeDownloadByMusic(id);
        await recordAdminActivity({ action: "delete", module: "downloads_por_musica", itemId: id, itemName: item?.title || "Download por música" });
        allDownloads = allDownloads.filter((entry) => entry.id !== id);
        renderList();
        setStatus("Download por música excluído com sucesso.");
      } catch (error) {
        console.error("Erro ao excluir download por música:", error);
        setStatus(explainFirebaseError(error), true);
        btn.disabled = false;
      }
    });
  });
  setStatus(`${allDownloads.length} download(s) por música cadastrado(s).`);
}

async function loadDownloads() {
  allDownloads = await listDownloadsByMusic(false);
  renderList();
}

document.addEventListener("DOMContentLoaded", () => {
  ensureModal();
  document.getElementById("new-download-music-button")?.addEventListener("click", () => openModal());
});

watchAuth(async (user) => {
  if (!user?.uid || !user?.email) return;
  try {
    currentAdmin = await getAdminProfileForUser(user);
    if (!currentAdmin) return;
    document.getElementById("new-download-music-button")?.classList.toggle("hidden", !can("create"));
    if (!hasInitialized) {
      setStatus("Carregando downloads por música…");
      [MUSICAS_CACHE, allDownloads] = await Promise.all([listMusicas(true), listDownloadsByMusic(false)]);
      hasInitialized = true;
    }
    renderList();
  } catch (error) {
    console.error("Erro ao preparar downloads por música:", error);
    setStatus(explainFirebaseError(error), true);
  }
});
