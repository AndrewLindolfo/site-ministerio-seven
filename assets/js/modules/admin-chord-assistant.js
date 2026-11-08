import { getChordResult, processChordPdf, searchChords } from "../services/content-research-service.js";
import { getCifraEditorPlainText, setCifraEditorPlainText } from "../editor.js";
import { prepareChordImport } from "../services/pdf-chord-import-service.js";

const state = { results: [], selected: null, importedFile: null, pdfUrl: "" };

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function setStatus(dialog, message = "", error = false) {
  const target = dialog.querySelector("[data-chord-status]");
  target.textContent = message;
  target.classList.toggle("error", error);
}

function setView(dialog, name) {
  dialog.querySelectorAll("[data-chord-view]").forEach((view) => view.hidden = view.dataset.chordView !== name);
  dialog.querySelector("[data-action='back']").hidden = name === "methods";
  const titles = { methods: "Como deseja adicionar a cifra?", search: "Pesquisar cifra", pdf: "Importar cifra de PDF", preview: "Revisar importação de cifra" };
  dialog.querySelector("[data-dialog-title]").textContent = titles[name] || titles.methods;
}

function selectedMusic(getSelectedMusic) {
  const music = getSelectedMusic?.();
  if (!music?.id) throw new Error("Selecione primeiro a música que receberá a cifra.");
  return music;
}

function resultMeta(item) {
  return [item.artist, item.version, item.key && `Tom ${item.key}`, item.source].filter(Boolean).join(" • ");
}

function setOriginalPreviewVisible(dialog, visible) {
  dialog.querySelector(".chord-preview-view").classList.toggle("without-original", !visible);
  dialog.querySelector("[data-action='process-again']").hidden = !visible;
  if (visible) {
    dialog.querySelectorAll("[data-preview-pane]").forEach((pane) => pane.classList.toggle("is-mobile-active", pane.dataset.previewPane === "original"));
  }
}

function renderResults(dialog, getSelectedMusic) {
  const list = dialog.querySelector("[data-chord-results]");
  list.replaceChildren();
  if (!state.results.length) {
    list.append(el("p", "research-empty", "Nenhuma cifra encontrada. Você pode importar um PDF ou continuar manualmente."));
    return;
  }
  state.results.forEach((item) => {
    const card = el("article", "research-result-card");
    const info = el("div");
    info.append(el("strong", "", item.title || getSelectedMusic()?.title || "Cifra"), el("small", "", resultMeta(item)));
    const actions = el("div", "research-result-actions");
    const preview = el("button", "button-outline", "Visualizar cifra");
    preview.type = "button";
    preview.addEventListener("click", () => previewResult(dialog, item));
    actions.append(preview);
    card.append(info, actions);
    list.append(card);
  });
}

async function previewResult(dialog, item) {
  setStatus(dialog, "Carregando cifra…");
  try {
    const full = item.contentText || item.cifraText ? item : { ...item, ...(await getChordResult(item.id)) };
    const text = String(full.contentText || full.cifraText || "").replace(/\r\n?/g, "\n");
    if (!text.trim()) throw new Error("Este resultado não trouxe conteúdo de cifra.");
    state.selected = full;
    dialog.querySelector("[data-chord-draft]").value = text;
    dialog.querySelector("[data-chord-preview-title]").textContent = full.title || "Prévia da cifra";
    dialog.querySelector("[data-chord-preview-meta]").textContent = resultMeta(full);
    setOriginalPreviewVisible(dialog, false);
    setView(dialog, "preview");
    setStatus(dialog, "Confira acordes, espaços e quebras de linha antes de aplicar.");
  } catch (error) {
    setStatus(dialog, error.message || "Não foi possível abrir esta cifra.", true);
  }
}

async function runSearch(dialog, getSelectedMusic) {
  const button = dialog.querySelector("[data-action='search-chords']");
  button.disabled = true;
  setStatus(dialog, "Pesquisando versões de cifra…");
  try {
    const music = selectedMusic(getSelectedMusic);
    const data = await searchChords({ musicId: music.id, title: music.title, artist: music.subtitle || music.artist || "" });
    state.results = Array.isArray(data.results) ? data.results : (Array.isArray(data.chords) ? data.chords : []);
    renderResults(dialog, getSelectedMusic);
    setStatus(dialog, state.results.length ? "Resultados encontrados. Abra uma cifra para revisar." : (data.notice || "Nenhuma cifra encontrada."));
  } catch (error) {
    setStatus(dialog, error.message || "Não foi possível pesquisar cifras.", true);
  } finally {
    button.disabled = false;
  }
}

function validatePdf(file) {
  if (!file) throw new Error("Escolha um arquivo PDF.");
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("O arquivo escolhido não é um PDF válido.");
  if (!file.size) throw new Error("O arquivo PDF está vazio.");
  if (file.size > 15 * 1024 * 1024) throw new Error("O PDF deve ter no máximo 15 MB.");
  return file;
}

