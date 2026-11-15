import { deleteDocument, getCollection, getDocument, serverTimestamp, setDocument } from "../db.js";

export const MEMBER_COLLECTION = "integrantes";
export const DEFAULT_MEMBER_PERMISSIONS = {
  ensaios: { create: false, edit: false, delete: false }
};

export function normalizeMemberEmail(value = "") {
  return String(value || "").trim().toLowerCase().slice(0, 254);
}

export function buildMemberDocIdFromEmail(email = "") {
  return `email_${normalizeMemberEmail(email)}`;
}

export function cloneDefaultMemberPermissions() {
  return JSON.parse(JSON.stringify(DEFAULT_MEMBER_PERMISSIONS));
}

function mergeMemberPermissions(incoming = {}) {
  const output = cloneDefaultMemberPermissions();
  Object.keys(output.ensaios).forEach((key) => {
    output.ensaios[key] = incoming?.ensaios?.[key] === true;
  });
  return output;
}

export function getEffectiveMemberPermissions(member = null) {
  return mergeMemberPermissions(member?.permissions || {});
}

export function memberHasPermission(member, action = "") {
  return getEffectiveMemberPermissions(member)?.ensaios?.[action] === true;
}

async function getAccessibleMemberDocument(id = "") {
  try {
    return await getDocument(MEMBER_COLLECTION, id);
  } catch (error) {
    if (String(error?.code || "").includes("permission-denied")) return null;
    throw error;
  }
}

async function bindPendingMember(member = null, user = null) {
  const uid = String(user?.uid || "").trim().slice(0, 128);
  const email = normalizeMemberEmail(user?.email || member?.email || "");
  if (!member || !uid || !email) return member;
  const payload = {
    uid,
    pendingUid: false,
    uidBoundAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDocument(MEMBER_COLLECTION, member.id || buildMemberDocIdFromEmail(email), payload, { merge: true });
  return { ...member, ...payload };
}

export async function getMemberProfileForUser(user = null, options = {}) {
  const uid = String(user?.uid || "").trim();
  const email = normalizeMemberEmail(user?.email || "");
  if (!uid || !email || user?.emailVerified === false) return null;
  const member = await getAccessibleMemberDocument(buildMemberDocIdFromEmail(email));
  if (!member || member.active !== true || normalizeMemberEmail(member.email) !== email) return null;
  const savedUid = String(member.uid || "").trim();
  if (savedUid && savedUid !== uid) return null;
  if (!savedUid && options.bind !== false) return bindPendingMember(member, user);
  return member;
}

export async function listMembers() {
  const rows = await getCollection(MEMBER_COLLECTION);
  return rows.sort((a, b) => String(a.name || a.email || "").localeCompare(String(b.name || b.email || ""), "pt-BR"));
}

export async function saveMember(payload = {}, existingId = "") {
  const name = String(payload.name || "").trim().slice(0, 150);
  const email = normalizeMemberEmail(payload.email || "");
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Preencha o nome e um e-mail válido do integrante.");
  }
  const current = existingId ? await getDocument(MEMBER_COLLECTION, existingId) : null;
  if (existingId && !current) throw new Error("Integrante não encontrado.");
  const targetId = buildMemberDocIdFromEmail(email);
  const emailChanged = Boolean(current && normalizeMemberEmail(current.email) !== email);
  const duplicate = await getDocument(MEMBER_COLLECTION, targetId);
  if (duplicate && duplicate.id !== existingId) throw new Error("Já existe um integrante cadastrado com este e-mail.");
  const uid = emailChanged ? "" : String(current?.uid || payload.uid || "").trim().slice(0, 128);
  const data = {
    name,
    email,
    permissions: mergeMemberPermissions(payload.permissions),
    active: payload.active !== false,
    pendingUid: !uid,
    updatedAt: serverTimestamp()
  };
  if (uid) data.uid = uid;
  if (!current?.createdAt || emailChanged) data.createdAt = serverTimestamp();
  if (uid && current?.uidBoundAt) data.uidBoundAt = current.uidBoundAt;
  await setDocument(MEMBER_COLLECTION, targetId, data, { merge: true });
  if (emailChanged && existingId && existingId !== targetId) await deleteDocument(MEMBER_COLLECTION, existingId);
  return targetId;
}

export async function removeMember(id = "") {
  if (id) await deleteDocument(MEMBER_COLLECTION, id);
}
