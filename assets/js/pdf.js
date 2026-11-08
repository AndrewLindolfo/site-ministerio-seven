const JSPDF_SRC = new URL("../vendor/jspdf/jspdf.umd.min.js", import.meta.url).href;
const PAGE = { width: 210, height: 297, margin: 16, bottom: 16 };
let jsPdfPromise = null;

function loadJsPdf() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (jsPdfPromise) return jsPdfPromise;
  jsPdfPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = JSPDF_SRC;
    script.async = true;
    script.onload = () => window.jspdf?.jsPDF
      ? resolve(window.jspdf.jsPDF)
      : reject(new Error("O gerador de PDF não ficou disponível."));
    script.onerror = () => reject(new Error("Não foi possível carregar o gerador de PDF local."));
    document.head.appendChild(script);
  });
  return jsPdfPromise;
}

function text(id, fallback = "") {
  return document.getElementById(id)?.textContent?.trim() || fallback;
}

function fileName(value = "documento") {
  const normalized = String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return `${normalized || "ministerio-seven"}.pdf`;
}

function addPageNumber(doc) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(`Ministério Seven  •  ${page}/${pageCount}`, PAGE.width / 2, PAGE.height - 7, { align: "center" });
  }
}

function ensureSpace(doc, y, required = 8) {
  if (y + required <= PAGE.height - PAGE.bottom) return y;
  doc.addPage();
  return PAGE.margin;
}

function drawHeader(doc, title, subtitle = "", meta = "") {
  let y = PAGE.margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(22, 22, 22);
  const titleLines = doc.splitTextToSize(title, PAGE.width - (PAGE.margin * 2));
  doc.text(titleLines, PAGE.margin, y);
  y += titleLines.length * 7 + 2;
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text(doc.splitTextToSize(subtitle, PAGE.width - (PAGE.margin * 2)), PAGE.margin, y);
    y += 6;
  }
  if (meta) {
    doc.setFontSize(9.5);
    doc.setTextColor(95, 95, 95);
    const metaLines = doc.splitTextToSize(meta.replace(/\s*\|\s*/g, "  •  "), PAGE.width - (PAGE.margin * 2));
    doc.text(metaLines, PAGE.margin, y);
    y += metaLines.length * 4.5 + 3;
  }
  doc.setDrawColor(225, 92, 0);
  doc.setLineWidth(0.7);
  doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
  return y + 8;
}

function drawMusicBody(doc, content, startY) {
  const raw = content?.innerText || content?.textContent || "";
  const paragraphs = raw.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  let y = startY;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  doc.setTextColor(25, 25, 25);
  paragraphs.forEach((paragraph) => {
    const lines = doc.splitTextToSize(paragraph.trimEnd() || " ", PAGE.width - (PAGE.margin * 2));
    lines.forEach((line) => {
      y = ensureSpace(doc, y, 6);
      doc.text(line || " ", PAGE.margin, y);
      y += 5.6;
    });
    y += 3;
  });
}

function splitLongMonospaceLine(line, maxChars) {
  if (line.length <= maxChars) return [line];
  const parts = [];
  for (let index = 0; index < line.length; index += maxChars) parts.push(line.slice(index, index + maxChars));
  return parts;
}

