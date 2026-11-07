import { addDocument, updateDocument, deleteDocument, getCollection, getDocument, serverTimestamp } from "../db.js";

const COLLECTION = "programacoes";

function toLocalDateTime(dateStr = "", timeStr = "") {
  if (!dateStr) return null;

  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return null;

  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);

  const timeParts = String(timeStr || "00:00").split(":");
  const hours = Number(timeParts[0] || 0);
  const minutes = Number(timeParts[1] || 0);

  return new Date(year, month, day, hours, minutes, 0, 0);
}

function getHideAfterDate(item) {
  const value = String(item?.hideAfter || "").trim();
  if (!value) return null;

  if (/^\d{2}:\d{2}$/.test(value)) {
    return toLocalDateTime(item?.date, value);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isProgramacaoVisible(item) {
  const now = Date.now();
  const hideAfter = getHideAfterDate(item);
  if (hideAfter) return hideAfter.getTime() >= now;

  const dt = toLocalDateTime(item?.date, item?.time);
  if (!dt) return false;
  return dt.getTime() >= now;
}

function sortByDateTimeAsc(list = []) {
  return [...list].sort((a, b) => {
    const ad = toLocalDateTime(a.date, a.time);
    const bd = toLocalDateTime(b.date, b.time);

    if (!ad && !bd) return 0;
    if (!ad) return 1;
    if (!bd) return -1;

    return ad.getTime() - bd.getTime();
  });
}

export async function listProgramacoes(activeOnly = false) {
  const all = await getCollection(COLLECTION);
  const filtered = all.filter((item) => activeOnly ? item.active !== false : true);
  return sortByDateTimeAsc(filtered);
}

export async function listUpcomingProgramacoes() {
  const all = await listProgramacoes(true);
  const visible = all.filter((item) => isProgramacaoVisible(item));
  return sortByDateTimeAsc(visible);
}

export async function getProgramacao(id) {
  return await getDocument(COLLECTION, id);
}

export async function saveProgramacao(payload, id = "") {
  const docData = {
    title: payload.title || "",
    date: payload.date || "",
    time: payload.time || "",
    location: payload.location || "",
    description: payload.description || "",
    hideAfter: payload.hideAfter || "",
    songs: Array.isArray(payload.songs) ? payload.songs : [],
    active: payload.active !== false,
    updatedAt: serverTimestamp()
  };

  if (id) {
    await updateDocument(COLLECTION, id, docData);
    return id;
  }

  docData.createdAt = serverTimestamp();
  return await addDocument(COLLECTION, docData);
}

export async function removeProgramacao(id) {
  await deleteDocument(COLLECTION, id);
}
