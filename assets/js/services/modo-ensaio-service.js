import {
  createDocumentReference,
  createWriteBatch,
  getCollection,
  getDocument,
  getDocumentReference,
  serverTimestamp
} from "../db.js";

const SESSION_COLLECTION = "modoEnsaios";
const SONG_COLLECTION = "modoEnsaioMusicas";
const MAX_SONGS = 50;

function text(value = "", max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeSession(item = {}) {
  return {
    id: item.id || "",
    title: text(item.title, 150),
    date: text(item.date, 10),
    time: text(item.time, 5),
    location: text(item.location, 300),
    description: text(item.description, 2000),
    active: item.active === true,
    createdBy: text(item.createdBy, 128),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null
  };
}

function normalizeSong(item = {}, order = 0) {
  const bpmNumber = Number(item.bpm);
  return {
    id: item.id || "",
    sessionId: text(item.sessionId, 150),
    order: Number.isInteger(item.order) ? Math.max(0, Math.min(item.order, 49)) : order,
    musicaId: text(item.musicaId, 150),
    title: text(item.title, 150),
    slug: text(item.slug, 180),
    cifraId: text(item.cifraId, 150),
    cifraTitle: text(item.cifraTitle, 150),
    instrumento: text(item.instrumento || "violao", 20),
    bpm: Number.isFinite(bpmNumber) && bpmNumber >= 20 && bpmNumber <= 300 ? String(Math.round(bpmNumber)) : "",
    compasso: text(item.compasso, 4),
    originalKey: text(item.originalKey, 20),
    notes: text(item.notes, 2000),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null
  };
}

export async function listModoEnsaios() {
  const rows = await getCollection(SESSION_COLLECTION);
  return rows.map(normalizeSession).sort((a, b) => {
    const aKey = `${a.date || "0000-00-00"} ${a.time || "00:00"}`;
    const bKey = `${b.date || "0000-00-00"} ${b.time || "00:00"}`;
    return bKey.localeCompare(aKey);
  });
}

export async function getModoEnsaio(id = "") {
  const sessionId = text(id, 150);
  if (!sessionId) return null;
  const item = await getDocument(SESSION_COLLECTION, sessionId);
  return item ? normalizeSession(item) : null;
}

export async function listModoEnsaioSongs(sessionId = "") {
  const safeId = text(sessionId, 150);
  if (!safeId) return [];
  const rows = await getCollection(SONG_COLLECTION, { where: [["sessionId", "==", safeId]] });
  return rows.map(normalizeSong).sort((a, b) => a.order - b.order);
}

export async function listAllModoEnsaioSongs() {
  const rows = await getCollection(SONG_COLLECTION);
  return rows.map(normalizeSong);
}

function normalizeSongs(sessionId, songs = []) {
  const normalized = songs.slice(0, MAX_SONGS).map((song, order) => normalizeSong({ ...song, sessionId, order }, order));
  if (!normalized.length) throw new Error("Adicione pelo menos uma música ao modo ensaio.");
  if (normalized.some((song) => !song.musicaId || !song.title)) throw new Error("Há uma música inválida na lista.");
  return normalized;
}

function songData(sessionId, song, createdAt) {
  return {
      sessionId,
      order: song.order,
      musicaId: song.musicaId,
      title: song.title,
      slug: song.slug,
      cifraId: song.cifraId,
      cifraTitle: song.cifraTitle,
      instrumento: song.instrumento,
      bpm: song.bpm,
      compasso: song.compasso,
      originalKey: song.originalKey,
      notes: song.notes,
      createdAt: createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
  };
}

export async function createModoEnsaio(payload = {}, userUid = "") {
  const session = normalizeSession(payload);
  if (!session.title) throw new Error("Informe o título do modo ensaio.");
  const songs = normalizeSongs("pending", payload.songs || []);
  const parentRef = createDocumentReference(SESSION_COLLECTION);
  const id = parentRef.id;
  const batch = createWriteBatch();
  batch.set(parentRef, {
    title: session.title,
    date: session.date,
    time: session.time,
    location: session.location,
    description: session.description,
    active: session.active,
    createdBy: text(userUid, 128),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  for (const song of songs) {
    const childId = `${id}_${String(song.order).padStart(2, "0")}`;
    batch.set(getDocumentReference(SONG_COLLECTION, childId), songData(id, song));
  }
  await batch.commit();
  return id;
}

export async function updateModoEnsaio(id = "", payload = {}) {
  const sessionId = text(id, 150);
  const session = normalizeSession(payload);
  if (!sessionId || !session.title) throw new Error("Modo ensaio inválido.");
  const songs = normalizeSongs(sessionId, payload.songs || []);
  const existing = await listModoEnsaioSongs(sessionId);
  const existingById = new Map(existing.map((item) => [item.id, item]));
  const wantedIds = new Set();
  const batch = createWriteBatch();
  batch.update(getDocumentReference(SESSION_COLLECTION, sessionId), {
    title: session.title,
    date: session.date,
    time: session.time,
    location: session.location,
    description: session.description,
    active: session.active,
    updatedAt: serverTimestamp()
  });
  for (const song of songs) {
    const childId = `${sessionId}_${String(song.order).padStart(2, "0")}`;
    wantedIds.add(childId);
    batch.set(
      getDocumentReference(SONG_COLLECTION, childId),
      songData(sessionId, song, existingById.get(childId)?.createdAt)
    );
  }
  existing.filter((item) => !wantedIds.has(item.id)).forEach((item) => {
    batch.delete(getDocumentReference(SONG_COLLECTION, item.id));
  });
  await batch.commit();
  return sessionId;
}

export async function removeModoEnsaio(id = "") {
  const sessionId = text(id, 150);
  if (!sessionId) return;
  const songs = await listModoEnsaioSongs(sessionId);
  const batch = createWriteBatch();
  songs.forEach((song) => batch.delete(getDocumentReference(SONG_COLLECTION, song.id)));
  batch.delete(getDocumentReference(SESSION_COLLECTION, sessionId));
  await batch.commit();
}
