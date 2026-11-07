import { getCollection, getOneByField, getDocument, setDocument, deleteDocument, serverTimestamp } from "../db.js";

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase().slice(0, 254);
}

export const ADMIN_COLLECTION = "admins";

export const PRIMARY_ADMIN_DOC_ID = "master";

export async function getPrimaryAdminDoc() {
  const admin = await getDocument(ADMIN_COLLECTION, PRIMARY_ADMIN_DOC_ID);
  if (!admin) return null;
  if (admin.active === false || admin.ativo === false) return null;
  return admin;
}

export const DEFAULT_PERMISSIONS = {
  musicas: { create: false, edit: false, delete: false },
  cifras: { create: false, edit: false, delete: false, capo: false, bpm: false, compasso: false, inst_violao: false, inst_guitarra: false, inst_baixo: false, inst_teclado: false },
  programacoes: { create: false, edit: false, delete: false },
  fotos: { create: false, edit: false, delete: false },
  downloadsGerais: { create: false, edit: false, delete: false },
  downloadsPorMusica: { create: false, edit: false, delete: false },
  contatos: { view: false, delete: false },
  notificacoes: {
    create: false, edit: false, delete: false,
    popup: false, top: false, buttonLink: false, beforeStart: false
  },
  ensaios: { create: false, edit: false, delete: false },
  logs: { view: false }
};

export function cloneDefaultPermissions() {
  return JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
}

function mergePermissions(base = {}, incoming = {}) {
  const output = cloneDefaultPermissions();
  Object.keys(output).forEach((moduleKey) => {
    const incomingGroup = incoming?.[moduleKey] || {};
    Object.keys(output[moduleKey]).forEach((permKey) => {
      output[moduleKey][permKey] = incomingGroup?.[permKey] === true;
    });
  });
  return output;
}

export function isPrimaryAdmin(admin = null) {
  if (!admin) return false;
  return admin.id === PRIMARY_ADMIN_DOC_ID || admin.isPrimary === true || admin.principal === true;
}

export function getEffectivePermissions(admin = null) {
  if (!admin) return cloneDefaultPermissions();
  if (isPrimaryAdmin(admin)) {
    const all = cloneDefaultPermissions();
    Object.keys(all).forEach((moduleKey) => {
      Object.keys(all[moduleKey]).forEach((permKey) => all[moduleKey][permKey] = true);
    });
    return all;
  }
  return mergePermissions(DEFAULT_PERMISSIONS, admin.permissions || {});
}

export function hasPermission(admin, moduleKey, permKey) {
  const perms = getEffectivePermissions(admin);
  return perms?.[moduleKey]?.[permKey] === true;
}

export function hasAnyModulePermission(admin, moduleKey) {
  const perms = getEffectivePermissions(admin);
  return Object.values(perms?.[moduleKey] || {}).some(Boolean);
}

const CIFRA_INSTRUMENT_PERMISSION_MAP = {
  violao: "inst_violao",
  guitarra: "inst_guitarra",
  baixo: "inst_baixo",
  teclado: "inst_teclado"
};

export function getAllowedCifraInstruments(admin = null) {
  const allInstruments = Object.keys(CIFRA_INSTRUMENT_PERMISSION_MAP);
  if (isPrimaryAdmin(admin)) return allInstruments;

  const raw = admin?.permissions?.cifras || {};
  const hasExplicitRestrictions = Object.values(CIFRA_INSTRUMENT_PERMISSION_MAP).some((key) => key in raw);
  if (!hasExplicitRestrictions && hasAnyModulePermission(admin, "cifras")) {
    return allInstruments;
  }

  const perms = getEffectivePermissions(admin);
  return allInstruments.filter((instrument) => perms?.cifras?.[CIFRA_INSTRUMENT_PERMISSION_MAP[instrument]] === true);
}

export function canManageCifraInstrument(admin = null, instrument = "") {
  const normalized = String(instrument || "violao").trim().toLowerCase();
  return getAllowedCifraInstruments(admin).includes(normalized);
}

