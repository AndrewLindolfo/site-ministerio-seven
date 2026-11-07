import { getDocument, setDocument } from "../db.js";

const COLLECTION = "bibliotecasUsuarios";
const LOCAL_PREFIX = "seven_user_library_";
const MAX_FAVORITES = 200;
const MAX_PLAYLISTS = 50;
const MAX_PLAYLIST_ITEMS = 200;

function normalizeString(value = "", maxLength = 200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeHref(value = "") {
  try {
    const url = new URL(normalizeString(value, 1000), window.location.origin);
    if (url.origin !== window.location.origin) return "";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "";
  }
}

function localKey(uid = "") {
  return `${LOCAL_PREFIX}${uid}`;
}

function normalizeItem(item = {}) {
  const type = normalizeString(item.type, 40);
  const href = normalizeHref(item.href);
  return {
    key: normalizeString(item.key || `${type}:${href}`, 500),
    type,
    title: normalizeString(item.title, 200),
    href,
    subtitle: normalizeString(item.subtitle, 300),
    slug: normalizeString(item.slug, 200),
    instrument: normalizeString(item.instrument, 40),
    createdAt: Number(item.createdAt || Date.now())
  };
}

function normalizePlaylist(item = {}) {
  return {
    id: normalizeString(item.id || `pl_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}`, 100),
    name: normalizeString(item.name, 100),
    items: Array.isArray(item.items) ? item.items.slice(0, MAX_PLAYLIST_ITEMS).map(normalizeItem) : [],
    createdAt: Number(item.createdAt || Date.now())
  };
}

function normalizeLibrary(data = {}) {
  return {
    favorites: Array.isArray(data.favorites) ? data.favorites.slice(0, MAX_FAVORITES).map(normalizeItem) : [],
    playlists: Array.isArray(data.playlists) ? data.playlists.slice(0, MAX_PLAYLISTS).map(normalizePlaylist) : []
  };
}

async function readRemote(uid = "") {
  if (!uid) return null;
  try {
    const doc = await getDocument(COLLECTION, uid);
    if (!doc) return null;
    return normalizeLibrary(doc);
  } catch (error) {
    console.warn("Biblioteca remota indisponível, usando fallback local:", error);
    return null;
  }
}

function readLocal(uid = "") {
  if (!uid) return normalizeLibrary();
  try {
    const raw = localStorage.getItem(localKey(uid));
    return raw ? normalizeLibrary(JSON.parse(raw)) : normalizeLibrary();
  } catch {
    return normalizeLibrary();
  }
}

async function writeRemote(uid = "", library = {}) {
  if (!uid) return;
  try {
    await setDocument(COLLECTION, uid, normalizeLibrary(library), { merge: true });
  } catch (error) {
    console.warn("Não foi possível salvar biblioteca remota, mantendo fallback local:", error);
  }
}

function writeLocal(uid = "", library = {}) {
  if (!uid) return;
  try {
    localStorage.setItem(localKey(uid), JSON.stringify(normalizeLibrary(library)));
  } catch {}
}

export async function getUserLibrary(uid = "") {
  const remote = await readRemote(uid);
  if (remote) {
    writeLocal(uid, remote);
    return remote;
  }
  return readLocal(uid);
}

export async function saveUserLibrary(uid = "", library = {}) {
  const normalized = normalizeLibrary(library);
  writeLocal(uid, normalized);
  await writeRemote(uid, normalized);
  return normalized;
}

export async function toggleFavorite(uid = "", item = {}) {
  const library = await getUserLibrary(uid);
  const normalizedItem = normalizeItem(item);
  const exists = library.favorites.some((fav) => fav.key === normalizedItem.key);

  library.favorites = exists
    ? library.favorites.filter((fav) => fav.key !== normalizedItem.key)
    : [normalizedItem, ...library.favorites.filter((fav) => fav.key !== normalizedItem.key)];

  await saveUserLibrary(uid, library);
  return !exists;
}

export async function createPlaylist(uid = "", name = "") {
  const library = await getUserLibrary(uid);
  const playlist = normalizePlaylist({ name, items: [] });
  library.playlists = [playlist, ...library.playlists];
  await saveUserLibrary(uid, library);
  return playlist;
}

export async function addItemToPlaylist(uid = "", playlistId = "", item = {}) {
  const library = await getUserLibrary(uid);
  const normalizedItem = normalizeItem(item);
  library.playlists = library.playlists.map((playlist) => {
    if (playlist.id !== playlistId) return playlist;
    const exists = playlist.items.some((entry) => entry.key === normalizedItem.key);
    return exists ? playlist : { ...playlist, items: [...playlist.items, normalizedItem] };
  });
  await saveUserLibrary(uid, library);
  return library.playlists.find((playlist) => playlist.id === playlistId) || null;
}

export async function removeItemFromPlaylist(uid = "", playlistId = "", itemKey = "") {
  const library = await getUserLibrary(uid);
  library.playlists = library.playlists.map((playlist) => {
    if (playlist.id !== playlistId) return playlist;
    return { ...playlist, items: playlist.items.filter((entry) => entry.key !== itemKey) };
  });
  await saveUserLibrary(uid, library);
  return library;
}

export async function removePlaylist(uid = "", playlistId = "") {
  const library = await getUserLibrary(uid);
  library.playlists = library.playlists.filter((playlist) => playlist.id !== playlistId);
  await saveUserLibrary(uid, library);
  return library;
}
