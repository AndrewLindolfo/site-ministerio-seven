const SOURCE_PROJECT = "ministerio-seven-v2";
const TARGET_PROJECT = "ministerio-seven-site";
const DATABASE = "(default)";
const APPLY = process.argv.includes("--apply");
const sourceApiKey = String(process.env.OLD_FIREBASE_API_KEY || "").trim();
const accessToken = String(process.env.MIGRATION_ACCESS_TOKEN || "").trim();

if (!sourceApiKey) throw new Error("Defina OLD_FIREBASE_API_KEY.");
if (APPLY && !accessToken) throw new Error("Defina MIGRATION_ACCESS_TOKEN para aplicar a migração.");

const stringValue = (value = "") => ({ stringValue: String(value) });
const booleanValue = (value = false) => ({ booleanValue: value === true });
const integerValue = (value = 0) => ({ integerValue: String(Math.max(0, Math.trunc(Number(value) || 0))) });
const timestampValue = () => ({ timestampValue: new Date().toISOString() });

function rawString(field, fallback = "") {
  if (field?.stringValue != null) return String(field.stringValue);
  return fallback;
}

function ensure(fields, key, value) {
  if (!(key in fields)) fields[key] = value;
}

function only(fields, allowed) {
  const output = {};
  for (const key of allowed) {
    if (key in fields) output[key] = fields[key];
  }
  return output;
}

const schemas = {
  musicas: {
    allowed: ["title", "slug", "normalizedTitle", "subtitle", "author", "originalKey", "category", "youtubeUrl", "internalNotes", "lyricHtml", "views", "active", "createdAt", "updatedAt"],
    required: ["title", "slug", "normalizedTitle"],
    defaults: {
      subtitle: stringValue(), author: stringValue(), originalKey: stringValue(), category: stringValue(),
      youtubeUrl: stringValue(), internalNotes: stringValue(), lyricHtml: stringValue(), views: integerValue(),
      active: booleanValue(true), updatedAt: timestampValue()
    }
  },
  cifras: {
    allowed: ["musicaId", "title", "slug", "normalizedTitle", "subtitle", "cifraText", "cifraHtml", "originalKey", "capo", "bpm", "compasso", "instrumento", "chordColor", "views", "active", "createdAt", "updatedAt"],
    required: ["musicaId", "title", "slug", "normalizedTitle"],
    defaults: {
      subtitle: stringValue(), cifraText: stringValue(), cifraHtml: stringValue(), originalKey: stringValue(),
      capo: stringValue(), bpm: stringValue(), compasso: stringValue(), instrumento: stringValue("violao"),
      chordColor: stringValue("#FF5C00"), views: integerValue(), active: booleanValue(true), updatedAt: timestampValue()
    }
  },
  programacoes: {
    allowed: ["title", "date", "time", "location", "description", "hideAfter", "songs", "active", "createdAt", "updatedAt"],
    required: ["title", "date", "time", "songs"],
    defaults: {
      location: stringValue(), description: stringValue(), hideAfter: stringValue(), active: booleanValue(true), updatedAt: timestampValue()
    }
  },
  albuns: {
    allowed: ["title", "normalizedTitle", "albumUrl", "coverUrl", "description", "active", "createdAt", "updatedAt"],
    required: ["title", "normalizedTitle", "albumUrl"],
    defaults: { coverUrl: stringValue(), description: stringValue(), active: booleanValue(true), updatedAt: timestampValue() }
  },
  downloads: {
    allowed: ["title", "normalizedTitle", "url", "description", "imageUrl", "linkType", "active", "createdAt", "updatedAt"],
    required: ["title", "normalizedTitle", "url", "linkType"],
    defaults: { description: stringValue(), imageUrl: stringValue(), active: booleanValue(true), updatedAt: timestampValue() }
  },
  downloadsPorMusica: {
    allowed: ["musicaId", "title", "normalizedTitle", "slug", "pdfUrl", "pptUrl", "active", "createdAt", "updatedAt"],
    required: ["musicaId", "title", "normalizedTitle"],
    defaults: { slug: stringValue(), pdfUrl: stringValue(), pptUrl: stringValue(), active: booleanValue(true), updatedAt: timestampValue() }
  },
  notificacoes: {
    allowed: ["title", "normalizedTitle", "message", "type", "tipo", "active", "showPopup", "showHome", "showPublic", "showTop", "showBeforeStart", "popupMode", "topMode", "startsAt", "expiresAt", "buttonText", "buttonLink", "createdAt", "updatedAt"],
    required: ["title", "normalizedTitle", "message"],
    defaults: {
      type: stringValue("aviso"), tipo: stringValue("aviso"), active: booleanValue(true),
      showPopup: booleanValue(), showHome: booleanValue(), showPublic: booleanValue(true), showTop: booleanValue(),
      showBeforeStart: booleanValue(), popupMode: stringValue("device_once"), topMode: stringValue("device_once"),
      startsAt: stringValue(), expiresAt: stringValue(), buttonText: stringValue(), buttonLink: stringValue(), updatedAt: timestampValue()
    }
  },
  config: {
    allowed: ["instagramUrl", "instagramHandle", "officialEmail", "agendaEmbed", "sevenPhotoUrl", "updatedAt"],
    required: [],
    defaults: { updatedAt: timestampValue() }
  }
};

