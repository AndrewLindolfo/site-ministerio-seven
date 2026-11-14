const DURATION_PREFIX = "duration:";
const MAX_HIDE_AFTER_MINUTES = 60 * 24 * 30;

function normalizeDate(value = "") {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day ? date : "";
}

function normalizeTime(value = "") {
  const time = String(value || "").trim();
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "";
}

export function toProgramacaoStart(dateValue = "", timeValue = "") {
  const date = normalizeDate(dateValue);
  const time = normalizeTime(timeValue || "00:00");
  if (!date || !time) return null;

  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function parseHideAfterMinutes(value = "") {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const explicitDuration = raw.match(/^duration:(\d+)$/i);
  if (explicitDuration) {
    const minutes = Number(explicitDuration[1]);
    return Number.isSafeInteger(minutes) && minutes > 0 && minutes <= MAX_HIDE_AFTER_MINUTES ? minutes : null;
  }

  const legacyDuration = raw.match(/^(\d{1,3}):([0-5]\d)$/);
  if (legacyDuration) {
    const minutes = (Number(legacyDuration[1]) * 60) + Number(legacyDuration[2]);
    return minutes > 0 && minutes <= MAX_HIDE_AFTER_MINUTES ? minutes : null;
  }

  return null;
}

export function serializeHideAfterDuration(hoursValue = "", minutesValue = "") {
  const hours = Number(hoursValue || 0);
  const minutes = Number(minutesValue || 0);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || minutes < 0 || minutes > 59) return "";
  const total = (hours * 60) + minutes;
  return total > 0 && total <= MAX_HIDE_AFTER_MINUTES ? `${DURATION_PREFIX}${total}` : "";
}

export function splitHideAfterDuration(value = "") {
  const total = parseHideAfterMinutes(value);
  if (total === null) return null;
  return {
    hours: Math.floor(total / 60),
    minutes: total % 60
  };
}

export function formatHideAfterDuration(value = "") {
  const duration = splitHideAfterDuration(value);
  if (!duration) return "";
  const parts = [];
  if (duration.hours) parts.push(`${duration.hours}h`);
  if (duration.minutes) parts.push(`${duration.minutes}min`);
  return parts.join(" ");
}

export function getProgramacaoHideAt(item = {}) {
  const start = toProgramacaoStart(item.date, item.time);
  if (!start) return null;

  const durationMinutes = parseHideAfterMinutes(item.hideAfter);
  if (durationMinutes !== null) {
    return new Date(start.getTime() + (durationMinutes * 60_000));
  }

  const legacyAbsolute = String(item.hideAfter || "").trim();
  if (legacyAbsolute) {
    const parsed = new Date(legacyAbsolute);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return start;
}

export function isProgramacaoVisibleAt(item = {}, now = Date.now()) {
  const hideAt = getProgramacaoHideAt(item);
  return Boolean(hideAt && hideAt.getTime() >= Number(now));
}