function showFile(dialog, file) {
  dialog.querySelector("[data-pdf-file]").textContent = file ? `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB` : "Nenhum PDF selecionado.";
  dialog.querySelector("[data-action='process-pdf']").disabled = !file;
  if (state.pdfUrl) URL.revokeObjectURL(state.pdfUrl);
  state.pdfUrl = file ? URL.createObjectURL(file) : "";
  dialog.querySelector("[data-pdf-preview]").src = state.pdfUrl || "about:blank";
}

async function runPdfImport(dialog, getSelectedMusic) {
  const button = dialog.querySelector("[data-action='process-pdf']");
  button.disabled = true;
  setStatus(dialog, "Lendo o PDF e reconhecendo a cifra…");
  try {
    const music = selectedMusic(getSelectedMusic);
    const file = validatePdf(state.importedFile);
    const data = await processChordPdf(file, music.id, { onProgress: (message) => setStatus(dialog, message) });
    const prepared = prepareChordImport(data.contentText || data.cifraText || data.text || "", music);
    const text = prepared.contentText.replace(/\r\n?/g, "\n");
    if (!text.trim()) throw new Error("Não foi possível reconhecer texto neste PDF. Tente outro arquivo ou continue manualmente.");
    state.selected = { ...data, ...prepared };
    dialog.querySelector("[data-chord-draft]").value = text;
    dialog.querySelector("[data-chord-preview-title]").textContent = data.title || `Cifra extraída de ${file.name}`;
    const confidence = Number.isFinite(data.ocrConfidence) ? ` • confiança ${data.ocrConfidence}%` : "";
    const warning = data.lowConfidence ? " • baixa confiança: confira cada linha" : "";
    dialog.querySelector("[data-chord-preview-meta]").textContent = data.usedOcr
      ? `Texto reconhecido por OCR${confidence}${warning} • revisão obrigatória`
      : "Texto extraído do PDF • revisão obrigatória";
    setOriginalPreviewVisible(dialog, true);
    setView(dialog, "preview");
    setStatus(dialog, "Extração concluída. Corrija qualquer alinhamento antes de aplicar.");
  } catch (error) {
    setStatus(dialog, error.message || "Não foi possível importar este PDF.", true);
  } finally {
    button.disabled = false;
  }
}

function applyDraft(dialog) {
  const text = dialog.querySelector("[data-chord-draft]").value.replace(/\r\n?/g, "\n");
  if (!text.trim()) return setStatus(dialog, "A cifra está vazia.", true);
  const current = getCifraEditorPlainText().trim();
  if (current && current !== text.trim() && !confirm("A cifra atual será substituída. Deseja continuar?")) return;
  setCifraEditorPlainText(text);
  const key = state.selected?.key || state.selected?.originalKey || "";
  const keyField = document.getElementById("cifra-tom");
  if (keyField && key && [...keyField.options].some((option) => option.value === key)) keyField.value = key;
  const capoField = document.getElementById("cifra-capo");
  if (capoField && !capoField.disabled && state.selected?.capo && !capoField.value.trim()) capoField.value = state.selected.capo;
  const bpmField = document.getElementById("cifra-bpm");
  if (bpmField && !bpmField.disabled && state.selected?.bpm && !bpmField.value.trim()) bpmField.value = state.selected.bpm;
  dialog.close();
  const status = document.getElementById("admin-editor-cifra-status");
  if (status) status.textContent = "Cifra aplicada ao editor. Revise o alinhamento e salve somente quando estiver correta.";
}