function looksLikeChordLine(line = "") {
  const tokens = String(line).trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  const chord = /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?(?:2|4|5|6|7|9|11|13)?(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?[,;|:]*$/i;
  return tokens.every((token) => chord.test(token));
}

function drawChordBody(doc, content, startY) {
  const raw = (content?.innerText || content?.textContent || "").replace(/\u00a0/g, " ").replace(/\r\n?/g, "\n");
  const sourceLines = raw.split("\n");
  const longest = Math.max(1, ...sourceLines.map((line) => line.length));
  const availablePoints = (PAGE.width - (PAGE.margin * 2)) * 72 / 25.4;
  const fontSize = Math.max(6.5, Math.min(10.5, availablePoints / (longest * 0.6)));
  const maxChars = Math.max(1, Math.floor(availablePoints / (fontSize * 0.6)));
  const lines = sourceLines.flatMap((line) => splitLongMonospaceLine(line, maxChars));
  const lineHeight = fontSize * 0.47;
  let y = startY;
  doc.setFont("courier", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(22, 22, 22);
  lines.forEach((line) => {
    y = ensureSpace(doc, y, lineHeight);
    const chordLine = looksLikeChordLine(line);
    doc.setFont("courier", chordLine ? "bold" : "normal");
    doc.setTextColor(...(chordLine ? [225, 92, 0] : [22, 22, 22]));
    doc.text(line || " ", PAGE.margin, y, { baseline: "top" });
    y += lineHeight;
  });
}

function ensurePreviewDialog() {
  let dialog = document.getElementById("seven-pdf-preview");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "seven-pdf-preview";
  dialog.className = "seven-pdf-preview";
  dialog.setAttribute("aria-labelledby", "seven-pdf-preview-title");
  dialog.innerHTML = `
    <div class="seven-pdf-preview__panel">
      <header><div><strong id="seven-pdf-preview-title">Exportar PDF</strong><small id="seven-pdf-preview-pages"></small></div></header>
      <iframe title="Prévia do documento PDF"></iframe>
      <footer>
        <button type="button" data-action="cancel">Cancelar</button>
        <button type="button" class="button-primary" data-action="download">Baixar PDF</button>
      </footer>
    </div>`;
  const style = document.createElement("style");
  style.textContent = `
    .seven-pdf-preview{width:min(1100px,96vw);height:min(850px,94vh);padding:0;border:1px solid var(--border);border-radius:18px;background:var(--surface);color:var(--text)}
    .seven-pdf-preview::backdrop{background:rgba(0,0,0,.72);backdrop-filter:blur(4px)}
    .seven-pdf-preview__panel{display:grid;grid-template-rows:auto 1fr auto;height:100%}
    .seven-pdf-preview header,.seven-pdf-preview footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px}
    .seven-pdf-preview header{border-bottom:1px solid var(--border)} .seven-pdf-preview footer{justify-content:flex-end;border-top:1px solid var(--border)}
    .seven-pdf-preview header div{display:grid;gap:3px}.seven-pdf-preview small{color:var(--text-soft)}
    .seven-pdf-preview iframe{width:100%;height:100%;border:0;background:#e5e7eb}
    @media(max-width:640px){.seven-pdf-preview{width:100vw;height:100dvh;max-width:none;max-height:none;border-radius:0}}
  `;
  document.head.appendChild(style);
  document.body.appendChild(dialog);
  return dialog;
}

function openPreview(blob, name, pages) {
  const dialog = ensurePreviewDialog();
  const iframe = dialog.querySelector("iframe");
  const pageLabel = dialog.querySelector("#seven-pdf-preview-pages");
  const url = URL.createObjectURL(blob);
  iframe.src = url;
  pageLabel.textContent = `${pages} ${pages === 1 ? "página" : "páginas"}`;
  const close = () => {
    if (dialog.open) dialog.close();
    iframe.removeAttribute("src");
    URL.revokeObjectURL(url);
  };
  dialog.querySelector('[data-action="cancel"]').onclick = close;
  dialog.querySelector('[data-action="download"]').onclick = () => {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
  };
  dialog.oncancel = (event) => { event.preventDefault(); close(); };
  dialog.showModal();
}

async function buildPdf(kind) {
  const JsPdf = await loadJsPdf();
  const doc = new JsPdf({ orientation: "portrait", unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  const isChord = kind === "cifra";
  const title = text(isChord ? "cifra-titulo" : "musica-titulo", isChord ? "Cifra" : "Música");
  const subtitle = text(isChord ? "cifra-subtitulo" : "musica-subtitulo");
  const meta = text(isChord ? "cifra-meta" : "musica-meta");
  const content = document.getElementById(isChord ? "cifra-content" : "musica-letra");
  const startY = drawHeader(doc, title, subtitle, meta);
  if (isChord) drawChordBody(doc, content, startY);
  else drawMusicBody(doc, content, startY);
  addPageNumber(doc);
  return { blob: doc.output("blob"), name: fileName(`${title}-${isChord ? "cifra" : "letra"}`), pages: doc.getNumberOfPages() };
}

async function exportPdf(kind) {
  try {
    const result = await buildPdf(kind);
    openPreview(result.blob, result.name, result.pages);
  } catch (error) {
    console.error("Falha ao gerar PDF:", error);
    alert(`Não foi possível gerar o PDF. ${error?.message || "Tente novamente."}`);
  }
}

export function exportMusicaPdf() {
  return exportPdf("musica");
}

export function exportCifraPdf() {
  return exportPdf("cifra");
}
