import { getLyricResult, searchMusic } from "../services/content-research-service.js";
import { getMusicaEditorHtml, setMusicaEditorHtml } from "../editor.js";
import { sanitizeRichHtml } from "../lib/sanitize-html.js";
import { normalizeYoutubeEmbedUrl } from "../lib/youtube-url.js";

const state = { lyrics: [], videos: [], selectedLyric: null, selectedVideo: null, activeTab: "lyrics", preview: null };

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function setStatus(dialog, message = "", error = false) {
  const target = dialog.querySelector("[data-research-status]");
  target.textContent = message;
  target.classList.toggle("error", error);
}

function selectedSummary(dialog) {
  const target = dialog.querySelector("[data-selection-summary]");
  const parts = [];
  if (state.selectedLyric) parts.push(`Letra: ${state.selectedLyric.source || state.selectedLyric.title}`);
  if (state.selectedVideo) parts.push(`Vídeo: ${state.selectedVideo.title}`);
  target.textContent = parts.length ? parts.join(" • ") : "Nenhum conteúdo selecionado.";
  dialog.querySelector("[data-action='apply']").disabled = !parts.length;
}

function activateTab(dialog, name) {
  state.activeTab = name;
  dialog.querySelectorAll("[data-tab]").forEach((button) => {
    const active = button.dataset.tab === name;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  dialog.querySelectorAll("[data-tab-panel]").forEach((panel) => panel.hidden = panel.dataset.tabPanel !== name);
}

function resultMeta(item) {
  return [item.artist, item.version, item.source].filter(Boolean).join(" • ");
}

async function previewLyric(dialog, item) {
  setStatus(dialog, "Carregando letra…");
  try {
    const full = item.contentHtml ? item : { ...item, ...(await getLyricResult(item.id)) };
    state.preview = { type: "lyric", item: full };
    const preview = dialog.querySelector("[data-preview]");
    preview.hidden = false;
    dialog.querySelector("[data-results-view]").hidden = true;
    preview.querySelector("h3").textContent = full.title || "Prévia da letra";
    preview.querySelector("[data-preview-meta]").textContent = resultMeta(full);
    const body = preview.querySelector("[data-preview-body]");
    body.replaceChildren();
    const article = el("article", "research-lyric-preview");
    article.innerHTML = sanitizeRichHtml(full.contentHtml || "");
    body.append(article);
    preview.querySelector("[data-preview-select]").textContent = "Selecionar esta letra";
    setStatus(dialog, "");
  } catch (error) {
    setStatus(dialog, error.message || "Não foi possível abrir a letra.", true);
  }
}

function previewVideo(dialog, item) {
  const embedUrl = normalizeYoutubeEmbedUrl(item.url || item.embedUrl || "");
  if (!embedUrl) return setStatus(dialog, "O endereço deste vídeo não é válido para reprodução.", true);
  state.preview = { type: "video", item };
  const preview = dialog.querySelector("[data-preview]");
  preview.hidden = false;
  dialog.querySelector("[data-results-view]").hidden = true;
  preview.querySelector("h3").textContent = item.title || "Prévia do vídeo";
  preview.querySelector("[data-preview-meta]").textContent = [item.channel, item.platform || "YouTube"].filter(Boolean).join(" • ");
  const body = preview.querySelector("[data-preview-body]");
  body.replaceChildren();
  const iframe = el("iframe", "research-video-player");
  iframe.src = embedUrl;
  iframe.title = item.title || "Vídeo da música";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
  iframe.allowFullscreen = true;
  body.append(iframe);
  preview.querySelector("[data-preview-select]").textContent = "Selecionar este vídeo";
  setStatus(dialog, "");
}

function closePreview(dialog) {
  state.preview = null;
  dialog.querySelector("[data-preview]").hidden = true;
  dialog.querySelector("[data-preview-body]").replaceChildren();
  dialog.querySelector("[data-results-view]").hidden = false;
}

function renderLyrics(dialog) {
  const list = dialog.querySelector("[data-lyrics-list]");
  list.replaceChildren();
  if (!state.lyrics.length) return list.append(el("p", "research-empty", "Nenhuma letra encontrada. O cadastro manual continua disponível."));
  state.lyrics.forEach((item) => {
    const card = el("article", "research-result-card");
    const info = el("div");
    info.append(el("strong", "", item.title || "Música"), el("small", "", resultMeta(item)));
    const actions = el("div", "research-result-actions");
    const view = el("button", "button-outline", "Visualizar letra");
    view.type = "button";
    view.addEventListener("click", () => previewLyric(dialog, item));
    const select = el("button", "button-primary", state.selectedLyric?.id === item.id ? "Selecionada" : "Selecionar");
    select.type = "button";
    select.addEventListener("click", async () => {
      if (!item.contentHtml) {
        await previewLyric(dialog, item);
        setStatus(dialog, "Confira a letra e use “Selecionar esta letra” na prévia.");
        return;
      }
      state.selectedLyric = item;
      renderLyrics(dialog);
      selectedSummary(dialog);
    });
    actions.append(view, select);
    card.append(info, actions);
    list.append(card);
  });
}

function renderVideos(dialog) {
  const list = dialog.querySelector("[data-videos-list]");
  list.replaceChildren();
  if (!state.videos.length) return list.append(el("p", "research-empty", "Nenhum vídeo encontrado. Você poderá informar o link manualmente."));
  state.videos.forEach((item) => {
    const card = el("article", "research-result-card research-video-card");
    if (item.thumbnail) {
      const image = el("img");
      image.src = item.thumbnail;
      image.alt = "";
      image.loading = "lazy";
      card.append(image);
    }
    const info = el("div");
    info.append(el("strong", "", item.title || "Vídeo"), el("small", "", [item.channel, item.platform || "YouTube"].filter(Boolean).join(" • ")));
    const actions = el("div", "research-result-actions");
    const play = el("button", "button-outline", "Reproduzir");
    play.type = "button";
    play.addEventListener("click", () => previewVideo(dialog, item));
    const select = el("button", "button-primary", state.selectedVideo?.id === item.id ? "Selecionado" : "Selecionar");
    select.type = "button";
    select.addEventListener("click", () => { state.selectedVideo = item; renderVideos(dialog); selectedSummary(dialog); });
    actions.append(play, select);
    info.append(actions);
    card.append(info);
    list.append(card);
  });
}

function renderResults(dialog) {
  renderLyrics(dialog);
  renderVideos(dialog);
  dialog.querySelector("[data-results-view]").hidden = false;
  dialog.querySelector("[data-search-view]").hidden = true;
  activateTab(dialog, state.activeTab);
  selectedSummary(dialog);
}

async function runSearch(dialog) {
  if ((state.selectedLyric || state.selectedVideo) && !confirm("Uma nova pesquisa substituirá as seleções atuais. Deseja continuar?")) return;
  const button = dialog.querySelector("[data-action='search']");
  button.disabled = true;
  setStatus(dialog, "Pesquisando letras e vídeos…");
  try {
    const data = await searchMusic({
      title: dialog.querySelector("[name='music-title']").value,
      artist: dialog.querySelector("[name='music-artist']").value,
      details: dialog.querySelector("[name='music-details']").value
    });
    state.lyrics = Array.isArray(data.lyrics) ? data.lyrics : [];
    state.videos = Array.isArray(data.videos) ? data.videos : [];
    state.selectedLyric = null;
    state.selectedVideo = null;
    renderResults(dialog);
    setStatus(dialog, state.lyrics.length || state.videos.length ? "Resultados encontrados. Confira antes de selecionar." : "Nenhum resultado encontrado.");
  } catch (error) {
    setStatus(dialog, error.message || "Não foi possível realizar a pesquisa.", true);
  } finally {
    button.disabled = false;
  }
}

function applySelection(dialog) {
  if (state.selectedLyric) {
    const existing = getMusicaEditorHtml().replace(/<[^>]+>/g, "").trim();
    if (existing && !confirm("A letra atual será substituída pela letra selecionada. Deseja continuar?")) return;
    setMusicaEditorHtml(state.selectedLyric.contentHtml || "");
    const title = document.getElementById("musica-titulo");
    const author = document.getElementById("musica-autor");
    if (title && !title.value.trim()) title.value = state.selectedLyric.title || "";
    if (author && !author.value.trim()) author.value = state.selectedLyric.artist || "";
  }
  if (state.selectedVideo) document.getElementById("musica-youtube").value = state.selectedVideo.url || "";
  dialog.close();
  document.getElementById("admin-editor-musica-status").textContent = "Pesquisa aplicada ao formulário. Revise tudo antes de salvar.";
}

function ensureDialog() {
  let dialog = document.getElementById("music-research-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "music-research-dialog";
  dialog.className = "admin-research-dialog";
  dialog.innerHTML = `
    <div class="admin-research-shell">
      <header><div><strong>Pesquisa de músicas</strong><small>O conteúdo só será cadastrado quando você salvar o formulário.</small></div><button type="button" data-action="close" aria-label="Fechar">×</button></header>
      <main>
        <section data-search-view class="research-search-view">
          <label>Nome da música<input name="music-title" type="search" maxlength="150" required></label>
          <label>Artista ou grupo<input name="music-artist" type="search" maxlength="150"></label>
          <label>Informações adicionais<textarea name="music-details" maxlength="300"></textarea></label>
          <div class="research-form-actions"><button type="button" data-action="clear">Limpar</button><button type="button" class="button-primary" data-action="search">Pesquisar</button></div>
        </section>
        <section data-results-view hidden>
          <div class="research-tabs" role="tablist"><button type="button" role="tab" data-tab="lyrics">Letras</button><button type="button" role="tab" data-tab="videos">Vídeos</button></div>
          <div data-tab-panel="lyrics"><div class="research-results" data-lyrics-list></div></div>
          <div data-tab-panel="videos" hidden><div class="research-results" data-videos-list></div></div>
        </section>
        <section data-preview hidden class="research-preview"><button type="button" data-preview-back>← Voltar aos resultados</button><h3></h3><p data-preview-meta></p><div data-preview-body></div><button type="button" class="button-primary" data-preview-select>Selecionar</button></section>
      </main>
      <footer><div><p data-research-status role="status" aria-live="polite"></p><small data-selection-summary>Nenhum conteúdo selecionado.</small></div><div><button type="button" data-action="new-search">Nova pesquisa</button><button type="button" class="button-primary" data-action="apply" disabled>Usar no formulário</button></div></footer>
    </div>`;
  document.body.append(dialog);
  dialog.querySelector("[data-action='close']").addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-action='clear']").addEventListener("click", () => dialog.querySelectorAll("input,textarea").forEach((field) => field.value = ""));
  dialog.querySelector("[data-action='search']").addEventListener("click", () => runSearch(dialog));
  dialog.querySelector("[data-action='new-search']").addEventListener("click", () => { closePreview(dialog); dialog.querySelector("[data-results-view]").hidden = true; dialog.querySelector("[data-search-view]").hidden = false; });
  dialog.querySelector("[data-action='apply']").addEventListener("click", () => applySelection(dialog));
  dialog.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => activateTab(dialog, button.dataset.tab)));
  dialog.querySelector("[data-preview-back]").addEventListener("click", () => closePreview(dialog));
  dialog.querySelector("[data-preview-select]").addEventListener("click", () => {
    if (!state.preview) return;
    if (state.preview.type === "lyric") state.selectedLyric = state.preview.item;
    else state.selectedVideo = state.preview.item;
    closePreview(dialog);
    renderResults(dialog);
  });
  return dialog;
}

export function initAdminMusicResearch() {
  const trigger = document.getElementById("music-research-open");
  if (!trigger) return;
  trigger.addEventListener("click", () => {
    const dialog = ensureDialog();
    dialog.querySelector("[name='music-title']").value = document.getElementById("musica-titulo")?.value || "";
    dialog.querySelector("[name='music-artist']").value = document.getElementById("musica-autor")?.value || "";
    dialog.showModal();
  });
}
