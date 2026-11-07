import {
  addDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  getCollection,
  serverTimestamp,
  slugify,
  normalizeText
} from "../db.js";

const COLLECTION = "cifras";
const CACHE_KEY = "seven_cache_cifras_v2";
const CACHE_TTL_MS = 10 * 60 * 1000;

const INSTRUMENT_LABELS = {
  violao: "Violão",
  guitarra: "Guitarra",
  baixo: "Baixo",
  teclado: "Teclado"
};

const CHORD_COLOR_HEX = {
  padrao: "#FF5C00",
  preto: "#0d0d0d",
  azul: "#3b82f6",
  vermelho: "#ef4444",
  verde: "#22c55e",
  amarelo: "#eab308",
  roxo: "#a855f7",
  laranja: "#FF5C00"
};

export function normalizeChordColor(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return CHORD_COLOR_HEX.padrao;
  const lowered = raw.toLowerCase();
  if (CHORD_COLOR_HEX[lowered]) return CHORD_COLOR_HEX[lowered];
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  return CHORD_COLOR_HEX.padrao;
}

export function normalizeInstrument(value = "") {
  const raw = String(value || "violao")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (["violao", "violao"].includes(raw)) return "violao";
  if (raw === "guitarra") return "guitarra";
  if (raw === "baixo") return "baixo";
  if (raw === "teclado") return "teclado";
  return raw || "violao";
}

export function getInstrumentLabel(value = "") {
  return INSTRUMENT_LABELS[normalizeInstrument(value)] || String(value || "Violão");
}

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
    .filter((item) => (activeOnly ? item.active !== false : true))
    .map((item) => ({
      ...item,
      instrumento: normalizeInstrument(item.instrumento || "violao"),
      chordColor: normalizeChordColor(item.chordColor || "#FF5C00")
    }))
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "pt-BR"));
}

export async function listCifras(activeOnly = false, bypassCache = false) {
  if (!bypassCache) {
    const cached = readCache();
    if (cached) return normalizeList(cached, activeOnly);
  }
  const all = await getCollection(COLLECTION);
  writeCache(all);
  return normalizeList(all, activeOnly);
}

export async function getCifra(id) {
  const item = await getDocument(COLLECTION, id);
  if (!item) return null;
  return {
    ...item,
    instrumento: normalizeInstrument(item.instrumento || "violao"),
    chordColor: normalizeChordColor(item.chordColor || "#FF5C00")
  };
}

export async function listCifrasBySlug(slug, activeOnly = true, bypassCache = false) {
  const wantedSlug = String(slug || "").trim();
  if (!wantedSlug) return [];
  const all = await listCifras(activeOnly, bypassCache);
  return all.filter((item) => String(item.slug || "").trim() === wantedSlug);
}

export async function getCifraBySlug(slug, instrumento = "", bypassCache = false) {
  const variants = await listCifrasBySlug(slug, true, bypassCache);
  if (!variants.length) return null;

  const normalizedInstrument = normalizeInstrument(instrumento || "");
  if (normalizedInstrument) {
    const exact = variants.find((item) => normalizeInstrument(item.instrumento || "violao") === normalizedInstrument);
    if (exact) return exact;
  }

  const preferred = variants.find((item) => normalizeInstrument(item.instrumento || "violao") === "violao");
  return preferred || variants[0] || null;
}

export async function findDuplicateCifraTitle(title, ignoreId = "") {
  const normalizedTitle = normalizeText(title);
  const all = await getCollection(COLLECTION);
  return all.find((item) => item.normalizedTitle === normalizedTitle && item.id !== ignoreId) || null;
}

export async function findDuplicateCifraInstrument(musicaId, instrumento, ignoreId = "") {
  const musicaIdSafe = String(musicaId || "").trim();
  const instrumentoSafe = normalizeInstrument(instrumento || "violao");
  const all = await getCollection(COLLECTION);
  return all.find((item) => {
    const itemInstrumento = normalizeInstrument(item.instrumento || "violao");
    return item.musicaId === musicaIdSafe && itemInstrumento === instrumentoSafe && item.id !== ignoreId;
  }) || null;
}

export async function listCifrasByMusica(musicaId, activeOnly = true) {
  const musicaIdSafe = String(musicaId || "").trim();
  const all = await listCifras(activeOnly);
  return all.filter((item) => String(item.musicaId || "").trim() === musicaIdSafe);
}

export async function saveCifra(payload, id = "") {
  const title = String(payload.title || "").trim();
  const instrumento = normalizeInstrument(payload.instrumento || "violao");

  const docData = {
    musicaId: payload.musicaId || "",
    title,
    slug: slugify(title),
    normalizedTitle: normalizeText(title),
    subtitle: payload.subtitle || "",
    cifraText: payload.cifraText || "",
    cifraHtml: payload.cifraHtml || "",
    originalKey: payload.originalKey || "",
    capo: payload.capo || "",
    bpm: payload.bpm || "",
    compasso: payload.compasso || "",
    instrumento,
    chordColor: normalizeChordColor(payload.chordColor || "#0d0d0d"),
    views: typeof payload.views === "number" ? payload.views : 0,
    active: payload.active !== false,
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

export async function removeCifra(id) {
  clearCache();
  await deleteDocument(COLLECTION, id);
}

export async function updateCifraMetronome(id, bpm = "", compasso = "") {
  const bpmSafe = String(bpm || "").trim();
  const compassoSafe = String(compasso || "").trim();
  clearCache();
  await updateDocument(COLLECTION, id, {
    bpm: bpmSafe,
    compasso: compassoSafe,
    updatedAt: serverTimestamp()
  });
}
