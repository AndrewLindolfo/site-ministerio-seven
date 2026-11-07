import { addDocument, updateDocument, deleteDocument, getCollection, getDocument, serverTimestamp, normalizeText } from "../db.js";
import { convertGoogleDriveToDirectImage, convertDownloadUrlByType } from "../utils/google-drive-links.js";
import { normalizeHttpsOrLocalUrl } from "../lib/url-safety.js";
import { createCollectionListCache } from "../lib/collection-list-cache.js";
const COLLECTION = "downloads";
const CACHE_KEY = "seven_cache_downloads_v1";
const CACHE_TTL_MS = 10 * 60 * 1000;
const LINK_TYPES = new Set(["direct-download", "drive-folder", "keep", "pdf", "powerpoint"]);
const listCache = createCollectionListCache(CACHE_KEY, CACHE_TTL_MS);

function normalizeDownload(item = {}) {
  return {
    ...item,
    title: String(item.title || "").trim().slice(0, 200),
    description: String(item.description || "").trim().slice(0, 1000),
    url: normalizeHttpsOrLocalUrl(item.url),
    imageUrl: normalizeHttpsOrLocalUrl(item.imageUrl),
    linkType: LINK_TYPES.has(item.linkType) ? item.linkType : "direct-download",
    active: item.active !== false
  };
}

function normalizeList(all = [], activeOnly = false) {
  return all
    .map(normalizeDownload)
    .filter((item) => activeOnly ? item.active && item.title && item.url : true)
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", "pt-BR"));
}

export async function listDownloads(activeOnly = false) {
  const scope = activeOnly ? "active" : "all";
  const all = await listCache.load(scope, () => getCollection(COLLECTION, activeOnly ? {
    where: [["active", "==", true]]
  } : {}));
  return normalizeList(all, activeOnly);
}

export async function getDownload(id) {
  return await getDocument(COLLECTION, id);
}

export async function saveDownload(payload, id = "") {
  const requestedType = String(payload.linkType || "direct-download").trim();
  const linkType = LINK_TYPES.has(requestedType) ? requestedType : "direct-download";
  const title = String(payload.title || "").trim().slice(0, 200);
  const normalizedUrl = normalizeHttpsOrLocalUrl(convertDownloadUrlByType(payload.url || "", linkType));
  const normalizedImageUrl = normalizeHttpsOrLocalUrl(payload.imageUrl ? convertGoogleDriveToDirectImage(payload.imageUrl) : "");
  if (!title || !normalizedUrl) throw new Error("Informe o título e um link HTTPS válido.");
  const docData = {
    title,
    normalizedTitle: normalizeText(title),
    url: normalizedUrl,
    description: String(payload.description || "").trim().slice(0, 1000),
    imageUrl: normalizedImageUrl || "",
    linkType,
    active: payload.active !== false,
    updatedAt: serverTimestamp()
  };

  listCache.clear();

  if (id) {
    await updateDocument(COLLECTION, id, docData);
    return id;
  }
  docData.createdAt = serverTimestamp();
  return await addDocument(COLLECTION, docData);
}

export async function removeDownload(id) {
  listCache.clear();
  await deleteDocument(COLLECTION, id);
}
