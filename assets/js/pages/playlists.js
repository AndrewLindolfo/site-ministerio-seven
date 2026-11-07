import { getCurrentPublicUser, openPublicAuthModal, watchPublicAuth, whenPublicAuthReady } from "../public-auth.js";
import { getUserLibrary, createPlaylist, removePlaylist, removeItemFromPlaylist } from "../services/user-library-service.js";

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function groupItems(items = []) {
  const grouped = new Map();
  items.forEach((item) => {
    const key = `${String(item.title || "").trim().toLowerCase()}__${String(item.slug || "").trim().toLowerCase()}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        title: item.title || "",
        musica: null,
        cifra: null
      });
    }
    const row = grouped.get(key);
    if (item.type === "musica" && !row.musica) row.musica = item;
    if (item.type === "cifra" && !row.cifra) row.cifra = item;
  });
  return Array.from(grouped.values()).sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "pt-BR"));
}

function renderPlaylistBody(playlist) {
  const grouped = groupItems(playlist.items || []);
  if (!grouped.length) {
    return '<div class="personal-library-empty">Playlist vazia.</div>';
  }

  return grouped.map((row) => `
    <div class="personal-playlist-item personal-playlist-item--grouped">
      <div class="personal-library-title">${escapeHtml(row.title)}</div>
      <div class="personal-library-actions">
        ${row.musica ? `<span class="personal-library-chip-wrap"><a class="personal-library-chip" href="${row.musica.href}">Música</a><button type="button" class="personal-playlist-remove" data-remove-item="${playlist.id}|${row.musica.key}" aria-label="Remover música">✕</button></span>` : ""}
        ${row.cifra ? `<span class="personal-library-chip-wrap"><a class="personal-library-chip" href="${row.cifra.href}">Cifra</a><button type="button" class="personal-playlist-remove" data-remove-item="${playlist.id}|${row.cifra.key}" aria-label="Remover cifra">✕</button></span>` : ""}
      </div>
    </div>
  `).join("");
}

async function renderPlaylists() {
  const hint = document.getElementById("playlists-login-hint");
  const list = document.getElementById("playlists-list");
  const createBtn = document.getElementById("new-playlist-page-button");
  const user = getCurrentPublicUser();

  if (!user?.uid) {
    createBtn?.setAttribute("disabled","disabled");
    if (hint) {
      hint.classList.remove("hidden");
      hint.innerHTML = 'Faça login para usar playlists. <button type="button" id="playlists-login-button" class="personal-library-primary">Entrar</button>';
      document.getElementById("playlists-login-button")?.addEventListener("click", openPublicAuthModal);
    }
    if (list) list.innerHTML = "";
    return;
  }

  createBtn?.removeAttribute("disabled");
  hint?.classList.add("hidden");

  const library = await getUserLibrary(user.uid);
  if (list) {
    if (!library.playlists.length) {
      list.innerHTML = '<div class="personal-library-empty">Nenhuma playlist criada ainda.</div>';
    } else {
      list.innerHTML = library.playlists.map((playlist, idx) => `
        <div class="personal-playlist-card" data-playlist-id="${playlist.id}">
          <div class="personal-playlist-head">
            <button type="button" class="personal-playlist-toggle" data-toggle-playlist="${playlist.id}">${escapeHtml(playlist.name)} <small>(${playlist.items.length})</small></button>
            <button type="button" class="personal-playlist-delete" data-delete-playlist="${playlist.id}">Excluir</button>
          </div>
          <div class="personal-playlist-body ${idx === 0 ? "" : "hidden"}" id="playlist-body-${playlist.id}">
            ${renderPlaylistBody(playlist)}
          </div>
        </div>
      `).join("");
    }
  }

  document.querySelectorAll("[data-toggle-playlist]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.togglePlaylist;
      document.querySelectorAll(".personal-playlist-body").forEach((body) => {
        body.classList.toggle("hidden", body.id !== `playlist-body-${id}`);
      });
    });
  });

  document.querySelectorAll("[data-delete-playlist]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Excluir playlist?")) return;
      await removePlaylist(user.uid, button.dataset.deletePlaylist);
      await renderPlaylists();
    });
  });

  document.querySelectorAll("[data-remove-item]").forEach((button) => {
    button.addEventListener("click", async () => {
      const [playlistId, itemKey] = button.dataset.removeItem.split("|");
      await removeItemFromPlaylist(user.uid, playlistId, itemKey);
      await renderPlaylists();
    });
  });
}

async function createNewPlaylistFromPage() {
  const user = getCurrentPublicUser();
  if (!user?.uid) {
    openPublicAuthModal();
    return;
  }
  const name = prompt("Nome da playlist:");
  if (!name || !name.trim()) return;
  await createPlaylist(user.uid, name.trim());
  await renderPlaylists();
}

document.addEventListener("DOMContentLoaded", async () => {
  await whenPublicAuthReady();
  document.getElementById("new-playlist-page-button")?.addEventListener("click", createNewPlaylistFromPage);
  await renderPlaylists();
  watchPublicAuth(() => renderPlaylists());
});
