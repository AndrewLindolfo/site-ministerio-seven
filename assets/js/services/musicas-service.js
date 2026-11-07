import {
  addDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  getCollection,
  serverTimestamp,
  slugify,
  normalizeText
} from "../db.js";
import { createCollectionListCache } from "../lib/collection-list-cache.js";

const COLLECTION = "musicas";
const CACHE_KEY = "seven_cache_musicas_v1";
const CACHE_TTL_MS = 10 * 60 * 1000;
const listCache = createCollectionListCache(CACHE_KEY, CACHE_TTL_MS);

function getMusicaDisplayTitle(item = {}) {
  return String(item.title || item.titulo || item.nome || item.slug || "").trim();
}

function normalizeList(all = [], activeOnly = false) {
  return all
    .filter((item) => activeOnly ? item.active !== false : true)
    .sort((a, b) => getMusicaDisplayTitle(a).localeCompare(getMusicaDisplayTitle(b), "pt-BR"));
}

export async function listMusicas(activeOnly = false) {
  const scope = activeOnly ? "active" : "all";
  const all = await listCache.load(scope, () => getCollection(COLLECTION, activeOnly ? {
    where: [["active", "==", true]]
  } : {}));
  return normalizeList(all, activeOnly);
}

export async function getMusica(id) {
  return await getDocument(COLLECTION, id);
}

export async function getMusicaBySlug(slug) {
  const wantedSlug = String(slug || "").trim();
  if (!wantedSlug) return null;
  const items = await getCollection(COLLECTION, {
    where: [["slug", "==", wantedSlug], ["active", "==", true]],
    limit: 1
  });
  return items[0] || null;
}

export async function findDuplicateMusicaTitle(title, ignoreId = "") {
  const normalizedTitle = normalizeText(title);
  const all = await getCollection(COLLECTION);
  return all.find((item) => item.normalizedTitle === normalizedTitle && item.id !== ignoreId) || null;
}

export async function saveMusica(payload, id = "") {
  const title = String(payload.title || "").trim();
  const docData = {
    title,
    slug: slugify(title),
    normalizedTitle: normalizeText(title),
    subtitle: payload.subtitle || "",
    author: payload.author || "",
    originalKey: payload.originalKey || "",
    category: payload.category || "",
    youtubeUrl: payload.youtubeUrl || "",
    internalNotes: payload.internalNotes || "",
    lyricHtml: payload.lyricHtml || "",
    views: typeof payload.views === "number" ? payload.views : 0,
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

export async function removeMusica(id) {
  listCache.clear();
  await deleteDocument(COLLECTION, id);
}
