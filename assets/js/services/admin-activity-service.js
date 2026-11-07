import { auth } from "../firebase.js";
import { addDocument, getCollection, serverTimestamp, setDocument } from "../db.js";
import { getAdminProfileByEmail } from "../auth.js";

const COLLECTION = "activity_logs";
const CONFIG_COLLECTION = "config";
const CONFIG_PREFIX = "activity_log__";
const CACHE_KEY = "seven_admin_identity";

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function readCachedAdminIdentity() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function persistCachedAdminIdentity(identity = null) {
  try {
    if (!identity) {
      sessionStorage.removeItem(CACHE_KEY);
      return;
    }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(identity));
  } catch (error) {
    console.warn("Não foi possível salvar cache da identidade do admin:", error);
  }
}

function toComparableTime(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildClientLogId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildFallbackTimestamp() {
  const now = new Date();
  return {
    iso: now.toISOString(),
    ms: now.getTime(),
    localDate: now.toLocaleDateString("sv-SE")
  };
}

function buildPayload(base = {}, admin = null, user = null, cached = null) {
  const email = normalizeEmail(user?.email || admin?.email || cached?.email || base.userEmail || "");
  const uid = String(user?.uid || admin?.uid || cached?.uid || base.userUid || "").trim();
  const name = String(
    admin?.name ||
    admin?.nome ||
    cached?.name ||
    user?.displayName ||
    base.userName ||
    email ||
    "Administrador"
  ).trim();
  const fallbackTimestamp = buildFallbackTimestamp();

  persistCachedAdminIdentity({ uid, email, name });

  return {
    clientLogId: String(base.clientLogId || buildClientLogId()),
    type: "activity_log",
    action: String(base.action || "update").trim().toLowerCase(),
    module: String(base.module || "geral").trim().toLowerCase(),
    itemId: String(base.itemId || "").trim(),
    itemName: String(base.itemName || "Sem item").trim() || "Sem item",
    details: String(base.details || "").trim(),
    userUid: uid || null,
    userEmail: email || null,
    userName: name || "Administrador",
    timestamp: serverTimestamp(),
    fallbackCreatedAtIso: fallbackTimestamp.iso,
    fallbackCreatedAtMs: fallbackTimestamp.ms,
    fallbackCreatedAtDate: fallbackTimestamp.localDate
  };
}

export async function recordAdminActivity(payload = {}) {
  const user = auth.currentUser;
  const cached = readCachedAdminIdentity();
  const email = normalizeEmail(user?.email || cached?.email || payload.userEmail || "");

  let admin = null;
  if (email) {
    try {
      admin = await getAdminProfileByEmail(email);
    } catch {}
  }

  const logPayload = buildPayload(payload, admin, user, cached);
  const configDocId = `${CONFIG_PREFIX}${logPayload.clientLogId}`;

  let primaryError = null;
  try {
    await addDocument(COLLECTION, logPayload);
    return true;
  } catch (error) {
    primaryError = error;
    console.error("Erro ao registrar log em activity_logs:", error);
  }

  try {
    await setDocument(CONFIG_COLLECTION, configDocId, {
      ...logPayload,
      storedIn: "config"
    }, { merge: true });
    return true;
  } catch (fallbackError) {
    console.error("Erro ao registrar log em config fallback:", fallbackError);
    if (primaryError) throw primaryError;
    throw fallbackError;
  }
}

export async function listAdminActivities() {
  const logs = [];

  try {
    const all = await getCollection(COLLECTION);
    logs.push(...all.filter((item) => !item?.type || item.type === "activity_log"));
  } catch (error) {
    console.warn("Não foi possível ler activity_logs:", error);
  }

  try {
    const configItems = await getCollection(CONFIG_COLLECTION);
    logs.push(...configItems.filter((item) => item?.type === "activity_log" || String(item?.id || "").startsWith(CONFIG_PREFIX)));
  } catch (error) {
    console.warn("Não foi possível ler logs em config:", error);
  }

  const deduped = [];
  const seen = new Set();
  for (const item of logs) {
    const key = item.clientLogId || item.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped.sort((a, b) => {
    const timeA = toComparableTime(a.timestamp) || toComparableTime(a.createdAt) || Number(a.fallbackCreatedAtMs || 0);
    const timeB = toComparableTime(b.timestamp) || toComparableTime(b.createdAt) || Number(b.fallbackCreatedAtMs || 0);
    return timeB - timeA;
  });
}
