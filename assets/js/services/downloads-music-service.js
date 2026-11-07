import {
  addDocument,
  updateDocument,
  deleteDocument,
  getCollection,
  getDocument,
  getOneByField,
  serverTimestamp,
  normalizeText
} from "../db.js";
import { convertGoogleDriveToDirectPdf, convertGoogleDriveToDirectPowerPoint } from "../utils/google-drive-links.js";

const COLLECTION = "downloadsPorMusica";
const CACHE_KEY = "seven_cache_downloads_music_v1";
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
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "pt-BR"));
}

export async function listDownloadsByMusic(activeOnly = false) {
  const cached = readCache();
  if (cached) return normalizeList(cached, activeOnly);

  const all = await getCollection(COLLECTION);
  writeCache(all);
  return normalizeList(all, activeOnly);
}

export async function getDownloadByMusic(id) {
  return await getDocument(COLLECTION, id);
}

export async function getDownloadByMusicByMusicaId(musicaId = "") {
  if (!musicaId) return null;
  return await getOneByField(COLLECTION, "musicaId", musicaId);
}

export async function saveDownloadByMusic(payload, id = "") {
  const title = String(payload.title || "").trim();
  const musicaId = String(payload.musicaId || "").trim();
  const pdfUrl = String(convertGoogleDriveToDirectPdf(payload.pdfUrl || "") || "").trim();
  const pptUrl = String(convertGoogleDriveToDirectPowerPoint(payload.pptUrl || "") || "").trim();

  if (!musicaId || !title || (!pdfUrl && !pptUrl)) {
    throw new Error("Preencha a música e pelo menos um link (PDF ou PPT).");
  }

  const docData = {
    musicaId,
    title,
    normalizedTitle: normalizeText(title),
    slug: payload.slug || "",
    pdfUrl,
    pptUrl,
    active: payload.active !== false,
    updatedAt: serverTimestamp()
  };

  clearCache();

  if (id) {
    await updateDocument(COLLECTION, id, docData);
    return id;
  }

  const existing = await getDownloadByMusicByMusicaId(musicaId);
  if (existing?.id) {
    await updateDocument(COLLECTION, existing.id, docData);
    return existing.id;
  }

  docData.createdAt = serverTimestamp();
  return await addDocument(COLLECTION, docData);
}

export async function removeDownloadByMusic(id) {
  clearCache();
  await deleteDocument(COLLECTION, id);
}
