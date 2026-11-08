const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { clean, normalize, mapLrclibRecord, mapYoutubeItem } = require("./lib/content");

initializeApp();
const db = getFirestore();

function json(res, status, payload) {
  res.status(status).set("Cache-Control", "private, no-store").json(payload);
}

function allowedOrigin(origin = "") {
  if (!origin) return "";
  const configured = String(process.env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (configured.includes(origin)) return origin;
  try {
    const url = new URL(origin);
    if (["localhost", "127.0.0.1"].includes(url.hostname)) return origin;
  } catch {}
  return "";
}

async function requireAdmin(req) {
  const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error("Autenticação administrativa obrigatória."), { status: 401 });
  const decoded = await getAuth().verifyIdToken(match[1]);
  const email = String(decoded.email || "").trim().toLowerCase();
  if (!decoded.uid || !email || decoded.email_verified !== true) throw Object.assign(new Error("Conta administrativa inválida."), { status: 403 });
  const [primary, secondary] = await Promise.all([
    db.doc("admins/master").get(),
    db.doc(`admins/email_${email}`).get()
  ]);
  const records = [primary, secondary].filter((snap) => snap.exists).map((snap) => ({ id: snap.id, ...snap.data() }));
  const admin = records.find((item) => item.active !== false && item.ativo !== false && String(item.email || "").toLowerCase() === email && String(item.uid || "") === decoded.uid);
  if (!admin) throw Object.assign(new Error("Este usuário não está autorizado a pesquisar conteúdo."), { status: 403 });
  return { decoded, admin };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15_000) });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    const error = new Error(response.status === 429 ? `Fonte temporariamente ocupada. Tente novamente em ${retryAfter || "alguns"} segundos.` : `A fonte consultada respondeu com erro ${response.status}.`);
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  return data;
}

async function searchLyrics(title, artist) {
  const params = new URLSearchParams({ track_name: title });
  if (artist) params.set("artist_name", artist);
  const records = await fetchJson(`https://lrclib.net/api/search?${params}`, { headers: { "Lrclib-Client": "MinisterioSeven-Test/0.1" } });
  return (Array.isArray(records) ? records : []).filter((item) => !item.instrumental && item.plainLyrics).slice(0, 8).map((item) => mapLrclibRecord(item));
}

async function searchVideos(title, artist, details) {
  const key = clean(process.env.YOUTUBE_API_KEY, 200);
  if (!key) return [];
  const params = new URLSearchParams({ part: "snippet", type: "video", videoEmbeddable: "true", maxResults: "8", regionCode: "BR", relevanceLanguage: "pt", q: [title, artist, details].filter(Boolean).join(" "), key });
  const data = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${params}`);
  return (data.items || []).map(mapYoutubeItem).filter((item) => item.url);
}

async function musicSearch(req, res) {
  const title = clean(req.body?.title, 150);
  const artist = clean(req.body?.artist, 150);
  const details = clean(req.body?.details, 300);
  if (!title) return json(res, 400, { message: "Informe o nome da música." });
  const settled = await Promise.allSettled([searchLyrics(title, artist), searchVideos(title, artist, details)]);
  const warnings = settled.filter((item) => item.status === "rejected").map((item) => item.reason?.message || "Uma fonte não respondeu.");
  return json(res, 200, { lyrics: settled[0].status === "fulfilled" ? settled[0].value : [], videos: settled[1].status === "fulfilled" ? settled[1].value : [], warnings });
}

async function lyricDetail(id, res) {
  const match = String(id || "").match(/^lrclib:(\d+)$/);
  if (!match) return json(res, 400, { message: "Resultado de letra inválido." });
  const record = await fetchJson(`https://lrclib.net/api/get/${match[1]}`, { headers: { "Lrclib-Client": "MinisterioSeven-Test/0.1" } });
  if (!record?.plainLyrics) return json(res, 404, { message: "Esta fonte não disponibilizou a letra completa." });
  return json(res, 200, mapLrclibRecord(record, true));
}

async function chordSearch(req, res) {
  const title = clean(req.body?.title, 150);
  const musicId = clean(req.body?.musicId, 160);
  if (!title || !musicId) return json(res, 400, { message: "Selecione uma música cadastrada." });
  const providerUrl = clean(process.env.CHORD_PROVIDER_URL, 500);
  if (providerUrl) {
    const data = await fetchJson(`${providerUrl.replace(/\/$/, "")}/search`, { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.CHORD_PROVIDER_TOKEN ? { Authorization: `Bearer ${process.env.CHORD_PROVIDER_TOKEN}` } : {}) }, body: JSON.stringify({ musicId, title, artist: clean(req.body?.artist, 150) }) });
    return json(res, 200, { results: Array.isArray(data.results) ? data.results : [] });
  }
  const snapshot = await db.collection("authorizedChordSources").where("normalizedTitle", "==", normalize(title)).limit(20).get();
  const results = snapshot.docs.map((doc) => ({ id: `internal:${doc.id}`, ...doc.data(), contentText: undefined })).filter((item) => item.active !== false);
  return json(res, 200, { results, notice: results.length ? "" : "Nenhuma fonte de cifra autorizada foi configurada." });
}

async function chordDetail(id, res) {
  const match = String(id || "").match(/^internal:([A-Za-z0-9_-]{1,200})$/);
  if (!match) return json(res, 400, { message: "Resultado de cifra inválido." });
  const snapshot = await db.doc(`authorizedChordSources/${match[1]}`).get();
  if (!snapshot.exists || snapshot.data().active === false) return json(res, 404, { message: "Cifra não encontrada." });
  const data = snapshot.data();
  return json(res, 200, { id, title: clean(data.title, 150), artist: clean(data.artist, 150), version: clean(data.version, 150), source: clean(data.source, 150), key: clean(data.key, 10), contentText: String(data.contentText || "").slice(0, 300000) });
}

exports.integrationApi = onRequest({ region: "southamerica-east1", timeoutSeconds: 30, memory: "256MiB", maxInstances: 5 }, async (req, res) => {
  const origin = allowedOrigin(req.headers.origin);
  if (origin) res.set("Access-Control-Allow-Origin", origin).set("Vary", "Origin");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type").set("Access-Control-Allow-Methods", "GET, POST, OPTIONS").status(204).send("");
    return;
  }
  try {
    await requireAdmin(req);
    const path = String(req.path || req.url || "").replace(/^\/api/, "").replace(/\?.*$/, "");
    if (req.method === "POST" && path === "/music/search") return await musicSearch(req, res);
    if (req.method === "GET" && path.startsWith("/music/lyrics/")) return await lyricDetail(decodeURIComponent(path.slice(14)), res);
    if (req.method === "POST" && path === "/chords/search") return await chordSearch(req, res);
    if (req.method === "GET" && path.startsWith("/chords/")) return await chordDetail(decodeURIComponent(path.slice(8)), res);
    return json(res, 404, { message: "Rota de integração não encontrada." });
  } catch (error) {
    console.error("Integration API error", error);
    return json(res, Number(error.status) || 500, { message: Number(error.status) >= 500 ? "Não foi possível consultar a fonte agora." : error.message });
  }
});
