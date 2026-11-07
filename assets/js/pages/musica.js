import { getMusicaBySlug, listMusicas } from "../services/musicas-service.js";
import { listCifrasByMusica, getInstrumentLabel, normalizeInstrument } from "../services/cifras-service.js";
import { getQueryParam } from "../utils.js";
import { initMusicaControls } from "../modules/musica-controls.js";
import { createPersonalButtons, refreshPersonalActionButtons } from "../modules/personal-actions.js";
import { sanitizeRichHtml } from "../lib/sanitize-html.js";
import { normalizeYoutubeEmbedUrl } from "../lib/youtube-url.js";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ensurePrevNextNav() {
  return document.querySelector(".prev-next-nav");
}

function renderPrevNext(currentSlug = "", items = []) {
  const nav = ensurePrevNextNav();
  if (!nav || !items.length) return;
  const currentIndex = items.findIndex((item) => String(item.slug || "") === String(currentSlug || ""));
  if (currentIndex === -1) {
    nav.innerHTML = "";
    return;
  }
  const previous = currentIndex > 0 ? items[currentIndex - 1] : null;
  const next = currentIndex < items.length - 1 ? items[currentIndex + 1] : null;
  nav.innerHTML = `
    ${previous ? `<a href="./musica.html?slug=${encodeURIComponent(previous.slug)}" class="prev-link">← Anterior</a>` : `<span class="prev-link is-disabled">← Anterior</span>`}
    <span class="nav-divider"> | </span>
    ${next ? `<a href="./musica.html?slug=${encodeURIComponent(next.slug)}" class="next-link">Próxima →</a>` : `<span class="next-link is-disabled">Próxima →</span>`}
  `;
}

function renderMeta(musica) {
  const meta = document.getElementById("musica-meta");
  if (!meta) return;
  const parts = [];
  if (musica.author) parts.push(`<span class="meta-item">Autor: <strong>${escapeHtml(musica.author)}</strong></span>`);
  if (musica.originalKey) parts.push(`<span class="meta-item">Tom: <strong>${escapeHtml(musica.originalKey)}</strong></span>`);
  if (musica.category) parts.push(`<span class="meta-item">Categoria: <strong>${escapeHtml(musica.category)}</strong></span>`);
  meta.innerHTML = parts.join('<span class="meta-separator" aria-hidden="true"> | </span>');
}

function updatePageMetadata(musica) {
  const title = String(musica?.title || "Música").trim().slice(0, 100);
  const description = String(musica?.subtitle || musica?.author || "Letra de música do Ministério Seven.").trim().slice(0, 160);
  const canonical = new URL("https://ministerioseven.site/musica.html");
  if (musica?.slug) canonical.searchParams.set("slug", musica.slug);
  document.title = `${title} | Ministério Seven`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", `${title} | Ministério Seven`);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:url"]')?.setAttribute("content", canonical.href);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical.href);
}

function renderPersonalActions(musica) {
  const titleEl = document.getElementById("musica-titulo");
  if (!titleEl || !musica?.slug) return;

  let row = document.getElementById("musica-title-row");
  if (!row) {
    row = document.createElement("div");
    row.id = "musica-title-row";
    row.className = "page-title-row";
    titleEl.insertAdjacentElement("beforebegin", row);
    row.appendChild(titleEl);
  }

  let wrap = document.getElementById("musica-title-actions");
  if (!wrap) {
    wrap = document.createElement("span");
    wrap.id = "musica-title-actions";
    wrap.className = "personal-action-group";
    row.appendChild(wrap);
  }

  wrap.innerHTML = createPersonalButtons({
    type: "musica",
    title: musica.title || "",
    href: `./musica.html?slug=${encodeURIComponent(musica.slug)}`,
    slug: musica.slug || ""
  });
  refreshPersonalActionButtons(titleEl.closest(".container") || document);
}

function renderYoutube(url = "") {
  const wrapper = document.getElementById("musica-video-wrapper");
  if (!wrapper) return;
  const embed = normalizeYoutubeEmbedUrl(url);
  if (!embed) {
    wrapper.innerHTML = "";
    wrapper.hidden = true;
    return;
  }
  const iframe = document.createElement("iframe");
  iframe.src = embed;
  iframe.title = "Vídeo da música";
  iframe.loading = "lazy";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  wrapper.hidden = false;
  wrapper.replaceChildren(iframe);
}

