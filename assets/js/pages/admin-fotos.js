import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { explainFirebaseError } from "../db.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { listAlbuns, saveAlbum, removeAlbum } from "../services/albuns-service.js";
import { isGoogleDriveFileUrl, isGooglePhotosShortUrl } from "../utils/google-drive-links.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

const $ = (selector) => document.querySelector(selector);
let currentAdmin = null;
let currentEditing = null;
let allAlbums = [];
let hasInitialized = false;

function setStatus(message = "", isError = false) {
  const status = $("#admin-fotos-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function can(action) {
  return hasPermission(currentAdmin, "fotos", action);
}

function getCoverWarning(coverUrl = "") {
  if (isGooglePhotosShortUrl(coverUrl)) return "Link curto do Google Fotos normalmente não é imagem direta. Prefira um arquivo no Google Drive ou uma URL direta de imagem.";
  if (isGoogleDriveFileUrl(coverUrl)) return "Link do Google Drive detectado. Ao salvar, ele será convertido automaticamente para imagem direta.";
  return "";
}

function renderWarning(root, coverUrl = "") {
  if (!root) return;
  root.replaceChildren();
  const warning = getCoverWarning(coverUrl);
  if (!warning) return;
  const message = document.createElement("p");
  message.className = "admin-form-warning";
  message.textContent = warning;
  root.append(message);
}

function ensureAlbumModal() {
  if ($("#album-modal")) return;
  const modal = document.createElement("div");
  modal.id = "album-modal";
  modal.className = "admin-modal hidden";
  modal.innerHTML = `
    <div class="admin-modal-overlay" data-close-album-modal="1"></div>
    <div class="admin-modal-panel" role="dialog" aria-modal="true" aria-labelledby="album-modal-title">
      <div class="admin-modal-header">
        <h2 id="album-modal-title">Novo álbum</h2>
        <button type="button" class="admin-modal-close" data-close-album-modal="1" aria-label="Fechar">✕</button>
      </div>
      <form id="album-form" class="admin-modal-form">
        <input type="hidden" id="album-id" />
        <label><span>Título do álbum</span><input type="text" id="album-title" maxlength="200" required /></label>
        <label><span>Link do álbum</span><input type="url" id="album-url" maxlength="1000" required /></label>
        <label><span>Link da capa (opcional)</span><input type="url" id="album-cover-url" maxlength="1000" /></label>
        <div id="album-cover-warning-wrap"></div>
        <div class="admin-modal-actions">
          <button type="button" class="button-outline" id="album-cancel">Cancelar</button>
          <button type="submit" class="button-primary" id="album-save">Salvar</button>
        </div>
      </form>
    </div>`;
  document.body.append(modal);
  modal.querySelectorAll("[data-close-album-modal='1']").forEach((element) => element.addEventListener("click", closeAlbumModal));
  $("#album-cancel")?.addEventListener("click", closeAlbumModal);
  $("#album-cover-url")?.addEventListener("input", (event) => renderWarning($("#album-cover-warning-wrap"), event.target.value));
  $("#album-form")?.addEventListener("submit", onSubmitAlbumForm);
}

function openAlbumModal(item = null) {
  if (!can(item?.id ? "edit" : "create")) return setStatus("Você não tem permissão para esta ação.", true);
  ensureAlbumModal();
  currentEditing = item;
  $("#album-id").value = item?.id || "";
  $("#album-title").value = item?.title || "";
  $("#album-url").value = item?.albumUrl || "";
  $("#album-cover-url").value = item?.coverUrl || "";
  $("#album-modal-title").textContent = item?.id ? "Editar álbum" : "Novo álbum";
  renderWarning($("#album-cover-warning-wrap"), item?.coverUrl || "");
  $("#album-modal").classList.remove("hidden");
  document.body.classList.add("modal-open");
  $("#album-title")?.focus();
}

function closeAlbumModal() {
  $("#album-modal")?.classList.add("hidden");
  document.body.classList.remove("modal-open");
  currentEditing = null;
}

async function onSubmitAlbumForm(event) {
  event.preventDefault();
  const id = $("#album-id").value.trim();
  if (!can(id ? "edit" : "create")) return setStatus("Você não tem permissão para salvar este álbum.", true);
  const payload = {
    title: $("#album-title").value.trim(),
    albumUrl: $("#album-url").value.trim(),
    coverUrl: $("#album-cover-url").value.trim(),
    active: id ? currentEditing?.active !== false : true
  };
  const save = $("#album-save");
  save.disabled = true;
  try {
    setStatus("Salvando álbum…");
    const savedId = await saveAlbum(payload, id);
    await recordAdminActivity({ action: id ? "update" : "create", module: "fotos", itemId: savedId, itemName: payload.title });
    closeAlbumModal();
    await loadAlbums();
    setStatus("Álbum salvo com sucesso.");
  } catch (error) {
    console.error("Erro ao salvar álbum:", error);
    setStatus(explainFirebaseError(error), true);
  } finally {
    save.disabled = false;
  }
}

function buildAlbumCard(item) {
  const card = document.createElement("div");
  card.className = "admin-list-card";
  const details = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = item.title || "Álbum sem título";
  details.append(title);
  if (item.albumUrl) {
    const url = document.createElement("p");
    url.textContent = item.albumUrl;
    details.append(url);
  }
  const warningWrap = document.createElement("div");
  renderWarning(warningWrap, item.coverUrl || "");
  details.append(warningWrap);
  const actions = document.createElement("div");
  actions.className = "admin-list-actions";
  if (can("edit")) {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "button-outline";
    edit.textContent = "Editar";
    edit.addEventListener("click", () => openAlbumModal(item));
    actions.append(edit);
  }
  if (can("delete")) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button-danger";
    remove.textContent = "Excluir";
    remove.addEventListener("click", async () => {
      if (!confirm(`Excluir o álbum “${item.title || "Sem título"}”?`)) return;
      remove.disabled = true;
      try {
        await removeAlbum(item.id);
        await recordAdminActivity({ action: "delete", module: "fotos", itemId: item.id, itemName: item.title || "Álbum" });
        allAlbums = allAlbums.filter((album) => album.id !== item.id);
        renderList();
        setStatus("Álbum excluído com sucesso.");
      } catch (error) {
        console.error("Erro ao excluir álbum:", error);
        setStatus(explainFirebaseError(error), true);
        remove.disabled = false;
      }
    });
    actions.append(remove);
  }
  card.append(details, actions);
  return card;
}

function renderList() {
  const box = $("#admin-fotos-list");
  if (!box || !currentAdmin) return;
  box.replaceChildren(...allAlbums.map(buildAlbumCard));
  if (!allAlbums.length) {
    const empty = document.createElement("p");
    empty.textContent = "Nenhum álbum cadastrado.";
    box.append(empty);
  }
  setStatus(`${allAlbums.length} álbum(ns) cadastrado(s).`);
}

async function loadAlbums() {
  allAlbums = await listAlbuns(false);
  renderList();
}

document.addEventListener("DOMContentLoaded", () => {
  ensureAlbumModal();
  $("#new-album-button")?.addEventListener("click", () => openAlbumModal());
});

watchAuth(async (user) => {
  if (!user?.uid || !user?.email) return;
  try {
    currentAdmin = await getAdminProfileForUser(user);
    if (!currentAdmin) return;
    $("#new-album-button")?.classList.toggle("hidden", !can("create"));
    if (!hasInitialized) {
      setStatus("Carregando álbuns…");
      await loadAlbums();
      hasInitialized = true;
    } else renderList();
  } catch (error) {
    console.error("Erro ao preparar álbuns:", error);
    setStatus(explainFirebaseError(error), true);
  }
});
