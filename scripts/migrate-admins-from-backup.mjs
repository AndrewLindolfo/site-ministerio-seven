import { readFile } from "node:fs/promises";

const TARGET_PROJECT = "ministerio-seven-site";
const DATABASE = "(default)";
const APPLY = process.argv.includes("--apply");
const backupPath = String(process.env.OLD_BACKUP_PATH || "").trim();
const accessToken = String(process.env.MIGRATION_ACCESS_TOKEN || "").trim();

if (!backupPath) throw new Error("Defina OLD_BACKUP_PATH.");
if (APPLY && !accessToken) throw new Error("Defina MIGRATION_ACCESS_TOKEN para aplicar a migração.");

const DEFAULT_PERMISSIONS = {
  musicas: { create: false, edit: false, delete: false },
  cifras: {
    create: false, edit: false, delete: false, capo: false, bpm: false, compasso: false,
    inst_violao: false, inst_guitarra: false, inst_baixo: false, inst_teclado: false
  },
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

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase().slice(0, 254);
}

function normalizePermissions(incoming = {}) {
  const output = structuredClone(DEFAULT_PERMISSIONS);
  for (const [moduleKey, modulePermissions] of Object.entries(output)) {
    for (const permissionKey of Object.keys(modulePermissions)) {
      output[moduleKey][permissionKey] = incoming?.[moduleKey]?.[permissionKey] === true;
    }
  }
  return output;
}

function encodeValue(value) {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeValue(item)]))
      }
    };
  }
  throw new Error(`Tipo não suportado na migração: ${typeof value}.`);
}

function encodeAdmin(admin) {
  const fields = Object.fromEntries(
    Object.entries(admin).map(([key, value]) => [key, encodeValue(value)])
  );
  const now = new Date().toISOString();
  fields.createdAt = { timestampValue: now };
  fields.updatedAt = { timestampValue: now };
  return fields;
}

function transformAdmin(source) {
  const email = normalizeEmail(source?.email);
  const name = String(source?.name || source?.nome || source?.neme || "").trim().slice(0, 150);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Administrador com e-mail inválido.");
  if (!name) throw new Error(`Administrador ${email} sem nome.`);

  const isPrimary = source?.id === "master" || source?.isPrimary === true;
  const documentId = isPrimary ? "master" : `email_${email}`;
  const admin = {
    name,
    email,
    active: source?.active !== false && source?.ativo !== false,
    isPrimary,
    pendingUid: true
  };
  if (!isPrimary) admin.permissions = normalizePermissions(source?.permissions || {});
  return { documentId, email, isPrimary, fields: encodeAdmin(admin) };
}

async function createTargetAdmin(admin) {
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${TARGET_PROJECT}/databases/${DATABASE}/documents/admins/${encodeURIComponent(admin.documentId)}`
  );
  url.searchParams.set("currentDocument.exists", "false");
  const response = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: admin.fields })
  });
  if (response.status === 409) return "exists";
  if (!response.ok) throw new Error(`admins/${admin.documentId}: gravação falhou (${response.status}).`);
  return "created";
}

const backup = JSON.parse(await readFile(backupPath, "utf8"));
if (!Array.isArray(backup.admins)) throw new Error("O backup não contém a coleção admins.");

const prepared = backup.admins.map(transformAdmin);
const documentIds = new Set(prepared.map((admin) => admin.documentId));
const primaryCount = prepared.filter((admin) => admin.isPrimary).length;
if (documentIds.size !== prepared.length) throw new Error("O backup contém administradores duplicados.");
if (primaryCount !== 1) throw new Error(`Esperado um administrador principal; encontrados ${primaryCount}.`);

const summary = {
  mode: APPLY ? "apply" : "dry-run",
  total: prepared.length,
  primary: prepared.filter((admin) => admin.isPrimary).map((admin) => admin.email),
  secondary: prepared.filter((admin) => !admin.isPrimary).map((admin) => admin.email),
  oldUidsDiscarded: true,
  overwriteProtection: true
};

if (!APPLY) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

const results = { created: 0, exists: 0 };
for (const admin of prepared) {
  const result = await createTargetAdmin(admin);
  results[result] += 1;
}
console.log(JSON.stringify({ ...summary, results }, null, 2));
