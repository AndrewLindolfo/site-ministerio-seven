import { getDocument, setDocument } from "../db.js";

const COLLECTION = "bibliotecasUsuarios";
const LOCAL_PREFIX = "seven_user_library_";
const MAX_FAVORITES = 100;
const MAX_PLAYLISTS = 10;
const MAX_PLAYLIST_ITEMS = 30;
const libraryCache = new Map();
const libraryRequests = new Map();

function cloneLibrary(library = {}) {
  return JSON.parse(JSON.stringify(normalizeLibrary(library)));
}

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
    key: normalizeString(item.key || `${type}:${href}`, 300),
    type,
    title: normalizeString(item.title, 150),
    href,
    subtitle: normalizeString(item.subtitle, 200),
    slug: normalizeString(item.slug, 150),
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
  if (!uid) return normalizeLibrary();
  if (libraryCache.has(uid)) return cloneLibrary(libraryCache.get(uid));
  if (!libraryRequests.has(uid)) {
    libraryRequests.set(uid, (async () => {
      const remote = await readRemote(uid);
      const library = remote || readLocal(uid);
      if (remote) writeLocal(uid, remote);
      libraryCache.set(uid, library);
      libraryRequests.delete(uid);
      return library;
    })().catch((error) => {
      libraryRequests.delete(uid);
      throw error;
    }));
  }
  return cloneLibrary(await libraryRequests.get(uid));
}

export async function saveUserLibrary(uid = "", library = {}) {
  const normalized = normalizeLibrary(library);
  libraryCache.set(uid, normalized);
  writeLocal(uid, normalized);
  await writeRemote(uid, normalized);
  return normalized;
}

export async function toggleFavorite(uid = "", item = {}) {
  const library = await getUserLibrary(uid);
  const normalizedItem = normalizeItem(item);
  if (!normalizedItem.key || !normalizedItem.href) throw new Error("Item inválido.");
  const exists = library.favorites.some((fav) => fav.key === normalizedItem.key);

  library.favorites = exists
    ? library.favorites.filter((fav) => fav.key !== normalizedItem.key)
    : [normalizedItem, ...library.favorites.filter((fav) => fav.key !== normalizedItem.key)];

  await saveUserLibrary(uid, library);
  return !exists;
}

export async function createPlaylist(uid = "", name = "") {
  const normalizedName = normalizeString(name, 100);
  if (!normalizedName) throw new Error("Informe o nome da playlist.");
  const library = await getUserLibrary(uid);
  const playlist = normalizePlaylist({ name: normalizedName, items: [] });
  library.playlists = [playlist, ...library.playlists];
  await saveUserLibrary(uid, library);
  return playlist;
}

export async function addItemToPlaylist(uid = "", playlistId = "", item = {}) {
  const library = await getUserLibrary(uid);
  const normalizedItem = normalizeItem(item);
  if (!normalizedItem.key || !normalizedItem.href) throw new Error("Item inválido.");
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