async function listCollection(collectionName) {
  const documents = [];
  let pageToken = "";
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${SOURCE_PROJECT}/databases/${DATABASE}/documents/${collectionName}`);
    url.searchParams.set("pageSize", "300");
    url.searchParams.set("key", sourceApiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${collectionName}: leitura falhou (${response.status}).`);
    const body = await response.json();
    documents.push(...(body.documents || []));
    pageToken = String(body.nextPageToken || "");
  } while (pageToken);
  return documents;
}

function transformDocument(collectionName, document) {
  const documentId = decodeURIComponent(String(document.name || "").split("/").pop() || "");
  if (!documentId || documentId.includes("/")) throw new Error(`${collectionName}: ID inválido.`);
  if (collectionName === "config" && documentId !== "site") return null;

  const schema = schemas[collectionName];
  let fields = only(document.fields || {}, schema.allowed);
  if (collectionName === "cifras") {
    const instrument = rawString(fields.instrumento, rawString(document.fields?.instrumentSlug, "violao")).toLowerCase();
    fields.instrumento = stringValue(["violao", "guitarra", "baixo", "teclado"].includes(instrument) ? instrument : "violao");
  }
  if (collectionName === "notificacoes") {
    const type = rawString(fields.type, rawString(fields.tipo, "aviso"));
    fields.type = stringValue(type);
    fields.tipo = stringValue(type);
  }
  for (const [key, value] of Object.entries(schema.defaults)) ensure(fields, key, value);
  const missing = schema.required.filter((key) => !(key in fields));
  if (missing.length) throw new Error(`${collectionName}/${documentId}: campos ausentes: ${missing.join(", ")}.`);
  return { collectionName, documentId, fields };
}

async function createTargetDocument(document) {
  const url = new URL(`https://firestore.googleapis.com/v1/projects/${TARGET_PROJECT}/databases/${DATABASE}/documents/${document.collectionName}/${encodeURIComponent(document.documentId)}`);
  url.searchParams.set("currentDocument.exists", "false");
  const response = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: document.fields })
  });
  if (response.status === 409) return "exists";
  if (!response.ok) throw new Error(`${document.collectionName}/${document.documentId}: gravação falhou (${response.status}).`);
  return "created";
}

const prepared = [];
for (const collectionName of Object.keys(schemas)) {
  const source = await listCollection(collectionName);
  for (const document of source) {
    const transformed = transformDocument(collectionName, document);
    if (transformed) prepared.push(transformed);
  }
}

const summary = {};
for (const item of prepared) summary[item.collectionName] = (summary[item.collectionName] || 0) + 1;

if (!APPLY) {
  console.log(JSON.stringify({ mode: "dry-run", total: prepared.length, collections: summary }, null, 2));
  process.exit(0);
}

const results = { created: 0, exists: 0 };
for (let offset = 0; offset < prepared.length; offset += 10) {
  const batch = await Promise.all(prepared.slice(offset, offset + 10).map(createTargetDocument));
  for (const result of batch) results[result] += 1;
}
console.log(JSON.stringify({ mode: "apply", total: prepared.length, collections: summary, results }, null, 2));
