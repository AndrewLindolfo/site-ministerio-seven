import { auth, provider } from "./firebase.js";
import { getDocument, setDocument, serverTimestamp } from "./db.js";
import { buildAdminDocIdFromEmail } from "./services/admin-permissions-service.js";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const ADMIN_COLLECTION = "admins";
const PRIMARY_ADMIN_DOC_ID = "master";
const CACHE_KEY = "seven_admin_identity";

function normalize(email = "") {
  return String(email).trim().toLowerCase();
}


async function finalizePendingAdmin(admin = null, user = null) {
  const uid = String(user?.uid || "").trim();
  const email = normalize(user?.email || admin?.email || "");
  if (!admin || !uid || !email) return admin;

  const payload = {
    uid,
    email,
    active: admin.active !== false && admin.ativo !== false,
    pendingUid: false,
    uidBoundAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDocument(ADMIN_COLLECTION, admin.id || buildAdminDocIdFromEmail(email), payload, { merge: true });
  return { ...admin, ...payload };
}

function persistAdminIdentity(admin = null, user = null) {
  try {
    if (!admin && !user) {
      sessionStorage.removeItem(CACHE_KEY);
      return;
    }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      uid: String(user?.uid || admin?.uid || "").trim(),
      email: normalize(user?.email || admin?.email || ""),
      name: String(admin?.name || admin?.nome || user?.displayName || user?.email || "Administrador").trim()
    }));
  } catch (error) {
    console.warn("Não foi possível persistir identidade do admin:", error);
  }
}

async function getAccessibleAdminDocument(id = "") {
  try {
    return await getDocument(ADMIN_COLLECTION, id);
  } catch (error) {
    if (String(error?.code || "").includes("permission-denied")) return null;
    throw error;
  }
}

export async function getAdminProfileForUser(user = null) {
  const uid = String(user?.uid || "").trim();
  const email = normalize(user?.email || "");
  if (!uid || !email) return null;

  const invited = await getAccessibleAdminDocument(buildAdminDocIdFromEmail(email));
  if (invited && invited.active !== false && invited.ativo !== false && normalize(invited.email) === email) {
    const invitedUid = String(invited.uid || "").trim();
    if (!invitedUid || invitedUid === uid) return invited;
  }

  const primary = await getAccessibleAdminDocument(PRIMARY_ADMIN_DOC_ID);
  if (!primary || primary.active === false || primary.ativo === false) return null;
  const primaryUid = String(primary.uid || "").trim();
  if (normalize(primary.email) !== email) return null;
  if (primaryUid && primaryUid !== uid) return null;
  return primary;
}

export async function validateAdminUser(user = null) {
  const email = normalize(user?.email || "");
  const uid = String(user?.uid || "").trim();
  if (!email || !uid) {
    return { ok: false, reason: "missing-user", admin: null, email, uid };
  }

  const admin = await getAdminProfileForUser(user);
  if (!admin) {
    return { ok: false, reason: "not-authorized", admin: null, email, uid };
  }

  const savedUid = String(admin.uid || "").trim();
  if (!savedUid) {
    const finalizedAdmin = await finalizePendingAdmin(admin, user);
    persistAdminIdentity(finalizedAdmin, user);
    return {
      ok: true,
      reason: "uid-bound",
      admin: finalizedAdmin,
      email,
      uid
    };
  }

  if (savedUid !== uid) {
    return {
      ok: false,
      reason: "uid-mismatch",
      admin,
      email,
      uid,
      savedUid
    };
  }

  persistAdminIdentity(admin, user);
  return { ok: true, reason: "ok", admin, email, uid, savedUid };
}

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    await completeAdminLogin(result.user);
    window.location.href = "/admin/index.html";
  } catch (error) {
    console.error("Erro no login:", error);
    throw error;
  }
}

export async function loginWithEmailPassword(email = "", password = "") {
  try {
    const result = await signInWithEmailAndPassword(auth, normalize(email), String(password));
    await completeAdminLogin(result.user);
    window.location.href = "/admin/index.html";
  } catch (error) {
    console.error("Erro no login:", error);
    throw error;
  }
}

async function completeAdminLogin(user) {
  const validation = await validateAdminUser(user);
  if (validation.ok) {
    persistAdminIdentity(validation.admin, user);
    return validation;
  }

  persistAdminIdentity(null, null);
  await signOut(auth);
  const error = new Error(
    validation.reason === "uid-mismatch"
      ? "Este administrador já está vinculado a outra conta de acesso."
      : "Este e-mail não está autorizado como administrador."
  );
  error.code = validation.reason === "uid-mismatch" ? "admin/uid-mismatch" : "admin/not-authorized";
  throw error;
}

export async function logout() {
  persistAdminIdentity(null, null);
  await signOut(auth);
  window.location.href = "/login.html";
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
