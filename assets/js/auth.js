import { auth, provider } from "./firebase.js";
import { getDocument, getOneByField, setDocument, updateDocument, serverTimestamp } from "./db.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const ADMIN_COLLECTION = "admins";
const PRIMARY_ADMIN_DOC_ID = "master";
const CACHE_KEY = "seven_admin_identity";

function normalize(email = "") {
  return String(email).trim().toLowerCase();
}


function buildAdminDocIdFromEmail(email = "") {
  return normalize(email).replace(/[^a-z0-9]/gi, "_").toLowerCase();
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

  if (!admin.createdAt) payload.createdAt = serverTimestamp();

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

async function getPrimaryAdminProfile() {
  const admin = await getDocument(ADMIN_COLLECTION, PRIMARY_ADMIN_DOC_ID);
  if (!admin) return null;
  if (admin.ativo === false || admin.active === false) return null;
  return admin;
}

export async function getAdminProfileByEmail(email = "") {
  const normalizedEmail = normalize(email);
  if (!normalizedEmail) return null;

  const primary = await getPrimaryAdminProfile();
  if (primary && normalize(primary.email) === normalizedEmail) {
    return primary;
  }

  const admin = await getOneByField(ADMIN_COLLECTION, "email", normalizedEmail);
  if (!admin) return null;
  if (admin.ativo === false || admin.active === false) return null;
  return admin;
}

export async function bindAdminUid(adminId = "", uid = "") {
  const normalizedUid = String(uid || "").trim();
  if (!adminId || !normalizedUid) return false;
  await updateDocument(ADMIN_COLLECTION, adminId, { uid: normalizedUid, pendingUid: false, uidBoundAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return true;
}

export async function validateAdminUser(user = null) {
  const email = normalize(user?.email || "");
  const uid = String(user?.uid || "").trim();
  if (!email || !uid) {
    return { ok: false, reason: "missing-user", admin: null, email, uid };
  }

  const admin = await getAdminProfileByEmail(email);
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
    const user = result.user;
    const validation = await validateAdminUser(user);

    if (!validation.ok) {
      persistAdminIdentity(null, null);
    await signOut(auth);
      if (validation.reason === "uid-mismatch") {
        alert("Este administrador já está vinculado a outro UID de acesso administrativo.\n\nUse a mesma conta Google já vinculada ou atualize o UID desse ADM no painel principal.");
        return;
      }

      alert("Seu e-mail não está autorizado como administrador.\n\nE-mail detectado: " + validation.email);
      return;
    }

    persistAdminIdentity(validation.admin, user);
    window.location.href = "/admin/index.html";
  } catch (error) {
    console.error("Erro no login:", error);
    alert(`Erro ao fazer login com Google: ${error.code || error.message || "desconhecido"}`);
  }
}

export async function logout() {
  persistAdminIdentity(null, null);
  await signOut(auth);
  window.location.href = "/login.html";
}

export async function ensureAdminUidSynced(user = null) {
  if (!user?.email || !user?.uid) return null;
  const admin = await getAdminProfileByEmail(user.email);
  if (!admin) return null;
  const savedUid = String(admin.uid || "").trim();
  if (!savedUid) {
    return finalizePendingAdmin(admin, user);
  }
  return admin;
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user?.email && user?.uid) {
      try {
        const admin = await ensureAdminUidSynced(user);
        if (admin) persistAdminIdentity(admin, user);
      } catch (error) {
        console.warn("Não foi possível sincronizar UID do administrador:", error);
      }
    }
    callback(user);
  });
}
