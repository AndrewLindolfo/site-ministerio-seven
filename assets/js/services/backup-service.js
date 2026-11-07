import { getCollection, explainFirebaseError } from "../db.js";

export const BACKUP_COLLECTIONS = [
  "admins",
  "musicas",
  "cifras",
  "programacoes",
  "albuns",
  "downloads",
  "notificacoes",
  "contatos",
  "links",
  "config"
];

const OPTIONAL_COLLECTIONS = new Set(["admins", "contatos"]);

function sanitizeForJson(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(sanitizeForJson);
  if (typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (typeof val === "function") continue;
      out[key] = sanitizeForJson(val);
    }
    return out;
  }
  return value;
}

export async function exportBackupJson() {
  const result = {
    _meta: {
      app: "Ministerio Seven",
      version: 1,
      backupType: "full-clone",
      exportedAt: new Date().toISOString(),
      collections: [...BACKUP_COLLECTIONS]
    }
  };

  const summary = {
    exported: {},
    skipped: [],
    warnings: []
  };

  for (const name of BACKUP_COLLECTIONS) {
    try {
      const items = await getCollection(name);
      result[name] = sanitizeForJson(items);
      summary.exported[name] = Array.isArray(items) ? items.length : 0;
    } catch (error) {
      const readable = explainFirebaseError(error);
      if (OPTIONAL_COLLECTIONS.has(name) || error?.code === "permission-denied") {
        result[name] = [];
        summary.exported[name] = 0;
        summary.skipped.push(name);
        summary.warnings.push(`Coleção \"${name}\" ignorada no backup: ${readable}`);
        continue;
      }
      throw new Error(`Falha ao exportar \"${name}\": ${readable}`);
    }
  }

  result._summary = summary;
  return result;
}
