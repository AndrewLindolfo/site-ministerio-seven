import { $ } from "./utils.js";
import { listMusicas } from "./services/musicas-service.js";
import { listCifras } from "./services/cifras-service.js";
import { listDownloads } from "./services/downloads-service.js";
import { listAlbuns } from "./services/albuns-service.js";
import { listProgramacoes } from "./services/programacoes-service.js";
import { listDownloadsByMusic } from "./services/downloads-music-service.js";

let SEARCH_INDEX = [];
let searchLoaded = false;
let searchLoading = false;

function normalize(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildSearchText(...parts) {
  return normalize(parts.filter(Boolean).join(" "));
}

function uniqueByHref(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.href || seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

async function loadSearchIndex() {
  if (searchLoaded || searchLoading) return;
  searchLoading = true;

  try {
    const [musicas, cifras, downloads, downloadsMusic, albuns, programacoes] = await Promise.all([
      listMusicas(true),
      listCifras(true),
      listDownloads(true),
      listDownloadsByMusic(true),
      listAlbuns(true),
      listProgramacoes(true)
    ]);

    const musicaItems = (musicas || []).map((item) => ({
      type: "Música",
      label: item.title || "",
      description: item.subtitle || "",
      href: item.slug ? `./musica.html?slug=${item.slug}` : "./musicas.html",
      searchText: buildSearchText(item.title, item.subtitle)
    }));

    const cifraItems = (cifras || []).map((item) => ({
      type: "Cifra",
      label: item.title || "",
      description: item.subtitle || "",
      href: item.slug ? `./cifra.html?slug=${item.slug}` : "./cifras.html",
      searchText: buildSearchText(item.title, item.subtitle)
    }));

    const downloadItems = (downloads || []).map((item) => ({
      type: "Download",
      label: item.title || "",
      description: item.description || "",
      href: item.url || "./downloads.html",
      searchText: buildSearchText(item.title, item.description)
    }));

    const downloadMusicItems = (downloadsMusic || []).map((item) => ({
      type: "Download por música",
      label: item.title || "",
      description: [item.pdfUrl ? "PDF" : "", item.pptUrl ? "PPT" : ""].filter(Boolean).join(" • "),
      href: "./downloads-por-musica.html",
      searchText: buildSearchText(item.title, "download por musica", item.pdfUrl ? "pdf" : "", item.pptUrl ? "ppt" : "")
    }));

    const albumItems = (albuns || []).map((item) => ({
      type: "Álbum",
      label: item.title || "",
      description: item.description || "",
      href: item.albumUrl || "./fotos.html",
      searchText: buildSearchText(item.title, item.description)
    }));

    const programacaoItems = (programacoes || []).map((item) => ({
      type: "Programação",
      label: item.title || "Programação",
      description: [item.description || "", item.location || ""].filter(Boolean).join(" • "),
      href: "./index.html#programacao-section",
      searchText: buildSearchText(item.title, item.description, item.location)
    }));

    const staticItems = [
      {
        type: "Página",
        label: "Downloads por Música",
        description: "PDF e PowerPoint por música",
        href: "./downloads-por-musica.html",
        searchText: buildSearchText("Downloads por Música", "PDF", "PPT")
      },
      {
        type: "Ferramenta",
        label: "Ferramentas",
        description: "Afinador e metrônomo",
        href: "./ferramentas.html",
        searchText: buildSearchText("Ferramentas", "Afinador", "Metrônomo")
      },
      {
        type: "Página",
        label: "Downloads por Música",
        description: "PDF e PowerPoint por música",
        href: "./downloads-por-musica.html",
        searchText: buildSearchText("Downloads por Música", "PDF", "PPT")
      },
      {
        type: "Ferramenta",
        label: "Afinador",
        description: "Afinador cromático",
        href: "./ferramentas.html#tool-card-afinador",
        searchText: buildSearchText("Afinador", "Ferramentas", "cromático", "Hz")
      },
      {
        type: "Página",
        label: "Downloads por Música",
        description: "PDF e PowerPoint por música",
        href: "./downloads-por-musica.html",
        searchText: buildSearchText("Downloads por Música", "PDF", "PPT")
      },
      {
        type: "Ferramenta",
        label: "Metrônomo",
        description: "Controle de BPM e compasso",
        href: "./ferramentas.html#tool-card-metronomo",
        searchText: buildSearchText("Metrônomo", "Ferramentas", "BPM", "compasso")
      }
    ];

    SEARCH_INDEX = uniqueByHref([
      ...musicaItems,
      ...cifraItems,
      ...downloadItems,
      ...downloadMusicItems,
      ...albumItems,
      ...programacaoItems,
      ...staticItems
    ]);

    searchLoaded = true;
  } catch (error) {
    console.error("Erro ao carregar índice da busca:", error);
    SEARCH_INDEX = [];
  } finally {
    searchLoading = false;
  }
}

export function openSearchModal() {
  $("#search-modal")?.classList.remove("hidden");
  $("#search-input")?.focus();
}

export function closeSearchModal() {
  $("#search-modal")?.classList.add("hidden");
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
  if (!normalized) {
    resultsBox.innerHTML = "<p>Digite para buscar no site.</p>";
    return;
  }

  const filtered = SEARCH_INDEX
    .filter((item) => item.searchText.includes(normalized))
    .map((item) => ({ ...item, score: scoreResult(item, normalized) }))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, 20);

  if (!filtered.length) {
    resultsBox.innerHTML = "<p>Nenhum resultado encontrado.</p>";
    return;
  }

  resultsBox.innerHTML = filtered.map((item) => `
    <a class="search-result-item" href="${item.href}" target="${item.type === "Download" || item.type === "Álbum" ? "_blank" : "_self"}" rel="noopener noreferrer">
      <strong>${escapeHtml(item.type)}</strong><br>
      <span>${escapeHtml(item.label)}</span>
      ${item.description ? `<small style="display:block;opacity:.8;margin-top:4px;">${escapeHtml(item.description)}</small>` : ""}
    </a>
  `).join("");
}

export function initSearch() {
  const openButton = $("#search-toggle");
  const closeButton = $("#search-modal-close");
  const overlay = $("#search-modal-overlay");
  const input = $("#search-input");

  openButton?.addEventListener("click", async () => {
    openSearchModal();
    await loadSearchIndex();
    renderSearchResults(input?.value || "");
  });

  closeButton?.addEventListener("click", closeSearchModal);
  overlay?.addEventListener("click", closeSearchModal);

  input?.addEventListener("input", async (event) => {
    await loadSearchIndex();
    renderSearchResults(event.target.value);
  });

  document.addEventListener("keydown", async (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearchModal();
      await loadSearchIndex();
      renderSearchResults(input?.value || "");
    }

    if (event.key === "Escape") {
      closeSearchModal();
    }
  });
}
