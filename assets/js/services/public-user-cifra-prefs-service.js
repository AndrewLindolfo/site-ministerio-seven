import { getDocument, setDocument, serverTimestamp } from "../db.js";

const COLLECTION = "usuariosPublicos";
const LOCAL_PREFIX = "seven_public_cifra_prefs_";

function localKey(uid = "") {
  return `${LOCAL_PREFIX}${uid}`;
}

function sanitize(data = {}) {
  return {
    chordVariations: { ...(data.chordVariations || {}) },
    capoByCifra: { ...(data.capoByCifra || {}) }
  };
}

export async function getPublicUserCifraPrefs(uid = "") {
  if (!uid) return sanitize({});
  try {
    const remote = await getDocument(COLLECTION, uid);
    if (remote?.cifraPrefs) {
      const prefs = sanitize(remote.cifraPrefs);
      try { localStorage.setItem(localKey(uid), JSON.stringify(prefs)); } catch {}
      return prefs;
    }
  } catch (error) {
    console.warn("Preferências remotas de cifra indisponíveis, usando fallback local:", error);
  }
  try {
    const raw = localStorage.getItem(localKey(uid));
    return raw ? sanitize(JSON.parse(raw)) : sanitize({});
  } catch {
    return sanitize({});
  }
}

export async function savePublicUserCifraPrefs(uid = "", prefs = {}) {
  if (!uid) return;
  const payload = sanitize(prefs);
  try {
    await setDocument(COLLECTION, uid, { cifraPrefs: payload, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.warn("Não foi possível salvar preferências remotas de cifra, usando fallback local:", error);
  }
  try { localStorage.setItem(localKey(uid), JSON.stringify(payload)); } catch {}
}
