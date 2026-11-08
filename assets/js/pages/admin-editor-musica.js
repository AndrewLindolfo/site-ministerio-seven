import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import "../editor.js";
import { getMusica, saveMusica, findDuplicateMusicaTitle, removeMusica } from "../services/musicas-service.js";
import { explainFirebaseError } from "../db.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";
import { initAdminMusicResearch } from "../modules/admin-music-research.js";
import { sanitizeRichHtml } from "../lib/sanitize-html.js";
import { normalizeYoutubeEmbedUrl } from "../lib/youtube-url.js";

const params = new URLSearchParams(window.location.search);
const musicaId = params.get("id") || "";
let currentAdmin = null;
let currentMusica = null;
let hasInitialized = false;

function setStatus(message = "", isError = false) {
  const status = document.getElementById("admin-editor-musica-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function canSaveMusic() {
  if (!currentAdmin) return false;
  return hasPermission(currentAdmin, "musicas", musicaId ? "edit" : "create");
}

function canDeleteMusic() {
  return Boolean(currentAdmin && musicaId && hasPermission(currentAdmin, "musicas", "delete"));
}

function applyPermissions() {
  document.querySelector('#admin-editor-musica-form button[type="submit"]')?.classList.toggle("hidden", !canSaveMusic());
  document.getElementById("delete-musica-button")?.classList.toggle("hidden", !canDeleteMusic());
}

function getLyricHtml() {
  const editor = window.tinymce?.get("musica-letra");
  if (editor) return editor.getContent();
  return document.getElementById("musica-letra")?.value || "";
}

function setLyricHtml(html = "") {
  const textarea = document.getElementById("musica-letra");
  if (textarea) {
    textarea.value = html || "";
    textarea.dataset.initialValue = html || "";
  }

  const applyToEditor = () => {
    const editor = window.tinymce?.get("musica-letra");
    if (editor) {
      editor.setContent(html || "");
      return true;
    }
    return false;
  };

  if (applyToEditor()) return;

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (applyToEditor() || tries > 30) clearInterval(timer);
  }, 200);
}

function openMusicPreview() {
  const title = document.getElementById("musica-titulo")?.value?.trim() || "";
  if (!title) {
    setStatus("Preencha o título antes de abrir a prévia.", true);
    document.getElementById("musica-titulo")?.focus();
    return;
  }

  const dialog = document.getElementById("preview-musica-dialog");
  const subtitle = document.getElementById("musica-subtitulo")?.value?.trim() || "";
  const author = document.getElementById("musica-autor")?.value?.trim() || "";
  const key = document.getElementById("musica-tom")?.value?.trim() || "";
  const category = document.getElementById("musica-categoria")?.value?.trim() || "";
  const youtubeUrl = document.getElementById("musica-youtube")?.value?.trim() || "";
  const embedUrl = normalizeYoutubeEmbedUrl(youtubeUrl);
  if (youtubeUrl && !embedUrl) {
    setStatus("O link do YouTube não é válido. Use um endereço HTTPS do YouTube.", true);
    document.getElementById("musica-youtube")?.focus();
    return;
  }

  dialog.querySelector("[data-preview-title]").textContent = title;
  const subtitleNode = dialog.querySelector("[data-preview-subtitle]");
  subtitleNode.textContent = subtitle;
  subtitleNode.hidden = !subtitle;
  dialog.querySelector("[data-preview-meta]").textContent = [author, key && `Tom ${key}`, category].filter(Boolean).join(" • ");
  const lyric = dialog.querySelector("[data-preview-lyric]");
  lyric.innerHTML = sanitizeRichHtml(getLyricHtml()) || "<p>Letra ainda não informada.</p>";
  const video = dialog.querySelector("[data-preview-video]");
  video.hidden = !embedUrl;
  video.src = embedUrl || "about:blank";
  setStatus("");
  dialog.showModal();
}

