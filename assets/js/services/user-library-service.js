import { getDocument, setDocument } from "../db.js";

const COLLECTION = "bibliotecasUsuarios";
const LOCAL_PREFIX = "seven_user_library_";

function localKey(uid = "") {
  return `${LOCAL_PREFIX}${uid}`;
}

function normalizeItem(item = {}) {
  return {
    key: String(item.key || `${item.type || ""}:${item.href || ""}`).trim(),
    type: String(item.type || "").trim(),
    title: String(item.title || "").trim(),
    href: String(item.href || "").trim(),
    subtitle: String(item.subtitle || "").trim(),
    slug: String(item.slug || "").trim(),
    instrument: String(item.instrument || "").trim(),
    createdAt: Number(item.createdAt || Date.now())
  };
}

function normalizePlaylist(item = {}) {
  return {
    id: String(item.id || `pl_${Date.now()}_${Math.random().toString(36).slice(2,8)}`).trim(),
    name: String(item.name || "").trim(),
    items: Array.isArray(item.items) ? item.items.map(normalizeItem) : [],
    createdAt: Number(item.createdAt || Date.now())
  };
}

function normalizeLibrary(data = {}) {
  return {
    favorites: Array.isArray(data.favorites) ? data.favorites.map(normalizeItem) : [],
    playlists: Array.isArray(data.playlists) ? data.playlists.map(normalizePlaylist) : []
  };
}

async function readRemote(uid = "") {
  if (!uid) return null;
  try {
    const doc = await getDocument(COLLECTION, uid);
    if (!doc) return null;
    const normalized = normalizeLibrary(doc);
    const hasFavorites = Array.isArray(normalized.favorites) && normalized.favorites.length > 0;
    const hasPlaylists = Array.isArray(normalized.playlists) && normalized.playlists.length > 0;
    const hasStructuredData = hasFavorites || hasPlaylists;
    return hasStructuredData ? normalized : null;
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
