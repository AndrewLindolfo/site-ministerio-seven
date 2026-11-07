import { setDocument, explainFirebaseError } from "../db.js";
import { BACKUP_COLLECTIONS } from "./backup-service.js";

const OPTIONAL_COLLECTIONS = new Set(["contatos", "activity_logs"]);
const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENTS_PER_COLLECTION = 5000;
const RESTORE_BATCH_SIZE = 20;

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeForFirestore(value, depth = 0) {
  if (depth > 20) throw new Error("Estrutura do backup excede a profundidade permitida.");
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.slice(0, 5000).map((item) => sanitizeForFirestore(item, depth + 1));
  if (isObject(value)) {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) continue;
      out[key.slice(0, 1500)] = sanitizeForFirestore(val, depth + 1);
    }
    return out;
  }
  return typeof value === "string" ? value.slice(0, 700_000) : value;
}

function getBackupDataRoot(json) {
  if (!isObject(json)) throw new Error("Arquivo de backup inválido.");
  const bytes = new TextEncoder().encode(JSON.stringify(json)).byteLength;
  if (bytes > MAX_BACKUP_BYTES) throw new Error("O arquivo de backup excede o limite de 20 MB.");
  if (json._meta?.app && json._meta.app !== "Ministerio Seven") throw new Error("Este backup pertence a outro aplicativo.");
  return isObject(json.data) ? json.data : json;
}

async function restoreCollection(collectionName, items) {
  let restoredCount = 0;
  for (let offset = 0; offset < items.length; offset += RESTORE_BATCH_SIZE) {
    const batch = items.slice(offset, offset + RESTORE_BATCH_SIZE).map(async (item) => {
      const id = String(item?.id || "").trim();
      if (!id || id.length > 1500 || id.includes("/")) return false;
      const { id: ignoredId, ...documentData } = item;
      await setDocument(collectionName, id, sanitizeForFirestore(documentData));
      return true;
    });
    const restored = await Promise.all(batch);
    restoredCount += restored.filter(Boolean).length;
  }
  return restoredCount;
}

export async function restoreBackupJson(json) {
  const dataRoot = getBackupDataRoot(json);
  const summary = { restored: {}, skipped: [], warnings: [] };

  for (const collectionName of BACKUP_COLLECTIONS) {
    const items = dataRoot[collectionName];
    if (!Array.isArray(items) || !items.length) {
      summary.restored[collectionName] = 0;
      continue;
    }
    if (items.length > MAX_DOCUMENTS_PER_COLLECTION) {
      throw new Error(`A coleção "${collectionName}" excede o limite de ${MAX_DOCUMENTS_PER_COLLECTION} documentos.`);
    }

    try {
      summary.restored[collectionName] = await restoreCollection(collectionName, items);
    } catch (error) {
      const readable = explainFirebaseError(error);
      if (OPTIONAL_COLLECTIONS.has(collectionName)) {
        summary.restored[collectionName] = 0;
        summary.skipped.push(collectionName);
        summary.warnings.push(`Coleção "${collectionName}" ignorada: ${readable}`);
        continue;
      }
      throw new Error(`Falha ao restaurar "${collectionName}": ${readable}`);
    }
  }

  return summary;
}