function ensureDialog(getSelectedMusic) {
  let dialog = document.getElementById("chord-assistant-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "chord-assistant-dialog";
  dialog.className = "admin-research-dialog";
  dialog.innerHTML = `
    <div class="admin-research-shell">
      <header><div><strong data-dialog-title>Como deseja adicionar a cifra?</strong><small data-selected-music></small></div><button type="button" data-action="close" aria-label="Fechar">×</button></header>
      <main>
        <section data-chord-view="methods" class="chord-methods">
          <button type="button" data-method="search"><strong>Pesquisar cifra</strong><small>Encontre versões, visualize e escolha antes de usar.</small></button>
          <button type="button" data-method="pdf"><strong>Importar PDF</strong><small>Extrai o texto; se o arquivo for imagem, usa OCR no serviço de integração.</small></button>
          <button type="button" data-method="manual"><strong>Digitar ou colar manualmente</strong><small>Fecha esta janela e mantém o editor livre.</small></button>
        </section>
        <section data-chord-view="search" hidden>
          <div class="research-section-heading"><div><h3>Resultados para a música selecionada</h3><p>A busca não salva nem altera o cadastro automaticamente.</p></div><button type="button" class="button-primary" data-action="search-chords">Pesquisar agora</button></div>
          <div class="research-results" data-chord-results></div>
        </section>
        <section data-chord-view="pdf" hidden class="chord-pdf-view">
          <label class="chord-file-picker" data-pdf-drop>Arraste o PDF aqui ou escolha o arquivo<input type="file" accept="application/pdf,.pdf" data-pdf-input></label>
          <p data-pdf-file>Nenhum PDF selecionado.</p>
          <ul><li>Limite de 15 MB.</li><li>PDF com texto é extraído diretamente.</li><li>PDF digitalizado exige OCR e sempre deve ser revisado.</li></ul>
          <button type="button" class="button-primary" data-action="process-pdf" disabled>Processar PDF</button>
        </section>
        <section data-chord-view="preview" hidden class="chord-preview-view">
          <h3 data-chord-preview-title>Prévia da cifra</h3><p data-chord-preview-meta></p>
          <div class="chord-preview-tabs" role="tablist"><button type="button" data-preview-pane-button="original">PDF original</button><button type="button" data-preview-pane-button="converted">Cifra convertida</button></div>
          <div class="chord-compare">
            <section data-preview-pane="original"><strong>PDF original</strong><iframe data-pdf-preview title="PDF original"></iframe></section>
            <section data-preview-pane="converted"><label for="chord-assistant-draft">Cifra convertida - revise e corrija</label><textarea id="chord-assistant-draft" data-chord-draft spellcheck="false"></textarea></section>
          </div>
          <div class="research-result-actions"><button type="button" class="button-outline" data-action="process-again" hidden>Processar novamente</button><button type="button" class="button-primary" data-action="apply-chord">Usar cifra convertida</button></div>
        </section>
      </main>
      <footer><button type="button" data-action="back" hidden>← Voltar</button><p data-chord-status role="status" aria-live="polite"></p><button type="button" data-action="cancel">Cancelar</button></footer>
    </div>`;
  document.body.append(dialog);
  dialog.querySelector("[data-action='close']").addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-action='cancel']").addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-action='back']").addEventListener("click", () => { setView(dialog, "methods"); setStatus(dialog, ""); });
  dialog.querySelector("[data-method='manual']").addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-method='search']").addEventListener("click", () => { setView(dialog, "search"); runSearch(dialog, getSelectedMusic); });
  dialog.querySelector("[data-method='pdf']").addEventListener("click", () => { setView(dialog, "pdf"); setStatus(dialog, ""); });
  dialog.querySelector("[data-action='search-chords']").addEventListener("click", () => runSearch(dialog, getSelectedMusic));
  dialog.querySelector("[data-pdf-input]").addEventListener("change", (event) => {
    try {
      state.importedFile = validatePdf(event.target.files?.[0]);
      showFile(dialog, state.importedFile);
      setStatus(dialog, "Arquivo pronto para processamento.");
    } catch (error) {
      state.importedFile = null;
      event.target.value = "";
      showFile(dialog, null);
      setStatus(dialog, error.message, true);
    }
  });
  const dropZone = dialog.querySelector("[data-pdf-drop]");
  ["dragenter", "dragover"].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.add("is-dragging"); }));
  ["dragleave", "drop"].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.remove("is-dragging"); }));
  dropZone.addEventListener("drop", (event) => {
    try {
      state.importedFile = validatePdf(event.dataTransfer?.files?.[0]);
      showFile(dialog, state.importedFile);
      setStatus(dialog, "Arquivo pronto para processamento.");
    } catch (error) {
      state.importedFile = null;
      showFile(dialog, null);
      setStatus(dialog, error.message, true);
    }
  });
  dialog.querySelectorAll("[data-preview-pane-button]").forEach((button) => button.addEventListener("click", () => {
    const active = button.dataset.previewPaneButton;
    dialog.querySelectorAll("[data-preview-pane]").forEach((pane) => pane.classList.toggle("is-mobile-active", pane.dataset.previewPane === active));
    dialog.querySelectorAll("[data-preview-pane-button]").forEach((item) => item.classList.toggle("is-active", item === button));
  }));
  dialog.querySelector("[data-action='process-pdf']").addEventListener("click", () => runPdfImport(dialog, getSelectedMusic));
  dialog.querySelector("[data-action='process-again']").addEventListener("click", () => {
    setView(dialog, "pdf");
    setStatus(dialog, "Você pode processar o mesmo arquivo novamente ou escolher outro.");
  });
  dialog.querySelector("[data-action='apply-chord']").addEventListener("click", () => applyDraft(dialog));
  return dialog;
}

export function initAdminChordAssistant({ getSelectedMusic } = {}) {
  const trigger = document.getElementById("chord-assistant-open");
  if (!trigger) return;
  trigger.addEventListener("click", () => {
    try {
      const music = selectedMusic(getSelectedMusic);
      const dialog = ensureDialog(getSelectedMusic);
      dialog.querySelector("[data-selected-music]").textContent = `Música: ${music.title || "selecionada"}`;
      setView(dialog, "methods");
      setStatus(dialog, "");
      dialog.showModal();
    } catch (error) {
      const status = document.getElementById("admin-editor-cifra-status");
      if (status) { status.textContent = error.message; status.classList.add("error"); }
    }
  });
}
