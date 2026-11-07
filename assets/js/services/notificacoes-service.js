import { addDocument, updateDocument, deleteDocument, getCollection, getDocument, serverTimestamp, normalizeText } from "../db.js";

const COLLECTION = "notificacoes";
const CACHE_KEY = "seven_cache_notificacoes_v2";
const CACHE_TTL_MS = 5 * 60 * 1000;

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

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeItem(item = {}) {
  return {
    ...item,
    tipo: item.tipo || "aviso",
    popupMode: item.popupMode || "device_once",
    active: item.active !== false,
    showPopup: item.showPopup === true,
    showHome: item.showHome === true,
    showPublic: item.showPublic !== false,
    showTop: item.showTop === true,
    showBeforeStart: item.showBeforeStart === true,
    topMode: item.topMode || "device_once",
    startsAt: item.startsAt || "",
    expiresAt: item.expiresAt || ""
  };
}

function sortByDateDesc(items = []) {
  return [...items].sort((a, b) => {
    const aTime = toMillis(a.startsAt) || toMillis(a.createdAt) || 0;
    const bTime = toMillis(b.startsAt) || toMillis(b.createdAt) || 0;
    return bTime - aTime;
  });
}

export function isNotificationActive(item = {}, now = new Date()) {
  if (!item || item.active === false) return false;
  const nowMs = now.getTime();
  const startMs = item.startsAt ? Date.parse(item.startsAt) : 0;
  const endMs = item.expiresAt ? Date.parse(item.expiresAt) : 0;
  if (startMs && nowMs < startMs) return false;
  if (endMs && nowMs > endMs) return false;
  return true;
}

export async function listNotificacoes(activeOnly = false) {
  const cached = readCache();
  const all = cached || await getCollection(COLLECTION);
  if (!cached) writeCache(all);
  const normalized = all.map(normalizeItem);
  return sortByDateDesc(activeOnly ? normalized.filter((item) => isNotificationActive(item)) : normalized);
}

export async function getNotificacao(id) {
  const item = await getDocument(COLLECTION, id);
  return item ? normalizeItem(item) : null;
}

export async function saveNotificacao(payload, id = "") {
  const docData = {
    title: String(payload.title || "").trim(),
    normalizedTitle: normalizeText(payload.title || ""),
    message: payload.message || "",
    type: payload.type || payload.tipo || "aviso",
    tipo: payload.type || payload.tipo || "aviso",
    active: payload.active !== false,
    showPopup: payload.showPopup === true,
    showHome: payload.showHome === true,
    showPublic: payload.showPublic !== false,
    showTop: payload.showTop === true,
    showBeforeStart: payload.showBeforeStart === true,
    popupMode: payload.popupMode || "device_once",
    topMode: payload.topMode || "device_once",
    startsAt: payload.startsAt || "",
    expiresAt: payload.expiresAt || "",
    buttonText: payload.buttonText || "",
    buttonLink: payload.buttonLink || "",
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

export async function removeNotificacao(id) {
  clearCache();
  await deleteDocument(COLLECTION, id);
}

export async function listHomeNotificacoes(limitCount = null) {
  const all = await listNotificacoes(true);
  const items = all.filter((item) => item.showHome);
  if (typeof limitCount === "number" && limitCount > 0) {
    return items.slice(0, limitCount);
  }
  return items;
}

export async function listPublicNotificacoes() {
  const all = await listNotificacoes(false);
  const now = new Date();
  return all.filter((item) => {
    if (!item.showPublic) return false;
    if (isNotificationActive(item, now)) return true;
    const startMs = item.startsAt ? Date.parse(item.startsAt) : 0;
    if (item.showBeforeStart && startMs && now.getTime() < startMs) return true;
    return false;
  });
}

export async function getPopupNotificacao() {
  const all = await listNotificacoes(true);
  return all.find((item) => item.showPopup) || null;
}


export async function getTopNotificacao() {
  const all = await listNotificacoes(true);
  return all.find((item) => item.showTop) || null;
}
