import { auth } from "../firebase.js";
import { addDocument, getCollection, serverTimestamp } from "../db.js";
import { getAdminProfileForUser } from "../auth.js";

const COLLECTION = "activity_logs";
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
  ).trim().slice(0, 150);
  const fallbackTimestamp = buildFallbackTimestamp();

  persistCachedAdminIdentity({ uid, email, name });

  return {
    clientLogId: String(base.clientLogId || buildClientLogId()),
    type: "activity_log",
    action: String(base.action || "update").trim().toLowerCase().slice(0, 40),
    module: String(base.module || "geral").trim().toLowerCase().slice(0, 60),
    itemId: String(base.itemId || "").trim().slice(0, 200),
    itemName: String(base.itemName || "Sem item").trim().slice(0, 200) || "Sem item",
    details: String(base.details || "").trim().slice(0, 2000),
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

  let admin = null;
  if (!cached?.name && user?.uid) {
    try {
      admin = await getAdminProfileForUser(user);
    } catch {}
  }

  const logPayload = buildPayload(payload, admin, user, cached);
  try {
    await addDocument(COLLECTION, logPayload);
    return true;
  } catch (error) {
    console.error("Erro ao registrar log em activity_logs:", error);
    return false;
  }
}

export async function listAdminActivities() {
  try {
    const all = await getCollection(COLLECTION, {
      orderBy: { field: "timestamp", direction: "desc" },
      limit: 500
    });
    return all.filter((item) => !item?.type || item.type === "activity_log");
  } catch (error) {
    console.warn("Não foi possível ler activity_logs:", error);
    return [];
  }
}
