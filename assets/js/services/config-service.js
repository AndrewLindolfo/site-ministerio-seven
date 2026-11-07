import { getDocument, setDocument, serverTimestamp } from "../db.js";
import { normalizeHttpsOrLocalUrl } from "../lib/url-safety.js";
const COLLECTION = "config";
const DOC_ID = "site";

function normalizeString(value = "", maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeHttpsUrl(value = "", maxLength = 2000) {
  const normalized = normalizeHttpsOrLocalUrl(value, maxLength);
  return normalized.startsWith("https://") ? normalized : "";
}

function normalizeAgendaEmbed(value = "") {
  const raw = normalizeString(value, 5000);
  const match = raw.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  return normalizeHttpsUrl(match?.[1] || raw, 2000);
}

function normalizeEmail(value = "") {
  const email = normalizeString(value, 254).toLowerCase();
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail oficial inválido.");
  return email;
}

export async function getSiteConfig() {
  const config = await getDocument(COLLECTION, DOC_ID);
  if (!config) return null;
  return {
    ...config,
    instagramUrl: normalizeHttpsUrl(config.instagramUrl),
    instagramHandle: normalizeString(config.instagramHandle, 100),
    officialEmail: normalizeString(config.officialEmail, 254).toLowerCase(),
    agendaEmbed: normalizeAgendaEmbed(config.agendaEmbed),
    sevenPhotoUrl: normalizeHttpsUrl(config.sevenPhotoUrl)
  };
}

export async function saveSiteConfig(payload) {
  const data = { updatedAt: serverTimestamp() };
  if (Object.hasOwn(payload, "instagramUrl")) {
    data.instagramUrl = normalizeHttpsUrl(payload.instagramUrl);
    if (normalizeString(payload.instagramUrl) && !data.instagramUrl) throw new Error("Link do Instagram inválido. Use HTTPS.");
  }
  if (Object.hasOwn(payload, "instagramHandle")) data.instagramHandle = normalizeString(payload.instagramHandle, 100);
  if (Object.hasOwn(payload, "officialEmail")) data.officialEmail = normalizeEmail(payload.officialEmail);
  if (Object.hasOwn(payload, "agendaEmbed")) {
    data.agendaEmbed = normalizeAgendaEmbed(payload.agendaEmbed);
    if (normalizeString(payload.agendaEmbed) && !data.agendaEmbed) throw new Error("Link da agenda inválido. Use HTTPS.");
  }
  if (Object.hasOwn(payload, "sevenPhotoUrl")) {
    data.sevenPhotoUrl = normalizeHttpsUrl(payload.sevenPhotoUrl);
    if (normalizeString(payload.sevenPhotoUrl) && !data.sevenPhotoUrl) throw new Error("Link da foto principal inválido. Use HTTPS.");
  }
  return await setDocument(COLLECTION, DOC_ID, data, { merge: true });
}