async function loadMusicaIfEditing() {
  if (!musicaId) return;
  const musica = await getMusica(musicaId);
  if (!musica) throw new Error("Música não encontrada.");
  currentMusica = musica;

  document.getElementById("musica-titulo").value = musica.title || "";
  document.getElementById("musica-subtitulo").value = musica.subtitle || "";
  document.getElementById("musica-autor").value = musica.author || "";
  document.getElementById("musica-tom").value = musica.originalKey || "";
  document.getElementById("musica-categoria").value = musica.category || "";
  document.getElementById("musica-youtube").value = musica.youtubeUrl || "";
  document.getElementById("musica-observacao").value = musica.internalNotes || "";

  setLyricHtml(musica.lyricHtml || "");
}

document.addEventListener("DOMContentLoaded", async () => {
  initAdminMusicResearch();
  document.getElementById("preview-musica-button")?.addEventListener("click", openMusicPreview);
  const previewDialog = document.getElementById("preview-musica-dialog");
  previewDialog?.querySelectorAll("[data-action='close-preview']").forEach((button) => button.addEventListener("click", () => {
    previewDialog.querySelector("[data-preview-video]").src = "about:blank";
    previewDialog.close();
  }));
  document.getElementById("admin-editor-musica-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!canSaveMusic()) {
      setStatus("Você não tem permissão para salvar esta música.", true);
      return;
    }

    const submitButton = event.target.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const title = document.getElementById("musica-titulo")?.value?.trim() || "";
      if (!title) {
        setStatus("Preencha o título da música.", true);
        return;
      }

      const duplicate = await findDuplicateMusicaTitle(title, musicaId);
      if (duplicate) {
        const editExisting = confirm("Já existe uma música com este título. Deseja editar a existente?");
        if (editExisting) {
          window.location.href = `./editor-musica.html?id=${encodeURIComponent(duplicate.id)}`;
        }
        return;
      }

      const payload = {
        title,
        subtitle: document.getElementById("musica-subtitulo")?.value?.trim() || "",
        author: document.getElementById("musica-autor")?.value?.trim() || "",
        originalKey: document.getElementById("musica-tom")?.value?.trim() || "",
        category: document.getElementById("musica-categoria")?.value?.trim() || "",
        youtubeUrl: document.getElementById("musica-youtube")?.value?.trim() || "",
        internalNotes: document.getElementById("musica-observacao")?.value?.trim() || "",
        lyricHtml: getLyricHtml(),
        active: musicaId ? currentMusica?.active !== false : true
      };

      setStatus("Salvando música…");
      const savedId = await saveMusica(payload, musicaId);
      await recordAdminActivity({
        action: musicaId ? "update" : "create",
        module: "musicas",
        itemId: savedId,
        itemName: title
      });
      setStatus(musicaId ? "Música atualizada com sucesso." : "Música cadastrada com sucesso.");
      window.location.href = "./musicas.html";
    } catch (error) {
      console.error("Erro ao salvar música:", error);
      setStatus(explainFirebaseError(error), true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.getElementById("delete-musica-button")?.addEventListener("click", async () => {
    if (!canDeleteMusic()) {
      setStatus("Você não tem permissão para excluir esta música.", true);
      return;
    }

    try {
      if (!confirm("Deseja excluir esta música?")) return;
      const deleteButton = document.getElementById("delete-musica-button");
      if (deleteButton) deleteButton.disabled = true;
      const musicaName = document.getElementById("musica-titulo")?.value?.trim() || "Música";
      await removeMusica(musicaId);
      await recordAdminActivity({ action: "delete", module: "musicas", itemId: musicaId, itemName: musicaName });
      window.location.href = "./musicas.html";
    } catch (error) {
      console.error("Erro ao excluir música:", error);
      setStatus(explainFirebaseError(error), true);
      const deleteButton = document.getElementById("delete-musica-button");
      if (deleteButton) deleteButton.disabled = false;
    }
  });
});

watchAuth(async (user) => {
  if (!user?.uid || !user?.email) return;
  try {
    currentAdmin = await getAdminProfileForUser(user);
    if (!currentAdmin) return;
    applyPermissions();
    if (!hasInitialized) {
      setStatus(musicaId ? "Carregando música…" : "");
      await loadMusicaIfEditing();
      hasInitialized = true;
      setStatus("");
    }
  } catch (error) {
    console.error("Erro ao preparar o editor de música:", error);
    setStatus(explainFirebaseError(error), true);
  }
});
