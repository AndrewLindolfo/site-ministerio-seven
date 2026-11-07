import { addDocument, updateDocument, deleteDocument, getCollection, getDocument, serverTimestamp } from "../db.js";

const COLLECTION = "programacoes";
const MAX_SONGS = 100;

function normalizeString(value = "", maxLength = 200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeDate(value = "") {
  const date = normalizeString(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day ? date : "";
}

function normalizeTime(value = "") {
  const time = normalizeString(value, 5);
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "";
}

function normalizeSong(song = {}) {
  return {
    id: normalizeString(song.id || song.musicaId, 150),
    musicaId: normalizeString(song.musicaId || song.id, 150),
    title: normalizeString(song.title || song.titulo || song.name, 150),
    subtitle: normalizeString(song.subtitle, 200),
    slug: normalizeString(song.slug, 150),
    cifraSlug: normalizeString(song.cifraSlug, 150),
    hasCifra: song.hasCifra === true || Boolean(song.cifraSlug)
  };
}

function toLocalDateTime(dateStr = "", timeStr = "") {
  if (!dateStr) return null;

  const date = normalizeDate(dateStr);
  const time = normalizeTime(timeStr || "00:00");
  if (!date || !time) return null;

  const parts = date.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);

  const timeParts = time.split(":");
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
  const all = await getCollection(COLLECTION, activeOnly ? {
    where: [["active", "==", true]]
  } : {});
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
  const title = normalizeString(payload.title, 150);
  const date = normalizeDate(payload.date);
  const time = normalizeTime(payload.time);
  if (!title || !date || !time) throw new Error("Informe título, data e horário válidos.");
  const hideAfterRaw = normalizeString(payload.hideAfter, 40);
  if (hideAfterRaw && !normalizeTime(hideAfterRaw) && Number.isNaN(new Date(hideAfterRaw).getTime())) {
    throw new Error("Horário de ocultação inválido.");
  }
  const hideAfter = hideAfterRaw;
  const docData = {
    title,
    date,
    time,
    location: normalizeString(payload.location, 300),
    description: normalizeString(payload.description, 2000),
    hideAfter,
    songs: Array.isArray(payload.songs) ? payload.songs.slice(0, MAX_SONGS).map(normalizeSong).filter((song) => song.title) : [],
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
