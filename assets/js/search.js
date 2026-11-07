import { $ } from "./utils.js";
import { listMusicas } from "./services/musicas-service.js";
import { listCifras } from "./services/cifras-service.js";
import { listDownloads } from "./services/downloads-service.js";
import { listAlbuns } from "./services/albuns-service.js";
import { listProgramacoes } from "./services/programacoes-service.js";
import { listDownloadsByMusic } from "./services/downloads-music-service.js";
import { normalizeHttpsOrLocalUrl } from "./lib/url-safety.js";

let SEARCH_INDEX = [];
let searchLoaded = false;
let searchLoadPromise = null;
let previousFocus = null;

function normalize(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildSearchText(...parts) {
  return normalize(parts.filter(Boolean).join(" "));
}

function uniqueItems(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item?.type || ""}|${item?.href || ""}|${normalize(item?.label)}`;
    if (!item?.href || !item?.label || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSearchHref(value = "", fallback = "./index.html") {
  return normalizeHttpsOrLocalUrl(value) || normalizeHttpsOrLocalUrl(fallback);
}

function getFulfilled(result) {
  return result?.status === "fulfilled" && Array.isArray(result.value) ? result.value : [];
}

async function loadSearchIndex() {
  if (searchLoaded) return;
  if (searchLoadPromise) return searchLoadPromise;

  searchLoadPromise = (async () => {
    const results = await Promise.allSettled([
      listMusicas(true),
      listCifras(true),
      listDownloads(true),
      listDownloadsByMusic(true),
      listAlbuns(true),
      listProgramacoes(true)
    ]);
    if (results.every((result) => result.status === "rejected")) {
      throw new Error("Nenhuma fonte da busca pôde ser carregada.");
    }
    results.forEach((result) => {
      if (result.status === "rejected") console.warn("Uma fonte da busca não pôde ser carregada:", result.reason);
    });
    const [musicas, cifras, downloads, downloadsMusic, albuns, programacoes] = results.map(getFulfilled);

    const musicaItems = (musicas || []).map((item) => ({
      type: "Música",
      label: item.title || "",
      description: item.subtitle || "",
      href: normalizeSearchHref(item.slug ? `./musica.html?slug=${encodeURIComponent(item.slug)}` : "./musicas.html"),
      searchText: buildSearchText(item.title, item.subtitle)
    }));

    const cifraItems = (cifras || []).map((item) => ({
      type: "Cifra",
      label: item.title || "",
      description: item.subtitle || "",
      href: normalizeSearchHref(item.slug ? `./cifra.html?slug=${encodeURIComponent(item.slug)}` : "./cifras.html"),
      searchText: buildSearchText(item.title, item.subtitle)
    }));

    const downloadItems = (downloads || []).map((item) => ({
      type: "Download",
      label: item.title || "",
      description: item.description || "",
      href: normalizeSearchHref(item.url, "./downloads.html"),
      searchText: buildSearchText(item.title, item.description)
    }));

    const downloadMusicItems = (downloadsMusic || []).map((item) => ({
      type: "Download por música",
      label: item.title || "",
      description: [item.pdfUrl ? "PDF" : "", item.pptUrl ? "PPT" : ""].filter(Boolean).join(" • "),
      href: normalizeSearchHref("./downloads-por-musica.html"),
      searchText: buildSearchText(item.title, "download por musica", item.pdfUrl ? "pdf" : "", item.pptUrl ? "ppt" : "")
    }));

    const albumItems = (albuns || []).map((item) => ({
      type: "Álbum",
      label: item.title || "",
      description: item.description || "",
      href: normalizeSearchHref(item.albumUrl, "./fotos.html"),
      searchText: buildSearchText(item.title, item.description)
    }));

    const programacaoItems = (programacoes || []).map((item) => ({
      type: "Programação",
      label: item.title || "Programação",
      description: [item.description || "", item.location || ""].filter(Boolean).join(" • "),
      href: normalizeSearchHref("./index.html#programacao-section"),
      searchText: buildSearchText(item.title, item.description, item.location)
    }));

    const staticItems = [
      {
        type: "Página",
        label: "Downloads por Música",
        description: "PDF e PowerPoint por música",
        href: normalizeSearchHref("./downloads-por-musica.html"),
        searchText: buildSearchText("Downloads por Música", "PDF", "PPT")
      },
      {
        type: "Ferramenta",
        label: "Ferramentas",
        description: "Afinador e metrônomo",
        href: normalizeSearchHref("./ferramentas.html"),
        searchText: buildSearchText("Ferramentas", "Afinador", "Metrônomo")
      },
      {
        type: "Ferramenta",
        label: "Afinador",
        description: "Afinador cromático",
        href: normalizeSearchHref("./ferramentas.html#tool-card-afinador"),
        searchText: buildSearchText("Afinador", "Ferramentas", "cromático", "Hz")
      },
      {
        type: "Ferramenta",
        label: "Metrônomo",
        description: "Controle de BPM e compasso",
        href: normalizeSearchHref("./ferramentas.html#tool-card-metronomo"),
        searchText: buildSearchText("Metrônomo", "Ferramentas", "BPM", "compasso")
      }
    ];

    SEARCH_INDEX = uniqueItems([
      ...musicaItems,
      ...cifraItems,
      ...downloadItems,
      ...downloadMusicItems,
      ...albumItems,
      ...programacaoItems,
      ...staticItems
    ]);

    searchLoaded = true;
  })().catch((error) => {
    console.error("Erro ao carregar índice da busca:", error);
    SEARCH_INDEX = [];
    throw error;
  }).finally(() => {
    searchLoadPromise = null;
  });
  return searchLoadPromise;
}

export function openSearchModal() {
  const modal = $("#search-modal");
  previousFocus = document.activeElement;
  modal?.classList.remove("hidden");
  modal?.setAttribute("aria-hidden", "false");
  $("#search-input")?.focus();
}

export function closeSearchModal() {
  const modal = $("#search-modal");
  if (!modal || modal.classList.contains("hidden")) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  if (previousFocus instanceof HTMLElement) previousFocus.focus();
  previousFocus = null;
}

function scoreResult(item, term) {
  const label = normalize(item.label);
  const desc = normalize(item.description);
  let score = 0;

  if (label === term) score += 100;
  if (label.startsWith(term)) score += 50;
  if (label.includes(term)) score += 20;
  if (desc.includes(term)) score += 8;

  return score;
}

function renderSearchResults(term = "") {
  const resultsBox = $("#search-results");
  if (!resultsBox) return;

  const normalized = normalize(term);
  resultsBox.replaceChildren();
  if (!normalized) {
    const message = document.createElement("p");
    message.textContent = "Digite para buscar no site.";
    resultsBox.appendChild(message);
    return;
  }

  const filtered = SEARCH_INDEX
    .filter((item) => item.searchText.includes(normalized))
    .map((item) => ({ ...item, score: scoreResult(item, normalized) }))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, 20);

  if (!filtered.length) {
    const message = document.createElement("p");
    message.textContent = "Nenhum resultado encontrado.";
    resultsBox.appendChild(message);
    return;
  }

  filtered.forEach((item) => {
    const link = document.createElement("a");
    const url = new URL(item.href, window.location.origin);
    link.className = "search-result-item";
    link.href = item.href;
    if (url.origin !== window.location.origin) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    const type = document.createElement("strong");
    type.textContent = item.type;
    const label = document.createElement("span");
    label.textContent = item.label;
    link.append(type, label);
    if (item.description) {
      const description = document.createElement("small");
      description.textContent = item.description;
      link.appendChild(description);
    }
    resultsBox.appendChild(link);
  });
}

async function loadAndRender(input) {
  const resultsBox = $("#search-results");
  if (resultsBox && !searchLoaded) resultsBox.textContent = "Carregando busca…";
  try {
    await loadSearchIndex();
    renderSearchResults(input?.value || "");
  } catch {
    if (resultsBox) resultsBox.textContent = "Não foi possível carregar a busca agora.";
  }
}

export function initSearch() {
  const openButton = $("#search-toggle");
  const closeButton = $("#search-modal-close");
  const overlay = $("#search-modal-overlay");
  const input = $("#search-input");
  const panel = document.querySelector(".search-modal-panel");
  const results = $("#search-results");

  panel?.setAttribute("role", "dialog");
  panel?.setAttribute("aria-modal", "true");
  panel?.setAttribute("aria-label", "Busca no site");
  input?.setAttribute("aria-label", "Buscar no site");
  results?.setAttribute("aria-live", "polite");

  openButton?.addEventListener("click", async () => {
    openSearchModal();
    await loadAndRender(input);
  });

  closeButton?.addEventListener("click", closeSearchModal);
  overlay?.addEventListener("click", closeSearchModal);

  input?.addEventListener("input", async (event) => {
    await loadAndRender(event.target);
  });

  document.addEventListener("keydown", async (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearchModal();
      await loadAndRender(input);
    }

    if (event.key === "Escape") {
      closeSearchModal();
    }
  });
}
