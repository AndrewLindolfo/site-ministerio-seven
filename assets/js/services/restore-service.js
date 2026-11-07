import { setDocument, explainFirebaseError } from "../db.js";
import { BACKUP_COLLECTIONS } from "./backup-service.js";

const OPTIONAL_COLLECTIONS = new Set(["admins", "contatos"]);

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeForFirestore(value) {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map(sanitizeForFirestore);
  if (isObject(value)) {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (key === "id") continue;
      out[key] = sanitizeForFirestore(val);
    }
    return out;
  }
  return value;
}

function getBackupDataRoot(json) {
  if (!isObject(json)) {
    throw new Error("Arquivo de backup inválido.");
  }

  if (isObject(json.data)) return json.data;
  return json;
}

export async function restoreBackupJson(json) {
  const dataRoot = getBackupDataRoot(json);
  const summary = {
    restored: {},
    skipped: [],
    warnings: []
  };

  for (const collectionName of BACKUP_COLLECTIONS) {
    const items = dataRoot[collectionName];
    if (!Array.isArray(items) || !items.length) {
      summary.restored[collectionName] = 0;
      continue;
    }

    try {
      let restoredCount = 0;
      for (const item of items) {
        if (!item?.id) continue;
        const cleanData = sanitizeForFirestore(item);
        await setDocument(collectionName, item.id, cleanData, { merge: true });
        restoredCount += 1;
      }
      summary.restored[collectionName] = restoredCount;
    } catch (error) {
      const readable = explainFirebaseError(error);
      if (OPTIONAL_COLLECTIONS.has(collectionName) || error?.code === "permission-denied") {
        summary.restored[collectionName] = 0;
        summary.skipped.push(collectionName);
        summary.warnings.push(`Coleção \"${collectionName}\" ignorada: ${readable}`);
        continue;
      }

      throw new Error(`Falha ao restaurar \"${collectionName}\": ${readable}`);
    }
  }

  return summary;
}
