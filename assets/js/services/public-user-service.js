import { getDocument, setDocument, serverTimestamp } from "../db.js";

const COLLECTION = "usuariosPublicos";
const LOCAL_PREFIX = "seven_public_user_profile_";

function localKey(uid = "") {
  return `${LOCAL_PREFIX}${uid}`;
}

export async function getPublicUserProfile(uid = "") {
  if (!uid) return null;
  try {
    const remote = await getDocument(COLLECTION, uid);
    if (remote) return remote;
  } catch (error) {
    console.warn("Perfil público remoto indisponível, usando fallback local:", error);
  }

  try {
    const raw = localStorage.getItem(localKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function savePublicUserProfile(uid = "", data = {}) {
  if (!uid) throw new Error("UID ausente.");

  const payload = {
    firstName: String(data.firstName || "").trim(),
    lastName: String(data.lastName || "").trim(),
    displayName: String(data.displayName || "").trim(),
    email: String(data.email || "").trim(),
    phone: String(data.phone || "").trim(),
    photoURL: String(data.photoURL || "").trim(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDocument(COLLECTION, uid, payload, { merge: true });
  } catch (error) {
    console.warn("Não foi possível salvar perfil público no Firestore, usando fallback local:", error);
  }

  try {
    localStorage.setItem(localKey(uid), JSON.stringify({ id: uid, ...payload }));
  } catch {}

  return uid;
}
