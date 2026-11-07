import { getDocument, setDocument, serverTimestamp } from "../db.js";
const COLLECTION = "config";
const DOC_ID = "site";

export async function getSiteConfig() {
  return await getDocument(COLLECTION, DOC_ID);
}

export async function saveSiteConfig(payload) {
  return await setDocument(COLLECTION, DOC_ID, {
    instagramUrl: payload.instagramUrl || "",
    instagramHandle: payload.instagramHandle || "",
    officialEmail: payload.officialEmail || "",
    agendaEmbed: payload.agendaEmbed || "",
    sevenPhotoUrl: payload.sevenPhotoUrl || "",
    updatedAt: serverTimestamp()
  });
}
