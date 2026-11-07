import { getCurrentPublicUser, openPublicAuthModal, watchPublicAuth, whenPublicAuthReady } from "../public-auth.js";
import { getUserLibrary, createPlaylist, removePlaylist, removeItemFromPlaylist } from "../services/user-library-service.js";
import { normalizeInternalHref } from "../modules/alphabet-filter.js";

function groupItems(items = []) {
  const groups = new Map();
  for (const item of items) {
    const key = `${String(item.title || "").trim().toLowerCase()}__${String(item.slug || "").trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { title: item.title || "Sem título", musica: null, cifra: null });
    const row = groups.get(key);
    if (item.type === "musica" && !row.musica) row.musica = item;
    if (item.type === "cifra" && !row.cifra) row.cifra = item;
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

function createItemAction(playlistId, item, label, uid) {
  const wrapper = document.createElement("span");
  wrapper.className = "personal-library-chip-wrap";
  const link = document.createElement("a");
  link.className = "personal-library-chip";
  link.href = normalizeInternalHref(item.href);
  link.textContent = label;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "personal-playlist-remove";
  remove.setAttribute("aria-label", `Remover ${label.toLowerCase()}`);
  remove.textContent = "✕";
  remove.addEventListener("click", async () => {
    remove.disabled = true;
    try {
      await removeItemFromPlaylist(uid, playlistId, item.key);
      await renderPlaylists();
    } catch (error) {
      console.error("Não foi possível remover o item da playlist.", error);
      alert("Não foi possível remover o item da playlist.");
      remove.disabled = false;
    }
  });
  wrapper.append(link, remove);
  return wrapper;
}

function createPlaylistBody(playlist, uid) {
  const body = document.createElement("div");
  body.className = "personal-playlist-body";
  const groups = groupItems(playlist.items);
  if (!groups.length) {
    const empty = document.createElement("div");
    empty.className = "personal-library-empty";
    empty.textContent = "Playlist vazia.";
    body.appendChild(empty);
    return body;
  }
  for (const group of groups) {
    const row = document.createElement("div");
    row.className = "personal-playlist-item personal-playlist-item--grouped";
    const title = document.createElement("div");
    title.className = "personal-library-title";
    title.textContent = group.title;
    const actions = document.createElement("div");
    actions.className = "personal-library-actions";
    if (group.musica) actions.appendChild(createItemAction(playlist.id, group.musica, "Música", uid));
    if (group.cifra) actions.appendChild(createItemAction(playlist.id, group.cifra, "Cifra", uid));
    row.append(title, actions);
    body.appendChild(row);
  }
  return body;
}

function renderLoginHint(hint) {
  if (!hint) return;
  hint.replaceChildren("Faça login para usar playlists. ");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "personal-library-primary";
  button.textContent = "Entrar";
  button.addEventListener("click", openPublicAuthModal);
  hint.appendChild(button);
  hint.classList.remove("hidden");
}

async function renderPlaylists() {
  const hint = document.getElementById("playlists-login-hint");
  const list = document.getElementById("playlists-list");
  const createButton = document.getElementById("new-playlist-page-button");
  const user = getCurrentPublicUser();
  if (!list) return;
  list.replaceChildren();

  if (!user?.uid) {
    createButton?.setAttribute("disabled", "disabled");
    renderLoginHint(hint);
    return;
  }

  createButton?.removeAttribute("disabled");
  hint?.classList.add("hidden");
  try {
    const library = await getUserLibrary(user.uid);
    if (!library.playlists.length) {
      const empty = document.createElement("div");
      empty.className = "personal-library-empty";
      empty.textContent = "Nenhuma playlist criada ainda.";
      list.appendChild(empty);
      return;
    }

    library.playlists.forEach((playlist, index) => {
      const card = document.createElement("div");
      card.className = "personal-playlist-card";
      const head = document.createElement("div");
      head.className = "personal-playlist-head";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "personal-playlist-toggle";
      toggle.textContent = `${playlist.name || "Playlist"} (${playlist.items.length})`;
      toggle.setAttribute("aria-expanded", index === 0 ? "true" : "false");
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "personal-playlist-delete";
      deleteButton.textContent = "Excluir";
      const body = createPlaylistBody(playlist, user.uid);
      body.classList.toggle("hidden", index !== 0);
      toggle.addEventListener("click", () => {
        const willOpen = body.classList.contains("hidden");
        list.querySelectorAll(".personal-playlist-body").forEach((item) => item.classList.add("hidden"));
        list.querySelectorAll(".personal-playlist-toggle").forEach((item) => item.setAttribute("aria-expanded", "false"));
        body.classList.toggle("hidden", !willOpen);
        toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });
      deleteButton.addEventListener("click", async () => {
        if (!confirm(`Excluir a playlist “${playlist.name || "Playlist"}”?`)) return;
        deleteButton.disabled = true;
        try {
          await removePlaylist(user.uid, playlist.id);
          await renderPlaylists();
        } catch (error) {
          console.error("Não foi possível excluir a playlist.", error);
          alert("Não foi possível excluir a playlist.");
          deleteButton.disabled = false;
        }
      });
      head.append(toggle, deleteButton);
      card.append(head, body);
      list.appendChild(card);
    });
  } catch (error) {
    console.error("Não foi possível carregar as playlists.", error);
    const message = document.createElement("div");
    message.className = "personal-library-empty";
    message.textContent = "Não foi possível carregar suas playlists.";
    list.appendChild(message);
  }
}

async function createNewPlaylistFromPage() {
  const user = getCurrentPublicUser();
  if (!user?.uid) {
    openPublicAuthModal();
    return;
  }
  const name = prompt("Nome da playlist:")?.trim().slice(0, 100);
  if (!name) return;
  const button = document.getElementById("new-playlist-page-button");
  if (button) button.disabled = true;
  try {
    await createPlaylist(user.uid, name);
    await renderPlaylists();
  } catch (error) {
    console.error("Não foi possível criar a playlist.", error);
    alert("Não foi possível criar a playlist.");
  } finally {
    if (button) button.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await whenPublicAuthReady();
  document.getElementById("new-playlist-page-button")?.addEventListener("click", createNewPlaylistFromPage);
  watchPublicAuth(renderPlaylists);
});
