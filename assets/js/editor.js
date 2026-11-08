const TINYMCE_BASE_URL = new URL("../vendor/tinymce/js/tinymce", import.meta.url).href;
const TINYMCE_SRC = new URL("../vendor/tinymce/js/tinymce/tinymce.min.js", import.meta.url).href;
const TINYMCE_ICONS_URL = new URL("../vendor/tinymce/js/tinymce/icons/default/icons.min.js", import.meta.url).href;

function loadTinyMCE() {
  return new Promise((resolve, reject) => {
    if (window.tinymce) {
      resolve(window.tinymce);
      return;
    }

    const existing = document.querySelector('script[data-tinymce-loader="true"]');
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.tinymce) resolve(window.tinymce);
        else reject(new Error("TinyMCE carregou, mas não foi inicializado corretamente."));
      }, { once: true });
      existing.addEventListener("error", () => reject(new Error("Não foi possível carregar o arquivo principal do TinyMCE.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = TINYMCE_SRC;
    script.async = true;
    script.dataset.tinymceLoader = "true";
    script.onload = () => {
      if (window.tinymce) resolve(window.tinymce);
      else reject(new Error("TinyMCE não ficou disponível após o carregamento do script."));
    };
    script.onerror = () => reject(new Error(`Não foi possível carregar o TinyMCE local em: ${TINYMCE_SRC}`));
    document.head.appendChild(script);
  });
}

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function normalizeCifraPlainText(raw = "") {
  return String(raw || "")
    .replace(/\u00A0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, "    ");
}

export function plainToCifraHtml(text = "") {
  return normalizeCifraPlainText(text)
    .split("\n")
    .map((line) => escapeHtml(line).replace(/ /g, "&nbsp;"))
    .join("<br>");
}

function htmlToPlainCifra(editor) {
  const body = editor?.getBody?.();
  if (!body) return "";
  return normalizeCifraPlainText(body.innerText || body.textContent || "");
}

export function normalizeRichCifraHtml(html = "") {
  return String(html || "").replace(/\r\n?/g, "\n");
}

function preserveCifraSpacingHtml(rawHtml = "") {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = normalizeRichCifraHtml(rawHtml);

  const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let current;
  while ((current = walker.nextNode())) {
    textNodes.push(current);
  }

  textNodes.forEach((node) => {
    const value = String(node.nodeValue || "")
      .replace(/\t/g, "\u00A0\u00A0\u00A0\u00A0")
      .replace(/ /g, "\u00A0");
    node.nodeValue = value;
  });

  return wrapper.innerHTML;
}

function getCommonTinyOptions() {
  const darkMode = document.documentElement.dataset.theme === "dark";
  return {
    license_key: "gpl",
    base_url: TINYMCE_BASE_URL,
    suffix: ".min",
    skin: darkMode ? "oxide-dark" : "oxide",
    icons: "default",
    icons_url: TINYMCE_ICONS_URL,
    promotion: false,
    branding: false,
    browser_spellcheck: true,
    contextmenu: false,
    convert_urls: false,
    resize: true,
    statusbar: true,
    elementpath: false,
    autosave_interval: "20s",
    autosave_retention: "12h",
    autosave_restore_when_empty: false,
    autosave_ask_before_unload: true,
    font_size_formats: "10px 12px 14px 16px 18px 20px 24px 28px 32px 36px 48px",
    line_height_formats: "1 1.15 1.3 1.5 1.7 2 2.5",
  };
}

function updateEditorState(editorId, message = "Alterações preservadas no editor.", dirty = false) {
  const state = document.querySelector(`[data-editor-state="${editorId}"]`);
  if (!state) return;
  state.textContent = message;
  state.classList.toggle("is-dirty", dirty);
}

function bindEditorState(editor, textarea, editorId) {
  let timer = null;
  const sync = () => {
    updateEditorState(editorId, "Alterações não salvas — rascunho local automático ativo.", true);
    clearTimeout(timer);
    timer = setTimeout(() => {
      editor.plugins?.autosave?.storeDraft?.();
      updateEditorState(editorId, "Rascunho local atualizado.", true);
    }, 900);
  };

  editor.on("change input undo redo paste", sync);
  editor.on("init", () => updateEditorState(editorId, "Editor pronto. Rascunho local automático ativo."));
  textarea?.form?.addEventListener("submit", () => updateEditorState(editorId, "Salvando conteúdo…", true));
}

