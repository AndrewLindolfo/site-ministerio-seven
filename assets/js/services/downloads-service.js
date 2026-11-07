import { addDocument, updateDocument, deleteDocument, getCollection, getDocument, serverTimestamp, normalizeText } from "../db.js";
import { convertGoogleDriveToDirectImage, convertDownloadUrlByType } from "../utils/google-drive-links.js";
const COLLECTION = "downloads";
const CACHE_KEY = "seven_cache_downloads_v1";
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
    .filter((item) => activeOnly ? item.active !== false : true)
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", "pt-BR"));
}

export async function listDownloads(activeOnly = false) {
  const cached = readCache();
  if (cached) return normalizeList(cached, activeOnly);

  const all = await getCollection(COLLECTION);
  writeCache(all);
  return normalizeList(all, activeOnly);
}

export async function getDownload(id) {
  return await getDocument(COLLECTION, id);
}

export async function saveDownload(payload, id = "") {
  const linkType = String(payload.linkType || "direct-download").trim() || "direct-download";
  const normalizedUrl = convertDownloadUrlByType(payload.url || "", linkType);
  const normalizedImageUrl = payload.imageUrl ? convertGoogleDriveToDirectImage(payload.imageUrl) : payload.imageUrl;
  const docData = {
    title: payload.title || "",
    normalizedTitle: normalizeText(payload.title || ""),
    url: normalizedUrl || "",
    description: payload.description || "",
    imageUrl: normalizedImageUrl || "",
    linkType,
    active: payload.active !== false,
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

export async function removeDownload(id) {
  clearCache();
  await deleteDocument(COLLECTION, id);
}
