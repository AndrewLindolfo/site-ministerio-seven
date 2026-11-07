import { addDocument, deleteDocument, getCollection, getDocument, serverTimestamp, updateDocument } from "../db.js";

const COLLECTION = "ensaios";
const MAX_SONGS = 100;

function normalizeString(value = "", maxLength = 200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeSong(song = {}, index = 0) {
  const id = normalizeString(song.id || song.slug || `musica-${index + 1}`, 150);
  const titulo = normalizeString(song.titulo || song.nome || song.title || song.slug || `Música ${index + 1}`, 150);
  const slug = normalizeString(song.slug || song.id || "", 150);
  return { id, titulo, slug };
}

function normalizeEnsaio(doc = {}) {
  const rawSongs = Array.isArray(doc.musicas) ? doc.musicas : [];
  const musicas = rawSongs.slice(0, MAX_SONGS).map(normalizeSong).filter((song) => song.titulo);
  return {
    id: doc.id,
    titulo: normalizeString(doc.titulo || doc.nome, 150),
    descricao: normalizeString(doc.descricao, 2000),
    musicas,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null
  };
}

export async function listEnsaios() {
  const rows = await getCollection(COLLECTION);
  return rows.map(normalizeEnsaio).filter((item) => item.titulo);
}

export async function getEnsaio(id) {
  const item = await getDocument(COLLECTION, id);
  return item ? normalizeEnsaio(item) : null;
}

export async function getEnsaioAtivo() {
  const ensaios = await listEnsaios();
  if (!ensaios.length) return null;
  ensaios.sort((a, b) => {
    const aTime = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
    const bTime = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
  return ensaios[0] || null;
}

export async function createEnsaio({ titulo, descricao = '', musicas = [] }) {
  const normalized = normalizeEnsaio({ titulo, descricao, musicas });
  if (!normalized.titulo) throw new Error("Informe o título do ensaio.");
  return addDocument(COLLECTION, {
    titulo: normalized.titulo,
    descricao: normalized.descricao,
    musicas: normalized.musicas,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateEnsaio(id, payload = {}) {
  const next = {};
  if (Object.hasOwn(payload, "titulo")) next.titulo = normalizeString(payload.titulo, 150);
  if (Object.hasOwn(payload, "descricao")) next.descricao = normalizeString(payload.descricao, 2000);
  if (Object.hasOwn(payload, "musicas")) next.musicas = Array.isArray(payload.musicas) ? payload.musicas.slice(0, MAX_SONGS).map(normalizeSong) : [];
  if (Object.hasOwn(next, "titulo") && !next.titulo) throw new Error("Informe o título do ensaio.");
  next.updatedAt = serverTimestamp();
  return updateDocument(COLLECTION, id, next);
}

export async function removeEnsaio(id) {
  return deleteDocument(COLLECTION, id);
}