async function initMusicaEditor() {
  const textarea = document.getElementById("musica-letra");
  if (!textarea || !window.tinymce) return;

  const existing = window.tinymce.get("musica-letra");
  if (existing) existing.remove();

  const initialValue = textarea.dataset.initialValue || textarea.value || "";

  await window.tinymce.init({
    ...getCommonTinyOptions(),
    selector: "#musica-letra",
    min_height: 420,
    menubar: true,
    plugins: "advlist autolink autosave lists link code table fullscreen preview searchreplace visualblocks visualchars wordcount nonbreaking",
    toolbar:
      "undo redo restoredraft | blocks fontsize lineheight | bold italic underline strikethrough | " +
      "forecolor backcolor | alignleft aligncenter alignright alignjustify | outdent indent | " +
      "bullist numlist | link table | removeformat searchreplace | fullscreen preview code",
    toolbar_mode: "sliding",
    forced_root_block: "p",
    remove_trailing_brs: false,
    content_style: `
      body {
        font-family: Arial, sans-serif;
        font-size: 16px;
        line-height: 1.7;
        padding: 16px;
        overflow-wrap: anywhere;
      }
      p {
        margin: 0 0 1em;
        min-height: 1.7em;
      }
      p:last-child {
        margin-bottom: 0;
      }
    `,
    setup(editor) {
      editor.on("init", () => {
        if (initialValue) editor.setContent(initialValue);
      });
      editor.on("change input undo redo", () => {
        textarea.value = editor.getContent();
      });
      bindEditorState(editor, textarea, "musica-letra");
    }
  });
}

async function initCifraEditor() {
  const textarea = document.getElementById("cifra-conteudo");
  if (!textarea || !window.tinymce) return;

  const existing = window.tinymce.get("cifra-conteudo");
  if (existing) existing.remove();

  const initialValue = textarea.dataset.initialValue || textarea.value || "";

  await window.tinymce.init({
    ...getCommonTinyOptions(),
    selector: "#cifra-conteudo",
    min_height: 480,
    menubar: true,
    newline_behavior: "linebreak",
    paste_as_text: false,
    entity_encoding: "named",
    verify_html: false,
    plugins: "autosave code fullscreen preview searchreplace visualblocks visualchars nonbreaking wordcount",
    toolbar:
      "undo redo restoredraft | bold italic underline strikethrough | forecolor backcolor | " +
      "removeformat searchreplace | visualchars | fullscreen preview code",
    toolbar_mode: "sliding",
    remove_trailing_brs: false,
    content_style: `
      body {
        font-family: "Courier New", Courier, monospace;
        font-size: 16px;
        line-height: 1.45;
        white-space: break-spaces;
        overflow-wrap: normal;
        word-break: normal;
        tab-size: 4;
        -moz-tab-size: 4;
        padding: 16px;
      }
      pre, p, div, span {
        font-family: "Courier New", Courier, monospace !important;
        white-space: break-spaces !important;
        margin: 0 !important;
      }
    `,
    setup(editor) {
      editor.on("init", () => {
        if (initialValue) editor.setContent(initialValue);
      });

      const syncTextarea = () => {
        textarea.value = preserveCifraSpacingHtml(editor.getContent({ format: "raw" }));
      };

      editor.on("change input undo redo keyup paste SetContent", syncTextarea);
      editor.on("init", syncTextarea);
      bindEditorState(editor, textarea, "cifra-conteudo");
    }
  });
}

export function setCifraEditorPlainText(text = "") {
  const normalized = normalizeCifraPlainText(text);
  const html = plainToCifraHtml(normalized);
  const textarea = document.getElementById("cifra-conteudo");
  if (textarea) {
    textarea.value = html;
    textarea.dataset.initialValue = html;
  }

  const editor = window.tinymce?.get("cifra-conteudo");
  if (editor) {
    editor.setContent(html);
  }
}

export function setMusicaEditorHtml(html = "") {
  const value = String(html || "");
  const textarea = document.getElementById("musica-letra");
  if (textarea) {
    textarea.value = value;
    textarea.dataset.initialValue = value;
  }
  const editor = window.tinymce?.get("musica-letra");
  if (editor) editor.setContent(value);
}

export function getMusicaEditorHtml() {
  const editor = window.tinymce?.get("musica-letra");
  return editor ? editor.getContent() : (document.getElementById("musica-letra")?.value || "");
}

export function setCifraEditorHtml(html = "") {
  const normalized = preserveCifraSpacingHtml(html);
  const textarea = document.getElementById("cifra-conteudo");
  if (textarea) {
    textarea.value = normalized;
    textarea.dataset.initialValue = normalized;
  }

  const editor = window.tinymce?.get("cifra-conteudo");
  if (editor) {
    editor.setContent(normalized);
  }
}

export function getCifraEditorPlainText() {
  const editor = window.tinymce?.get("cifra-conteudo");
  if (editor) return htmlToPlainCifra(editor);
  const textarea = document.getElementById("cifra-conteudo");
  const tmp = document.createElement("div");
  tmp.innerHTML = textarea?.value || "";
  return normalizeCifraPlainText(tmp.innerText || tmp.textContent || textarea?.value || "");
}

export function getCifraEditorHtml() {
  const editor = window.tinymce?.get("cifra-conteudo");
  if (editor) return preserveCifraSpacingHtml(editor.getContent({ format: "raw" }));
  return preserveCifraSpacingHtml(document.getElementById("cifra-conteudo")?.value || "");
}

export async function initSevenEditors() {
  await loadTinyMCE();

  if (document.getElementById("musica-letra")) {
    await initMusicaEditor();
  }

  if (document.getElementById("cifra-conteudo")) {
    await initCifraEditor();
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await initSevenEditors();
    } catch (error) {
      console.error("Falha ao iniciar o TinyMCE:", error);
      alert(`Erro ao carregar o editor TinyMCE local.\n\nDetalhe: ${error?.message || error}`);
    }
  });
}
