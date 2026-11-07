import { addDocument, updateDocument, deleteDocument, getCollection, getDocument, serverTimestamp, normalizeText } from "../db.js";
import { createCollectionListCache } from "../lib/collection-list-cache.js";
import { normalizeHttpsOrLocalUrl } from "../lib/url-safety.js";

const COLLECTION = "notificacoes";
const CACHE_KEY = "seven_cache_notificacoes_v2";
const CACHE_TTL_MS = 5 * 60 * 1000;
const listCache = createCollectionListCache(CACHE_KEY, CACHE_TTL_MS);
const VALID_TYPES = new Set(["aviso", "novidade", "evento", "destaque"]);
const VALID_MODES = new Set(["always", "daily", "device_once"]);

function normalizeString(value = "", maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeType(value = "") {
  const type = normalizeString(value || "aviso", 20).toLowerCase();
  return VALID_TYPES.has(type) ? type : "aviso";
}

function normalizeMode(value = "") {
  const mode = normalizeString(value || "device_once", 20).toLowerCase();
  return VALID_MODES.has(mode) ? mode : "device_once";
}

function normalizeDateTime(value = "") {
  const raw = normalizeString(value, 40);
  if (!raw) return "";
  if (Number.isNaN(Date.parse(raw))) throw new Error("Data ou horário de notificação inválido.");
  return raw;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeItem(item = {}) {
  const type = normalizeType(item.type || item.tipo);
  return {
    ...item,
    title: normalizeString(item.title, 150),
    message: normalizeString(item.message, 5000),
    type,
    tipo: type,
    popupMode: normalizeMode(item.popupMode),
    active: item.active !== false,
    showPopup: item.showPopup === true,
    showHome: item.showHome === true,
    showPublic: item.showPublic !== false,
    showTop: item.showTop === true,
    showBeforeStart: item.showBeforeStart === true,
    topMode: normalizeMode(item.topMode),
    startsAt: item.startsAt || "",
    expiresAt: item.expiresAt || "",
    buttonText: normalizeString(item.buttonText, 100),
    buttonLink: normalizeHttpsOrLocalUrl(item.buttonLink)
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
  const startMs = toMillis(item.startsAt);
  const endMs = toMillis(item.expiresAt);
  if (startMs && nowMs < startMs) return false;
  if (endMs && nowMs > endMs) return false;
  return true;
}

export async function listNotificacoes(activeOnly = false) {
  const scope = activeOnly ? "active" : "all";
  const all = await listCache.load(scope, () => getCollection(COLLECTION, activeOnly ? {
    where: [["active", "==", true]]
  } : {}));
  const normalized = all.map(normalizeItem);
  return sortByDateDesc(normalized);
}

export async function getNotificacao(id) {
  const item = await getDocument(COLLECTION, id);
  return item ? normalizeItem(item) : null;
}

export async function saveNotificacao(payload, id = "") {
  const title = normalizeString(payload.title, 150);
  const message = normalizeString(payload.message, 5000);
  if (!title || !message) throw new Error("Informe título e mensagem do comunicado.");
  const startsAt = normalizeDateTime(payload.startsAt);
  const expiresAt = normalizeDateTime(payload.expiresAt);
  if (startsAt && expiresAt && toMillis(expiresAt) <= toMillis(startsAt)) {
    throw new Error("O encerramento deve ser posterior ao início.");
  }
  const rawButtonLink = normalizeString(payload.buttonLink, 2000);
  const buttonLink = normalizeHttpsOrLocalUrl(rawButtonLink);
  const buttonText = normalizeString(payload.buttonText, 100);
  if ((rawButtonLink && !buttonLink) || Boolean(buttonLink) !== Boolean(buttonText)) {
    throw new Error("Preencha o texto e um link HTTPS válido para o botão.");
  }
  const type = normalizeType(payload.type || payload.tipo);
  const docData = {
    title,
    normalizedTitle: normalizeText(title),
    message,
    type,
    tipo: type,
    active: payload.active !== false,
    showPopup: payload.showPopup === true,
    showHome: payload.showHome === true,
    showPublic: payload.showPublic !== false,
    showTop: payload.showTop === true,
    showBeforeStart: payload.showBeforeStart === true,
    popupMode: normalizeMode(payload.popupMode),
    topMode: normalizeMode(payload.topMode),
    startsAt,
    expiresAt,
    buttonText,
    buttonLink,
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

export async function removeNotificacao(id) {
  listCache.clear();
  await deleteDocument(COLLECTION, id);
}

export async function listHomeNotificacoes(limitCount = null) {
  const all = await listNotificacoes(true);
  const items = all.filter((item) => item.showHome && isNotificationActive(item));
  if (typeof limitCount === "number" && limitCount > 0) {
    return items.slice(0, limitCount);
  }
  return items;
}

export async function listPublicNotificacoes() {
  const all = await listNotificacoes(true);
  const now = new Date();
  return all.filter((item) => {
    if (!item.showPublic) return false;
    if (isNotificationActive(item, now)) return true;
    const startMs = toMillis(item.startsAt);
    if (item.showBeforeStart && startMs && now.getTime() < startMs) return true;
    return false;
  });
}

export async function getPopupNotificacao() {
  const all = await listNotificacoes(true);
  return all.find((item) => item.showPopup && isNotificationActive(item)) || null;
}


export async function getTopNotificacao() {
  const all = await listNotificacoes(true);
  return all.find((item) => item.showTop && isNotificationActive(item)) || null;
}
