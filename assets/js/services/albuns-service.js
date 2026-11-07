import { addDocument, updateDocument, deleteDocument, getCollection, getDocument, serverTimestamp, normalizeText } from "../db.js";
import { convertDriveLinksInPayload } from "../utils/google-drive-links.js";
import { normalizeHttpsOrLocalUrl } from "../lib/url-safety.js";
import { createCollectionListCache } from "../lib/collection-list-cache.js";
const COLLECTION = "albuns";
const CACHE_KEY = "seven_cache_albuns_v1";
const CACHE_TTL_MS = 10 * 60 * 1000;
const listCache = createCollectionListCache(CACHE_KEY, CACHE_TTL_MS);

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
  const scope = activeOnly ? "active" : "all";
  const all = await listCache.load(scope, () => getCollection(COLLECTION, activeOnly ? {
    where: [["active", "==", true]]
  } : {}));
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

  listCache.clear();

  if (id) {
    await updateDocument(COLLECTION, id, docData);
    return id;
  }
  docData.createdAt = serverTimestamp();
  return await addDocument(COLLECTION, docData);
}

export async function removeAlbum(id) {
  listCache.clear();
  await deleteDocument(COLLECTION, id);
}
