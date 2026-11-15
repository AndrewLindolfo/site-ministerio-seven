import { getCollection, getDocument, explainFirebaseError } from "../db.js";
import { encodeFirestoreValue } from "../lib/firestore-backup-codec.js";

export const BACKUP_COLLECTIONS = [
  "admins",
  "musicas",
  "cifras",
  "programacoes",
  "modoEnsaios",
  "modoEnsaioMusicas",
  "albuns",
  "downloads",
  "downloadsPorMusica",
  "notificacoes",
  "contatos",
  "config",
  "activity_logs"
];

const OPTIONAL_COLLECTIONS = new Set(["contatos", "activity_logs"]);

export async function exportBackupJson() {
  const result = {
    _meta: {
      app: "Ministerio Seven",
      version: 3,
      backupType: "full-clone",
      exportedAt: new Date().toISOString(),
      collections: [...BACKUP_COLLECTIONS]
    }
  };
  const summary = { exported: {}, skipped: [], warnings: [] };
  const responses = await Promise.allSettled(BACKUP_COLLECTIONS.map(async (name) => {
    if (name === "config") {
      const siteConfig = await getDocument("config", "site");
      return siteConfig ? [siteConfig] : [];
    }
    return getCollection(name);
  }));

  for (let index = 0; index < BACKUP_COLLECTIONS.length; index += 1) {
    const name = BACKUP_COLLECTIONS[index];
    const response = responses[index];
    if (response.status === "fulfilled") {
      const items = response.value;
      result[name] = encodeFirestoreValue(items);
      summary.exported[name] = Array.isArray(items) ? items.length : 0;
      continue;
    }

    const error = response.reason;
    const readable = explainFirebaseError(error);
    if (OPTIONAL_COLLECTIONS.has(name)) {
      result[name] = [];
      summary.exported[name] = 0;
      summary.skipped.push(name);
      summary.warnings.push(`Coleção "${name}" ignorada no backup: ${readable}`);
      continue;
    }
    throw new Error(`Falha ao exportar "${name}": ${readable}`);
  }

  result._summary = summary;
  return result;
}
