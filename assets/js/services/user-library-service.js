import { getDocument, setDocument } from "../db.js";

const COLLECTION = "bibliotecasUsuarios";
const LOCAL_PREFIX = "seven_user_library_";
const MAX_FAVORITES = 100;
const MAX_PLAYLISTS = 10;
const MAX_PLAYLIST_ITEMS = 30;
const libraryCache = new Map();
const libraryRequests = new Map();
const libraryMutations = new Map();

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
  const rawType = normalizeString(item.type, 40).toLowerCase();
  const type = ["musica", "cifra"].includes(rawType) ? rawType : "";
  const href = normalizeHref(item.href);
  const createdAt = Number(item.createdAt || Date.now());
  return {
    key: normalizeString(item.key || `${type}:${href}`, 300),
    type,
    title: normalizeString(item.title, 150),
    href,
    subtitle: normalizeString(item.subtitle, 200),
    slug: normalizeString(item.slug, 150),
    instrument: normalizeString(item.instrument, 40),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now()
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
  if (!uid) throw new Error("UID ausente.");
  const normalized = normalizeLibrary(library);
  libraryCache.set(uid, normalized);
  writeLocal(uid, normalized);
  await writeRemote(uid, normalized);
  return normalized;
}

function enqueueLibraryMutation(uid = "", mutation) {
  if (!uid) return Promise.reject(new Error("UID ausente."));
  const previous = libraryMutations.get(uid) || Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const library = await getUserLibrary(uid);
    const result = await mutation(library);
    await saveUserLibrary(uid, library);
    return result;
  });
  libraryMutations.set(uid, next);
  return next.finally(() => {
    if (libraryMutations.get(uid) === next) libraryMutations.delete(uid);
  });
}

export async function toggleFavorite(uid = "", item = {}) {
  const normalizedItem = normalizeItem(item);
  if (!normalizedItem.key || !normalizedItem.type || !normalizedItem.href) throw new Error("Item inválido.");
  return enqueueLibraryMutation(uid, (library) => {
    const exists = library.favorites.some((fav) => fav.key === normalizedItem.key);
    if (!exists && library.favorites.length >= MAX_FAVORITES) throw new Error(`Limite de ${MAX_FAVORITES} favoritos atingido.`);
    library.favorites = exists
      ? library.favorites.filter((fav) => fav.key !== normalizedItem.key)
      : [normalizedItem, ...library.favorites.filter((fav) => fav.key !== normalizedItem.key)];
    return !exists;
  });
}

export async function createPlaylist(uid = "", name = "") {
  const normalizedName = normalizeString(name, 100);
  if (!normalizedName) throw new Error("Informe o nome da playlist.");
  return enqueueLibraryMutation(uid, (library) => {
    if (library.playlists.length >= MAX_PLAYLISTS) throw new Error(`Limite de ${MAX_PLAYLISTS} playlists atingido.`);
    const playlist = normalizePlaylist({ name: normalizedName, items: [] });
    library.playlists = [playlist, ...library.playlists];
    return playlist;
  });
}

export async function addItemToPlaylist(uid = "", playlistId = "", item = {}) {
  const normalizedItem = normalizeItem(item);
  if (!normalizedItem.key || !normalizedItem.type || !normalizedItem.href) throw new Error("Item inválido.");
  return enqueueLibraryMutation(uid, (library) => {
    const playlist = library.playlists.find((entry) => entry.id === playlistId);
    if (!playlist) throw new Error("Playlist não encontrada.");
    if (playlist.items.some((entry) => entry.key === normalizedItem.key)) return playlist;
    if (playlist.items.length >= MAX_PLAYLIST_ITEMS) throw new Error(`Limite de ${MAX_PLAYLIST_ITEMS} itens por playlist atingido.`);
    playlist.items.push(normalizedItem);
    return playlist;
  });
}

export async function removeItemFromPlaylist(uid = "", playlistId = "", itemKey = "") {
  return enqueueLibraryMutation(uid, (library) => {
    const playlist = library.playlists.find((entry) => entry.id === playlistId);
    if (!playlist) throw new Error("Playlist não encontrada.");
    playlist.items = playlist.items.filter((entry) => entry.key !== itemKey);
    return library;
  });
}

export async function removePlaylist(uid = "", playlistId = "") {
  return enqueueLibraryMutation(uid, (library) => {
    if (!library.playlists.some((playlist) => playlist.id === playlistId)) throw new Error("Playlist não encontrada.");
    library.playlists = library.playlists.filter((playlist) => playlist.id !== playlistId);
    return library;
  });
}
