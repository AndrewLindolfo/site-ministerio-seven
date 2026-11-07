import { watchAuth, getAdminProfileByEmail } from "../auth.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import "../editor.js";
import { getMusica, saveMusica, findDuplicateMusicaTitle, removeMusica } from "../services/musicas-service.js";
import { explainFirebaseError } from "../db.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

const params = new URLSearchParams(window.location.search);
const musicaId = params.get("id") || "";

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

async function loadMusicaIfEditing() {
  if (!musicaId) return;
  const musica = await getMusica(musicaId);
  if (!musica) return;

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
  await loadMusicaIfEditing();

  document.getElementById("admin-editor-musica-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = event.target.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const title = document.getElementById("musica-titulo")?.value?.trim() || "";
      if (!title) {
        alert("Preencha o título da música.");
        return;
      }

      const duplicate = await findDuplicateMusicaTitle(title, musicaId);
      if (duplicate) {
        const editExisting = confirm("Já existe uma música com este título. Deseja editar a existente?");
        if (editExisting) {
          window.location.href = `./editor-musica.html?id=${duplicate.id}`;
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
        active: true
      };

      const savedId = await saveMusica(payload, musicaId);
      await recordAdminActivity({
        action: musicaId ? "update" : "create",
        module: "musicas",
        itemId: savedId,
        itemName: title
      });
      alert(musicaId ? "✅ Música atualizada com sucesso!" : "✅ Música cadastrada com sucesso!");
      window.location.href = "./musicas.html";
    } catch (error) {
      console.error("Erro ao salvar música:", error);
      alert("Erro ao salvar música no Firebase.\n\n" + explainFirebaseError(error));
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.getElementById("delete-musica-button")?.addEventListener("click", async () => {
    if (!musicaId) {
      alert("Esta música ainda não foi salva.");
      return;
    }

    try {
      if (!confirm("Deseja excluir esta música?")) return;
      const musicaName = document.getElementById("musica-titulo")?.value?.trim() || "Música";
      await removeMusica(musicaId);
      await recordAdminActivity({ action: "delete", module: "musicas", itemId: musicaId, itemName: musicaName });
      alert("🗑️ Música excluída com sucesso!");
      window.location.href = "./musicas.html";
    } catch (error) {
      console.error("Erro ao excluir música:", error);
      alert("Erro ao excluir música no Firebase.\n\n" + explainFirebaseError(error));
    }
  });
});

watchAuth(async (user) => {
  if (!user?.email) return;
  const admin = await getAdminProfileByEmail(user.email);
  if (!admin) return;
  const isEdit = !!musicaId;
  const canSave = isEdit ? hasPermission(admin, 'musicas', 'edit') : hasPermission(admin, 'musicas', 'create');
  const canDelete = isEdit && hasPermission(admin, 'musicas', 'delete');
  document.querySelector('#admin-editor-musica-form button[type="submit"]')?.classList.toggle('hidden', !canSave);
  document.getElementById('delete-musica-button')?.classList.toggle('hidden', !canDelete);
});
