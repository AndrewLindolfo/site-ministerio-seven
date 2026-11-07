import { updateDocument, increment } from "../db.js";

export async function incrementViews(collectionName, id) {
  if (!id) return;
  try {
    await updateDocument(collectionName, id, { views: increment(1) });
  } catch (error) {
    console.warn("Falha ao incrementar views:", error);
  }
}
