import { addDocument, deleteDocument, getCollection, updateDocument } from '../db.js';

const COLLECTION = 'ensaios';

function normalizeSong(song = {}, index = 0) {
  const id = String(song.id || song.slug || `musica-${index + 1}`);
  const titulo = String(song.titulo || song.nome || song.title || song.slug || `Música ${index + 1}`).trim();
  const slug = String(song.slug || song.id || '').trim();
  return { id, titulo, slug };
}

function normalizeEnsaio(doc = {}) {
  const rawSongs = Array.isArray(doc.musicas) ? doc.musicas : [];
  const musicas = rawSongs.map(normalizeSong).filter((song) => song.titulo);
  return {
    id: doc.id,
    titulo: String(doc.titulo || doc.nome || '').trim(),
    descricao: String(doc.descricao || '').trim(),
    musicas,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

export async function listEnsaios() {
  const rows = await getCollection(COLLECTION);
  return rows.map(normalizeEnsaio).filter((item) => item.titulo);
}

export async function getEnsaio(id) {
  const rows = await getCollection(COLLECTION);
  const found = rows.find((item) => item.id === id);
  return found ? normalizeEnsaio(found) : null;
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
  return addDocument(COLLECTION, {
    titulo: String(titulo || '').trim(),
    descricao: String(descricao || '').trim(),
    musicas: musicas.map(normalizeSong),
  });
}

export async function updateEnsaio(id, payload = {}) {
  const next = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'titulo')) next.titulo = String(payload.titulo || '').trim();
  if (Object.prototype.hasOwnProperty.call(payload, 'descricao')) next.descricao = String(payload.descricao || '').trim();
  if (Object.prototype.hasOwnProperty.call(payload, 'musicas')) next.musicas = Array.isArray(payload.musicas) ? payload.musicas.map(normalizeSong) : [];
  return updateDocument(COLLECTION, id, next);
}

export async function removeEnsaio(id) {
  return deleteDocument(COLLECTION, id);
}
