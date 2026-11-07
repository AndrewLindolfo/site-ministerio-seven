import {
  addDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  getCollection,
  getOneByField,
  serverTimestamp,
  slugify,
  normalizeText
} from "../db.js";

const COLLECTION = "musicas";
const CACHE_KEY = "seven_cache_musicas_v1";
const CACHE_TTL_MS = 10 * 60 * 1000;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.items || !Array.isArray(parsed.items)) return null;
    if (Date.now() - Number(parsed.savedAt || 0) > CACHE_TTL_MS) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

function writeCache(items) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      items
    }));
  } catch {}
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}

function getMusicaDisplayTitle(item = {}) {
  return String(item.title || item.titulo || item.nome || item.slug || "").trim();
}

function normalizeList(all = [], activeOnly = false) {
  return all
    .filter((item) => activeOnly ? item.active !== false : true)
    .sort((a, b) => getMusicaDisplayTitle(a).localeCompare(getMusicaDisplayTitle(b), "pt-BR"));
}

export async function listMusicas(activeOnly = false) {
  const cached = readCache();
  if (cached && cached.length) {
    return normalizeList(cached, activeOnly);
  }

  const all = await getCollection(COLLECTION);
  writeCache(all);
  return normalizeList(all, activeOnly);
}

export async function getMusica(id) {
  return await getDocument(COLLECTION, id);
}

export async function getMusicaBySlug(slug) {
  return await getOneByField(COLLECTION, "slug", slug);
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

  clearCache();

  if (id) {
    await updateDocument(COLLECTION, id, docData);
    return id;
  }

  docData.createdAt = serverTimestamp();
  return await addDocument(COLLECTION, docData);
}

export async function removeMusica(id) {
  clearCache();
  await deleteDocument(COLLECTION, id);
}
