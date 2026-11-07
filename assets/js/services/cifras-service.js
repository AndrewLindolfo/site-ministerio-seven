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
import { createCollectionListCache } from "../lib/collection-list-cache.js";
import { sanitizeRichHtml } from "../lib/sanitize-html.js";

const COLLECTION = "cifras";
const CACHE_KEY = "seven_cache_cifras_v2";
const CACHE_TTL_MS = 10 * 60 * 1000;
const listCache = createCollectionListCache(CACHE_KEY, CACHE_TTL_MS);

const INSTRUMENT_LABELS = {
  violao: "Violão",
  guitarra: "Guitarra",
  baixo: "Baixo",
  teclado: "Teclado"
};
const VALID_INSTRUMENTS = new Set(Object.keys(INSTRUMENT_LABELS));
const VALID_COMPASSOS = new Set(["2/4", "3/4", "4/4", "5/4", "6/8", "7/8", "9/8", "12/8"]);

function normalizeString(value = "", maxLength = 200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeViews(value = 0) {
  const views = Number(value);
  return Number.isFinite(views) && views >= 0 ? Math.min(Math.floor(views), 2_147_483_647) : 0;
}

function normalizeBpm(value = "") {
  if (String(value ?? "").trim() === "") return "";
  const bpm = Number(value);
  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 300) throw new RangeError("BPM inválido.");
  return String(Math.round(bpm));
}

function normalizeCompasso(value = "") {
  const compasso = String(value ?? "").trim();
  if (!compasso) return "";
  if (!VALID_COMPASSOS.has(compasso)) throw new RangeError("Compasso inválido.");
  return compasso;
}

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

  return VALID_INSTRUMENTS.has(raw) ? raw : "violao";
}

export function getInstrumentLabel(value = "") {
  return INSTRUMENT_LABELS[normalizeInstrument(value)] || String(value || "Violão");
}

function normalizeList(all = [], activeOnly = false) {
  return all
    .map((item) => ({
      ...item,
      musicaId: normalizeString(item.musicaId, 150),
      title: normalizeString(item.title, 150),
      slug: normalizeString(item.slug, 180),
      subtitle: normalizeString(item.subtitle, 200),
      cifraText: String(item.cifraText || "").slice(0, 300_000),
      cifraHtml: String(item.cifraHtml || "").slice(0, 300_000),
      originalKey: normalizeString(item.originalKey, 20),
      capo: normalizeString(item.capo, 30),
      instrumento: normalizeInstrument(item.instrumento || "violao"),
      chordColor: normalizeChordColor(item.chordColor || "#FF5C00"),
      views: normalizeViews(item.views),
      active: item.active !== false
    }))
    .filter((item) => (activeOnly ? item.active && item.title && item.slug : true))
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "pt-BR"));
}

export async function listCifras(activeOnly = false, bypassCache = false) {
  const scope = activeOnly ? "active" : "all";
  const all = await listCache.load(scope, () => getCollection(COLLECTION, activeOnly ? {
    where: [["active", "==", true]]
  } : {}), bypassCache);
  return normalizeList(all, activeOnly);
}

export async function getCifra(id) {
  const item = await getDocument(COLLECTION, id);
  if (!item) return null;
  return normalizeList([item])[0] || null;
}

export async function listCifrasBySlug(slug, activeOnly = true, bypassCache = false) {
  const wantedSlug = String(slug || "").trim();
  if (!wantedSlug) return [];
  if (activeOnly) {
    const items = await getCollection(COLLECTION, {
      where: [["slug", "==", wantedSlug], ["active", "==", true]]
    });
    return normalizeList(items, true);
  }
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
  if (!normalizedTitle) return null;
  const matches = await getCollection(COLLECTION, {
    where: [["normalizedTitle", "==", normalizedTitle]],
    limit: 2
  });
  return matches.find((item) => item.id !== ignoreId) || null;
}

export async function findDuplicateCifraInstrument(musicaId, instrumento, ignoreId = "") {
  const musicaIdSafe = String(musicaId || "").trim();
  const instrumentoSafe = normalizeInstrument(instrumento || "violao");
  if (!musicaIdSafe) return null;
  const matches = await getCollection(COLLECTION, {
    where: [["musicaId", "==", musicaIdSafe]]
  });
  return matches.find((item) => {
    const itemInstrumento = normalizeInstrument(item.instrumento || "violao");
    return itemInstrumento === instrumentoSafe && item.id !== ignoreId;
  }) || null;
}

export async function listCifrasByMusica(musicaId, activeOnly = true) {
  const musicaIdSafe = String(musicaId || "").trim();
  if (!musicaIdSafe) return [];
  if (activeOnly) {
    const items = await getCollection(COLLECTION, {
      where: [["musicaId", "==", musicaIdSafe], ["active", "==", true]]
    });
    return normalizeList(items, true);
  }
  const all = await listCifras(activeOnly);
  return all.filter((item) => String(item.musicaId || "").trim() === musicaIdSafe);
}

export async function saveCifra(payload, id = "") {
  const title = normalizeString(payload.title, 150);
  const musicaId = normalizeString(payload.musicaId, 150);
  if (!title || !musicaId) throw new Error("Selecione a música e informe o título da cifra.");
  const instrumento = normalizeInstrument(payload.instrumento || "violao");

  const docData = {
    musicaId,
    title,
    slug: slugify(title),
    normalizedTitle: normalizeText(title),
    subtitle: normalizeString(payload.subtitle, 200),
    cifraText: String(payload.cifraText || "").slice(0, 300_000),
    cifraHtml: sanitizeRichHtml(String(payload.cifraHtml || "").slice(0, 300_000)),
    originalKey: normalizeString(payload.originalKey, 20),
    capo: normalizeString(payload.capo, 30),
    bpm: normalizeBpm(payload.bpm),
    compasso: normalizeCompasso(payload.compasso),
    instrumento,
    chordColor: normalizeChordColor(payload.chordColor || "#0d0d0d"),
    active: payload.active !== false,
    updatedAt: serverTimestamp()
  };

  if (Object.hasOwn(payload, "views") || !id) docData.views = normalizeViews(payload.views);

  listCache.clear();

  if (id) {
    await updateDocument(COLLECTION, id, docData);
    return id;
  }

  docData.createdAt = serverTimestamp();
  return await addDocument(COLLECTION, docData);
}

export async function removeCifra(id) {
  listCache.clear();
  await deleteDocument(COLLECTION, id);
}

export async function updateCifraMetronome(id, bpm = "", compasso = "") {
  const bpmSafe = normalizeBpm(bpm);
  const compassoSafe = normalizeCompasso(compasso);
  if (!bpmSafe || !compassoSafe) throw new RangeError("BPM e compasso são obrigatórios.");
  listCache.clear();
  await updateDocument(COLLECTION, id, {
    bpm: bpmSafe,
    compasso: compassoSafe,
    updatedAt: serverTimestamp()
  });
}
