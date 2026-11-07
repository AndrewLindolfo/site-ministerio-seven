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
import { sanitizeRichHtml } from "../lib/sanitize-html.js";
import { getYoutubeVideoId } from "../lib/youtube-url.js";

const COLLECTION = "musicas";
const CACHE_KEY = "seven_cache_musicas_v1";
const CACHE_TTL_MS = 10 * 60 * 1000;
const listCache = createCollectionListCache(CACHE_KEY, CACHE_TTL_MS);

function normalizeString(value = "", maxLength = 200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeViews(value = 0) {
  const views = Number(value);
  return Number.isFinite(views) && views >= 0 ? Math.min(Math.floor(views), 2_147_483_647) : 0;
}

function normalizeMusica(item = {}) {
  return {
    ...item,
    title: normalizeString(item.title || item.titulo || item.nome, 150),
    slug: normalizeString(item.slug, 180),
    subtitle: normalizeString(item.subtitle, 200),
    author: normalizeString(item.author, 150),
    originalKey: normalizeString(item.originalKey, 20),
    category: normalizeString(item.category, 80),
    youtubeUrl: normalizeString(item.youtubeUrl, 500),
    internalNotes: normalizeString(item.internalNotes, 5000),
    lyricHtml: String(item.lyricHtml || "").slice(0, 600_000),
    views: normalizeViews(item.views),
    active: item.active !== false
  };
}

function getMusicaDisplayTitle(item = {}) {
  return String(item.title || item.titulo || item.nome || item.slug || "").trim();
}

function normalizeList(all = [], activeOnly = false) {
  return all
    .map(normalizeMusica)
    .filter((item) => activeOnly ? item.active && item.title && item.slug : true)
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
  const item = await getDocument(COLLECTION, id);
  return item ? normalizeMusica(item) : null;
}

export async function getMusicaBySlug(slug) {
  const wantedSlug = String(slug || "").trim();
  if (!wantedSlug) return null;
  const items = await getCollection(COLLECTION, {
    where: [["slug", "==", wantedSlug], ["active", "==", true]],
    limit: 1
  });
  return items[0] ? normalizeMusica(items[0]) : null;
}

export async function findDuplicateMusicaTitle(title, ignoreId = "") {
  const normalizedTitle = normalizeText(title);
  const all = await getCollection(COLLECTION);
  return all.find((item) => item.normalizedTitle === normalizedTitle && item.id !== ignoreId) || null;
}

export async function saveMusica(payload, id = "") {
  const title = normalizeString(payload.title, 150);
  if (!title) throw new Error("Informe o título da música.");
  const rawYoutubeUrl = normalizeString(payload.youtubeUrl, 500);
  const youtubeId = getYoutubeVideoId(rawYoutubeUrl);
  if (rawYoutubeUrl && !youtubeId) throw new Error("Link do YouTube inválido.");
  const docData = {
    title,
    slug: slugify(title),
    normalizedTitle: normalizeText(title),
    subtitle: normalizeString(payload.subtitle, 200),
    author: normalizeString(payload.author, 150),
    originalKey: normalizeString(payload.originalKey, 20),
    category: normalizeString(payload.category, 80),
    youtubeUrl: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : "",
    internalNotes: normalizeString(payload.internalNotes, 5000),
    lyricHtml: sanitizeRichHtml(String(payload.lyricHtml || "").slice(0, 600_000)),
    active: payload.active !== false,
    updatedAt: serverTimestamp()
  };

  if (Object.hasOwn(payload, "views") || !id) docData.views = normalizeViews(payload.views);

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