function closeCifraSelector(menu) {
  if (menu) menu.classList.add("hidden");
}


function renderVerCifraLink(musica, cifras = []) {
  const link = document.getElementById("ver-cifra-link");
  if (!link) return;

  const parent = link.closest(".page-cross-link") || link.parentElement;
  let menu = document.getElementById("musica-cifra-selector");
  if (!menu && parent) {
    menu = document.createElement("div");
    menu.id = "musica-cifra-selector";
    menu.className = "musica-cifra-selector hidden";
    parent.style.position = parent.style.position || "relative";
    parent.appendChild(menu);
  }

  const active = (cifras || []).filter(Boolean);
  const closeMenu = () => {
    if (menu) menu.classList.add("hidden");
  };

  if (!active.length) {
    link.textContent = "Cifra indisponível";
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
    link.style.pointerEvents = "none";
    closeMenu();
    return;
  }

  const unique = Array.from(
    new Map(
      active.map((item) => [normalizeInstrument(item.instrumento || "violao"), item])
    ).values()
  );

  if (unique.length === 1) {
    const item = unique[0];
    const instrument = normalizeInstrument(item.instrumento || "violao");
    link.textContent = "Ver cifra";
    link.href = `./cifra.html?slug=${encodeURIComponent(item.slug)}&instrumento=${encodeURIComponent(instrument)}`;
    link.removeAttribute("aria-disabled");
    link.style.pointerEvents = "";
    link.onclick = null;
    closeMenu();
    return;
  }

  link.textContent = "Ver cifra";
  link.href = "#";
  link.removeAttribute("aria-disabled");
  link.style.pointerEvents = "";

  if (menu) {
    menu.innerHTML = unique.map((item) => {
      const instrument = normalizeInstrument(item.instrumento || "violao");
      return `<a href="./cifra.html?slug=${encodeURIComponent(item.slug)}&instrumento=${encodeURIComponent(instrument)}" class="musica-cifra-selector-option">${getInstrumentLabel(instrument)}</a>`;
    }).join("");
  }

  link.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!menu) return;
    menu.classList.toggle("hidden");
  };

  if (menu && !menu.dataset.boundSelector) {
    menu.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    document.addEventListener("click", (event) => {
      if (!parent?.contains(event.target)) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
    menu.dataset.boundSelector = "1";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const slug = getQueryParam("slug");
    const musica = await getMusicaBySlug(slug);
    const titleEl = document.getElementById("musica-titulo");
    const subtitleEl = document.getElementById("musica-subtitulo");
    const letraEl = document.getElementById("musica-letra");

    if (!musica) {
      if (titleEl) titleEl.textContent = "Música não encontrada";
      document.querySelector(".page-cross-link")?.setAttribute("hidden", "");
      document.querySelector(".prev-next-nav")?.setAttribute("hidden", "");
      return;
    }

    if (titleEl) titleEl.textContent = musica.title || "Título da música";
    updatePageMetadata(musica);
    if (subtitleEl) {
      subtitleEl.textContent = musica.subtitle || "";
      subtitleEl.hidden = !musica.subtitle;
    }
    renderMeta(musica);
    renderPersonalActions(musica);
    if (letraEl) letraEl.innerHTML = musica.lyricHtml ? sanitizeRichHtml(musica.lyricHtml) : "<p>Letra indisponível.</p>";
    renderYoutube(musica.youtubeUrl || "");

    const [cifras, all] = await Promise.all([
      listCifrasByMusica(musica.id, true),
      listMusicas(true)
    ]);
    renderVerCifraLink(musica, cifras);
    renderPrevNext(musica.slug, all);

    initMusicaControls();
  } catch (error) {
    console.error("Erro ao carregar música pública:", error);
    const titleEl = document.getElementById("musica-titulo");
    if (titleEl) titleEl.textContent = "Erro ao carregar música";
  }
});