export function canAccessAdminPage(admin, pageKey = "") {
  if (isPrimaryAdmin(admin)) return true;
  switch (pageKey) {
    case "dashboard":
      return true;
    case "logs":
      return hasPermission(admin, "logs", "view");
    case "admins":
    case "links":
    case "backup":
      return false;
    case "musicas":
      return hasAnyModulePermission(admin, "musicas");
    case "editor-musica-create":
      return hasPermission(admin, "musicas", "create");
    case "editor-musica-edit":
      return hasPermission(admin, "musicas", "edit");
    case "cifras":
      return hasAnyModulePermission(admin, "cifras");
    case "editor-cifra-create":
      return hasPermission(admin, "cifras", "create");
    case "editor-cifra-edit":
      return hasPermission(admin, "cifras", "edit");
    case "programacoes":
      return hasAnyModulePermission(admin, "programacoes");
    case "fotos":
      return hasAnyModulePermission(admin, "fotos");
    case "downloads":
      return hasAnyModulePermission(admin, "downloadsGerais") || hasAnyModulePermission(admin, "downloadsPorMusica");
    case "downloads-geral":
      return hasAnyModulePermission(admin, "downloadsGerais");
    case "downloads-por-musica":
      return hasAnyModulePermission(admin, "downloadsPorMusica");
    case "contatos":
      return hasAnyModulePermission(admin, "contatos");
    case "notificacoes":
      return hasAnyModulePermission(admin, "notificacoes");
    case "ensaios":
      return hasAnyModulePermission(admin, "ensaios");
    case "editor-ensaio-create":
      return hasPermission(admin, "ensaios", "create");
    case "editor-ensaio-edit":
      return hasPermission(admin, "ensaios", "edit");
    default:
      return true;
  }
}

export async function listAdmins() {
  const all = await getCollection(ADMIN_COLLECTION);
  return all
    .filter((item) => item.active !== false && item.ativo !== false)
    .sort((a, b) => String(a.name || a.nome || a.email || "").localeCompare(String(b.name || b.nome || b.email || ""), "pt-BR"));
}

export async function getAdminByEmail(email = "") {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const primary = await getPrimaryAdminDoc();
  if (primary && normalizeEmail(primary.email) === normalized) {
    return primary;
  }

  const admin = await getOneByField(ADMIN_COLLECTION, "email", normalized);
  if (!admin) return null;
  if (admin.active === false || admin.ativo === false) return null;
  return admin;
}

export function buildAdminDocIdFromEmail(email = "") {
  return `email_${encodeURIComponent(normalizeEmail(email))}`;
}

export function buildLegacyAdminDocIdFromEmail(email = "") {
  return normalizeEmail(email).replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

export async function saveSecondaryAdmin(payload = {}, existingId = "") {
  const email = normalizeEmail(payload.email || "");
  const name = String(payload.name || "").trim().slice(0, 150);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
    throw new Error("Preencha nome e e-mail do administrador.");
  }

  const current = existingId ? await getDocument(ADMIN_COLLECTION, existingId) : null;
  if (existingId && (!current || isPrimaryAdmin(current))) {
    throw new Error("Administrador secundário inválido.");
  }

  const maybeExisting = await getAdminByEmail(email);
  if (maybeExisting && maybeExisting.id !== existingId) {
    throw new Error("Já existe um administrador cadastrado com este e-mail.");
  }

  const emailChanged = Boolean(current && normalizeEmail(current.email) !== email);
  const targetId = emailChanged ? buildAdminDocIdFromEmail(email) : (existingId || maybeExisting?.id || buildAdminDocIdFromEmail(email));
  if (targetId === PRIMARY_ADMIN_DOC_ID) throw new Error("O administrador principal não pode ser alterado por este formulário.");

  const resolvedUid = emailChanged ? "" : String(payload.uid || current?.uid || maybeExisting?.uid || "").trim().slice(0, 128);
  const docData = {
    name,
    email,
    permissions: mergePermissions(DEFAULT_PERMISSIONS, payload.permissions || {}),
    isPrimary: false,
    active: payload.active !== false,
    pendingUid: !resolvedUid,
    updatedAt: serverTimestamp()
  };

  if (resolvedUid) {
    docData.uid = resolvedUid;
    docData.uidBoundAt = serverTimestamp();
  }

  if (emailChanged || !current?.createdAt) docData.createdAt = serverTimestamp();

  await setDocument(ADMIN_COLLECTION, targetId, docData, { merge: true });
  if (emailChanged && existingId !== targetId) await deleteDocument(ADMIN_COLLECTION, existingId);
  return targetId;
}

export async function removeSecondaryAdmin(id = "") {
  if (!id) return;
  if (id === PRIMARY_ADMIN_DOC_ID) throw new Error("O administrador principal não pode ser removido.");
  await deleteDocument(ADMIN_COLLECTION, id);
}
