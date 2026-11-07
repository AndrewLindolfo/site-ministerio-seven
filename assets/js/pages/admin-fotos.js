import { watchAuth, getAdminProfileByEmail } from "../auth.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { listAlbuns, saveAlbum, removeAlbum } from "../services/albuns-service.js";
import { isGoogleDriveFileUrl, isGooglePhotosShortUrl } from "../utils/google-drive-links.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

function $(selector) {
  return document.querySelector(selector);
}

function getCoverWarningHtml(coverUrl = "") {
  if (isGooglePhotosShortUrl(coverUrl)) {
    return `<p class="admin-form-warning">Link curto do Google Fotos normalmente não é imagem direta. Para capa, prefira arquivo no Google Drive ou URL direta de imagem.</p>`;
  }
  if (isGoogleDriveFileUrl(coverUrl)) {
    return `<p class="admin-form-warning">Link do Google Drive detectado. Ao salvar, ele será convertido automaticamente para imagem direta.</p>`;
  }
  return "";
}

function ensureAlbumModal() {
  if ($("#album-modal")) return;

  const modal = document.createElement("div");
  modal.id = "album-modal";
  modal.className = "admin-modal hidden";
  modal.innerHTML = `
    <div class="admin-modal-overlay" data-close-album-modal="1"></div>
    <div class="admin-modal-panel">
      <div class="admin-modal-header">
        <h2 id="album-modal-title">Novo álbum</h2>
        <button type="button" class="admin-modal-close" data-close-album-modal="1">✕</button>
      </div>

      <form id="album-form" class="admin-modal-form">
        <input type="hidden" id="album-id" />

        <label>
          <span>Título do álbum</span>
          <input type="text" id="album-title" required />
        </label>

        <label>
          <span>Link do álbum</span>
          <input type="url" id="album-url" required />
        </label>

        <label>
          <span>Link da capa (opcional)</span>
          <input type="url" id="album-cover-url" />
        </label>

        <div id="album-cover-warning-wrap"></div>

        <div class="admin-modal-actions">
          <button type="button" class="button-outline" id="album-cancel">Cancelar</button>
          <button type="submit" class="button-primary" id="album-save">Salvar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelectorAll("[data-close-album-modal='1']").forEach((el) => {
    el.addEventListener("click", closeAlbumModal);
  });

  $("#album-cancel")?.addEventListener("click", closeAlbumModal);

  $("#album-cover-url")?.addEventListener("input", () => {
    const wrap = $("#album-cover-warning-wrap");
    if (!wrap) return;
    wrap.innerHTML = getCoverWarningHtml($("#album-cover-url").value);
  });

  $("#album-form")?.addEventListener("submit", onSubmitAlbumForm);
}

function openAlbumModal(item = null) {
  ensureAlbumModal();

  $("#album-id").value = item?.id || "";
  $("#album-title").value = item?.title || "";
  $("#album-url").value = item?.albumUrl || "";
  $("#album-cover-url").value = item?.coverUrl || "";
  $("#album-modal-title").textContent = item?.id ? "Editar álbum" : "Novo álbum";
  $("#album-cover-warning-wrap").innerHTML = getCoverWarningHtml(item?.coverUrl || "");

  $("#album-modal").classList.remove("hidden");
  document.body.classList.add("modal-open");
  setTimeout(() => $("#album-title")?.focus(), 50);
}

function closeAlbumModal() {
  $("#album-modal")?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

async function onSubmitAlbumForm(event) {
  event.preventDefault();

  const payload = {
    title: $("#album-title").value.trim(),
    albumUrl: $("#album-url").value.trim(),
    coverUrl: $("#album-cover-url").value.trim(),
    active: true
  };

  if (!payload.title || !payload.albumUrl) {
    alert("Preencha título e link do álbum.");
    return;
  }

  if (isGooglePhotosShortUrl(payload.coverUrl)) {
    alert("Aviso: link curto do Google Fotos geralmente não funciona como imagem direta de capa. Se a capa não aparecer, use uma URL direta de imagem.");
  }

  const id = $("#album-id").value.trim();

  try {
    const saveBtn = $("#album-save");
    if (saveBtn) saveBtn.disabled = true;
    const savedId = await saveAlbum(payload, id);
    await recordAdminActivity({ action: id ? "update" : "create", module: "fotos", itemId: savedId, itemName: payload.title });
    closeAlbumModal();
    await renderList();
  } catch (error) {
    console.error("Erro ao salvar álbum:", error);
    alert("Não foi possível salvar o álbum.");
  } finally {
    const saveBtn = $("#album-save");
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function renderList() {
  const box = document.getElementById("admin-fotos-list");
  if (!box) return;

  const all = await listAlbuns(false);
  box.innerHTML = `
    ${all.map((item) => `
      <div class="admin-list-card">
        <div>
          <strong>${item.title || ""}</strong>
          ${item.albumUrl ? `<p>${item.albumUrl}</p>` : ""}
          ${getCoverWarningHtml(item.coverUrl || "")}
        </div>
        <div class="admin-list-actions">
          <button class="button-outline" data-edit-id="${item.id}" type="button">Editar</button>
          <button class="button-danger" data-delete-id="${item.id}" type="button">Excluir</button>
        </div>
      </div>
    `).join("")}
  `;

  box.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const allAlbums = await listAlbuns(false);
      const item = allAlbums.find((x) => x.id === btn.dataset.editId);
      if (!item) return;
      openAlbumModal(item);
    });
  });

  box.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir álbum?")) return;
      const id = btn.dataset.deleteId;
      const allAlbums = await listAlbuns(false);
      const item = allAlbums.find((x) => x.id === id);
      await removeAlbum(id);
      await recordAdminActivity({ action: "delete", module: "fotos", itemId: id, itemName: item?.title || "Álbum" });
      await renderList();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  ensureAlbumModal();
  document.getElementById("new-album-button")?.addEventListener("click", () => openAlbumModal());
  renderList();
});

watchAuth(async (user) => {
  if (!user?.email) return;
  const admin = await getAdminProfileByEmail(user.email);
  if (!admin) return;
  const refresh = async () => {
    await renderList();
    document.getElementById('new-album-button')?.classList.toggle('hidden', !hasPermission(admin,'fotos','create'));
    document.querySelectorAll('[data-edit-id]').forEach((el)=>el.classList.toggle('hidden', !hasPermission(admin,'fotos','edit')));
    document.querySelectorAll('[data-delete-id]').forEach((el)=>el.classList.toggle('hidden', !hasPermission(admin,'fotos','delete')));
  };
  await refresh();
});
