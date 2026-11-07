import { getCurrentPublicUser, requirePublicLogin, watchPublicAuth } from "../public-auth.js";
import {
  getUserLibrary,
  toggleFavorite,
  createPlaylist,
  addItemToPlaylist
} from "../services/user-library-service.js";

let currentLibrary = { favorites: [], playlists: [] };
let isReady = false;

function $(selector) {
  return document.querySelector(selector);
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getItemFromElement(el) {
  if (!el) return null;
  return {
    key: String(el.dataset.itemKey || "").trim(),
    type: String(el.dataset.itemType || "").trim(),
    title: String(el.dataset.itemTitle || "").trim(),
    href: String(el.dataset.itemHref || "").trim(),
    subtitle: String(el.dataset.itemSubtitle || "").trim(),
    slug: String(el.dataset.itemSlug || "").trim(),
    instrument: String(el.dataset.itemInstrument || "").trim()
  };
}

function isFavoriteKey(key = "") {
  return currentLibrary.favorites.some((item) => item.key === key);
}

function ensurePlaylistModal() {
  if ($("#playlist-modal")) return;

  const modal = document.createElement("div");
  modal.id = "playlist-modal";
  modal.className = "playlist-modal hidden";
  modal.innerHTML = `
    <div class="playlist-modal__overlay" data-close-playlist-modal="1"></div>
    <div class="playlist-modal__panel">
      <button type="button" class="playlist-modal__close" data-close-playlist-modal="1" aria-label="Fechar">✕</button>
      <h2>Adicionar à playlist</h2>
      <div id="playlist-modal-existing"></div>
      <div class="playlist-modal__divider"></div>
      <label class="playlist-modal__label">
        <span>Nova playlist</span>
        <input type="text" id="playlist-new-name" placeholder="Nome da playlist" />
      </label>
      <div class="playlist-modal__actions">
        <button type="button" id="playlist-create-button" class="playlist-modal__primary">Criar e adicionar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelectorAll("[data-close-playlist-modal='1']").forEach((node) => {
    node.addEventListener("click", closePlaylistModal);
  });

  $("#playlist-create-button")?.addEventListener("click", async () => {
    const user = getCurrentPublicUser();
    if (!user?.uid) {
      closePlaylistModal();
      requirePublicLogin();
      return;
    }
    const name = ($("#playlist-new-name")?.value || "").trim();
    const item = modal._currentItem;
    if (!name || !item) return;
    const playlist = await createPlaylist(user.uid, name);
    await addItemToPlaylist(user.uid, playlist.id, item);
    await reloadLibrary();
    closePlaylistModal();
  });
}

function renderPlaylistChoices() {
  const box = $("#playlist-modal-existing");
  if (!box) return;
  if (!currentLibrary.playlists.length) {
    box.innerHTML = "<p class=\"playlist-modal__empty\">Nenhuma playlist criada ainda.</p>";
    return;
  }
  box.innerHTML = currentLibrary.playlists.map((playlist) => `
    <button type="button" class="playlist-modal__choice" data-playlist-choice="${playlist.id}">
      ${escapeHtml(playlist.name)} <small>(${playlist.items.length})</small>
    </button>
  `).join("");

  box.querySelectorAll("[data-playlist-choice]").forEach((button) => {
    button.addEventListener("click", async () => {
      const user = getCurrentPublicUser();
      const item = $("#playlist-modal")?._currentItem;
      if (!user?.uid || !item) return;
      await addItemToPlaylist(user.uid, button.dataset.playlistChoice, item);
      await reloadLibrary();
      closePlaylistModal();
    });
  });
}

async function openPlaylistModal(item) {
  ensurePlaylistModal();
  await reloadLibrary();
  const modal = $("#playlist-modal");
  if (!modal) return;
  modal._currentItem = item;
  const input = $("#playlist-new-name");
  if (input) input.value = "";
  renderPlaylistChoices();
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closePlaylistModal() {
  $("#playlist-modal")?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

export async function reloadLibrary() {
  const user = getCurrentPublicUser();
  currentLibrary = user?.uid ? await getUserLibrary(user.uid) : { favorites: [], playlists: [] };
  refreshPersonalActionButtons();
}

export function refreshPersonalActionButtons(root = document) {
  root.querySelectorAll("[data-favorite-button]").forEach((button) => {
    const key = button.dataset.itemKey || "";
    const active = isFavoriteKey(key);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.title = active ? "Remover dos favoritos" : "Adicionar aos favoritos";
  });
}

async function onFavoriteClick(button) {
  const item = getItemFromElement(button);
  if (!item?.key) return;
  requirePublicLogin(async (user) => {
    await toggleFavorite(user.uid, item);
    await reloadLibrary();
  });
}

function onPlaylistClick(button) {
  const item = getItemFromElement(button);
  if (!item?.key) return;
  requirePublicLogin(async () => {
    await openPlaylistModal(item);
  });
}

export function decoratePersonalButton(button, item = {}) {
  if (!button) return;
  button.dataset.itemKey = item.key || `${item.type}:${item.href}`;
  button.dataset.itemType = item.type || "";
  button.dataset.itemTitle = item.title || "";
  button.dataset.itemHref = item.href || "";
  button.dataset.itemSubtitle = item.subtitle || "";
  button.dataset.itemSlug = item.slug || "";
  button.dataset.itemInstrument = item.instrument || "";
}

export function createPersonalButtons(item = {}) {
  const key = item.key || `${item.type}:${item.href}`;
  return `
    <button type="button" class="personal-action-btn personal-favorite-btn" data-favorite-button="1"
      data-item-key="${escapeHtml(key)}"
      data-item-type="${escapeHtml(item.type || "")}"
      data-item-title="${escapeHtml(item.title || "")}"
      data-item-href="${escapeHtml(item.href || "")}"
      data-item-subtitle="${escapeHtml(item.subtitle || "")}"
      data-item-slug="${escapeHtml(item.slug || "")}"
      data-item-instrument="${escapeHtml(item.instrument || "")}"
      aria-label="Favoritar">★</button>
    <button type="button" class="personal-action-btn personal-playlist-btn" data-playlist-button="1"
      data-item-key="${escapeHtml(key)}"
      data-item-type="${escapeHtml(item.type || "")}"
      data-item-title="${escapeHtml(item.title || "")}"
      data-item-href="${escapeHtml(item.href || "")}"
      data-item-subtitle="${escapeHtml(item.subtitle || "")}"
      data-item-slug="${escapeHtml(item.slug || "")}"
      data-item-instrument="${escapeHtml(item.instrument || "")}"
      aria-label="Adicionar à playlist">＋</button>
  `;
}

export function initPersonalActions() {
  if (isReady) return;
  isReady = true;
  ensurePlaylistModal();

  document.addEventListener("click", async (event) => {
    const favoriteBtn = event.target.closest("[data-favorite-button]");
    if (favoriteBtn) {
      event.preventDefault();
      event.stopPropagation();
      await onFavoriteClick(favoriteBtn);
      return;
    }

    const playlistBtn = event.target.closest("[data-playlist-button]");
    if (playlistBtn) {
      event.preventDefault();
      event.stopPropagation();
      onPlaylistClick(playlistBtn);
      return;
    }
  });

  watchPublicAuth(async () => {
    await reloadLibrary();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePlaylistModal();
  });
}
