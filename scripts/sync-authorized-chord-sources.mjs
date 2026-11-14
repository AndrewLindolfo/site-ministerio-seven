const PROJECT_ID = "ministerio-seven-site";
const DATABASE = "(default)";
const APPLY = process.argv.includes("--apply");
const accessToken = String(process.env.FIRESTORE_ACCESS_TOKEN || "").trim();

if (!accessToken) throw new Error("Defina FIRESTORE_ACCESS_TOKEN para ler o acervo interno.");

const apiBase = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}/documents`;

function rawString(field, fallback = "") {
  if (field?.stringValue != null) return String(field.stringValue);
  if (field?.integerValue != null) return String(field.integerValue);
  return fallback;
}

function rawBoolean(field, fallback = false) {
  return field?.booleanValue == null ? fallback : field.booleanValue === true;
}

function normalize(value = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function stringValue(value = "") {
  return { stringValue: String(value) };
}

function booleanValue(value = false) {
  return { booleanValue: value === true };
}

function timestampValue() {
  return { timestampValue: new Date().toISOString() };
}

async function listCollection(collectionName) {
  const documents = [];
  let pageToken = "";
  do {
    const url = new URL(`${apiBase}/${collectionName}`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error(`${collectionName}: leitura falhou (${response.status}).`);
    const body = await response.json();
    documents.push(...(body.documents || []));
    pageToken = String(body.nextPageToken || "");
  } while (pageToken);
  return documents;
}

function prepareSource(document) {
  const sourceId = decodeURIComponent(String(document.name || "").split("/").pop() || "");
  const fields = document.fields || {};
  const title = rawString(fields.title).trim();
  const contentText = rawString(fields.cifraText).trim();
  if (!sourceId || !title || !contentText || !rawBoolean(fields.active, true)) return null;
  return {
    documentId: `site-${sourceId}`,
    fields: {
      title: stringValue(title.slice(0, 150)),
      normalizedTitle: stringValue((rawString(fields.normalizedTitle) || normalize(title)).slice(0, 180)),
      artist: stringValue(rawString(fields.subtitle).slice(0, 150)),
      version: stringValue("Versão cadastrada no Ministério Seven"),
      source: stringValue("Acervo interno Ministério Seven"),
      key: stringValue(rawString(fields.originalKey).slice(0, 10)),
      contentText: stringValue(contentText.slice(0, 300000)),
      active: booleanValue(true),
      sourceCollection: stringValue("cifras"),
      sourceDocumentId: stringValue(sourceId),
      updatedAt: timestampValue()
    }
  };
}

async function createSource(source) {
  const url = new URL(`${apiBase}/authorizedChordSources/${encodeURIComponent(source.documentId)}`);
  url.searchParams.set("currentDocument.exists", "false");
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields: source.fields })
  });
  if (response.status === 409) return "exists";
  if (!response.ok) throw new Error(`${source.documentId}: gravação falhou (${response.status}).`);
  return "created";
}

const sourceDocuments = await listCollection("cifras");
const prepared = sourceDocuments.map(prepareSource).filter(Boolean);
const summary = {
  mode: APPLY ? "apply" : "dry-run",
  cifrasRead: sourceDocuments.length,
  authorizedSourcesPrepared: prepared.length
};

if (!APPLY) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

const results = { created: 0, exists: 0 };
for (let offset = 0; offset < prepared.length; offset += 10) {
  const batch = await Promise.all(prepared.slice(offset, offset + 10).map(createSource));
  for (const result of batch) results[result] += 1;
}

console.log(JSON.stringify({ ...summary, results }, null, 2));
