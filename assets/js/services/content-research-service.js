import { auth } from "../firebase.js";
import { SITE_CONFIG } from "../config.js";
import { importChordPdfLocally } from "./pdf-chord-import-service.js";

const REQUEST_TIMEOUT_MS = 20_000;

function testProvider() {
  if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) return null;
  return window.__SEVEN_TEST_CONTENT_PROVIDER__ || null;
}

async function request(path, options = {}) {
  const provider = testProvider();
  if (provider?.request) return provider.request(path, options);
  const baseUrl = String(SITE_CONFIG.integrationApiUrl || "").replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("A integração de pesquisa ainda não foi conectada ao ambiente de testes.");
  }
  const token = await auth.currentUser?.getIdToken?.();
  if (!token) throw new Error("Entre novamente como administrador para realizar a pesquisa.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || `A pesquisa falhou (${response.status}).`);
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("A pesquisa demorou demais. Tente novamente.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function cleanQuery(value = "", maxLength = 180) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export async function searchMusic({ title = "", artist = "", details = "" } = {}) {
  const payload = {
    title: cleanQuery(title, 150),
    artist: cleanQuery(artist, 150),
    details: cleanQuery(details, 300)
  };
  if (!payload.title) throw new Error("Informe o nome da música.");
  return request("/music/search", { method: "POST", body: JSON.stringify(payload) });
}

export function getLyricResult(id = "") {
  const safeId = encodeURIComponent(cleanQuery(id, 300));
  if (!safeId) throw new Error("Resultado de letra inválido.");
  return request(`/music/lyrics/${safeId}`, { method: "GET" });
}

export async function searchChords({ musicId = "", title = "", artist = "" } = {}) {
  const payload = {
    musicId: cleanQuery(musicId, 160),
    title: cleanQuery(title, 150),
    artist: cleanQuery(artist, 150)
  };
  if (!payload.musicId || !payload.title) throw new Error("Selecione uma música cadastrada antes de pesquisar a cifra.");
  return request("/chords/search", { method: "POST", body: JSON.stringify(payload) });
}

export function getChordResult(id = "") {
  const safeId = encodeURIComponent(cleanQuery(id, 300));
  if (!safeId) throw new Error("Resultado de cifra inválido.");
  return request(`/chords/${safeId}`, { method: "GET" });
}

export function processChordPdf(file, musicId = "", options = {}) {
  if (!(file instanceof File) || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) throw new Error("Escolha um arquivo PDF válido.");
  if (!cleanQuery(musicId, 160)) throw new Error("Selecione uma música cadastrada antes de importar o PDF.");
  return importChordPdfLocally(file, options);
}
