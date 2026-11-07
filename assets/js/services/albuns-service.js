import { addDocument, updateDocument, deleteDocument, getCollection, getDocument, serverTimestamp, normalizeText } from "../db.js";
import { convertDriveLinksInPayload } from "../utils/google-drive-links.js";
import { normalizeHttpsOrLocalUrl } from "../lib/url-safety.js";
const COLLECTION = "albuns";
const CACHE_KEY = "seven_cache_albuns_v1";
const CACHE_TTL_MS = 10 * 60 * 1000;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.items)) return null;
    if (Date.now() - Number(parsed.savedAt || 0) > CACHE_TTL_MS) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

function writeCache(items) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), items }));
  } catch {}
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}

function normalizeList(all = [], activeOnly = false) {
  return all
    .map((item) => ({
      ...item,
      title: String(item.title || "").trim().slice(0, 200),
      description: String(item.description || "").trim().slice(0, 1000),
      albumUrl: normalizeHttpsOrLocalUrl(item.albumUrl),
      coverUrl: normalizeHttpsOrLocalUrl(item.coverUrl),
      active: item.active !== false
    }))
    .filter((item) => activeOnly ? item.active && item.title && item.albumUrl : true)
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", "pt-BR"));
}

export async function listAlbuns(activeOnly = false) {
  const cached = readCache();
  if (cached) return normalizeList(cached, activeOnly);

  const all = await getCollection(COLLECTION);
  writeCache(all);
  return normalizeList(all, activeOnly);
}

export async function getAlbum(id) {
  return await getDocument(COLLECTION, id);
}

export async function saveAlbum(payload, id = "") {
  const normalizedPayload = convertDriveLinksInPayload(payload);
  const title = String(normalizedPayload.title || "").trim().slice(0, 200);
  const albumUrl = normalizeHttpsOrLocalUrl(normalizedPayload.albumUrl);
  const coverUrl = normalizeHttpsOrLocalUrl(normalizedPayload.coverUrl);
  if (!title || !albumUrl) throw new Error("Informe o título e um link HTTPS válido para o álbum.");
  const docData = {
    title,
    normalizedTitle: normalizeText(title),
    albumUrl,
    coverUrl,
    description: String(normalizedPayload.description || "").trim().slice(0, 1000),
    active: normalizedPayload.active !== false,
    updatedAt: serverTimestamp()
  };

  clearCache();

  if (id) {
    await updateDocument(COLLECTION, id, docData);
    return id;
  }
  docData.createdAt = serverTimestamp();
  return await addDocument(COLLECTION, docData);
}

export async function removeAlbum(id) {
  clearCache();
  await deleteDocument(COLLECTION, id);
}
