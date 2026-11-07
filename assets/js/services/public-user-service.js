import { getDocument, setDocument, serverTimestamp } from "../db.js";
import { normalizeHttpsOrLocalUrl } from "../lib/url-safety.js";

const COLLECTION = "usuariosPublicos";
const LOCAL_PREFIX = "seven_public_user_profile_";
const CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeString(value = "", maxLength = 200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function normalizeProfilePhotoUrl(value = "") {
  return normalizeHttpsOrLocalUrl(value, 2000);
}

function normalizeProfile(data = {}) {
  const firstName = normalizeString(data.firstName, 80);
  const lastName = normalizeString(data.lastName, 120);
  return {
    firstName,
    lastName,
    displayName: normalizeString(data.displayName || [firstName, lastName].filter(Boolean).join(" "), 200),
    email: normalizeString(data.email, 320).toLowerCase(),
    phone: normalizeString(data.phone, 30),
    photoURL: normalizeProfilePhotoUrl(data.photoURL)
  };
}

function localKey(uid = "") {
  return `${LOCAL_PREFIX}${uid}`;
}

function readLocalProfile(uid = "") {
  try {
    const raw = localStorage.getItem(localKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { profile: normalizeProfile(parsed), cachedAt: Number(parsed.cachedAt || 0) };
  } catch {
    return null;
  }
}

function writeLocalProfile(uid = "", profile = {}) {
  try {
    localStorage.setItem(localKey(uid), JSON.stringify({ ...normalizeProfile(profile), cachedAt: Date.now() }));
  } catch {}
}

export async function getPublicUserProfile(uid = "") {
  if (!uid) return null;
  const local = readLocalProfile(uid);
  if (local && Date.now() - local.cachedAt <= CACHE_TTL_MS) return local.profile;
  try {
    const remote = await getDocument(COLLECTION, uid);
    if (remote) {
      const normalized = { ...remote, ...normalizeProfile(remote) };
      writeLocalProfile(uid, normalized);
      return normalized;
    }
  } catch (error) {
    console.warn("Perfil público remoto indisponível, usando fallback local:", error);
  }
  return local?.profile || null;
}

export async function savePublicUserProfile(uid = "", data = {}) {
  if (!uid) throw new Error("UID ausente.");

  const payload = {
    ...normalizeProfile(data),
    updatedAt: serverTimestamp()
  };

  try {
    await setDocument(COLLECTION, uid, payload, { merge: true });
  } catch (error) {
    console.warn("Não foi possível salvar perfil público no Firestore, usando fallback local:", error);
  }

  writeLocalProfile(uid, payload);

  return uid;
}
