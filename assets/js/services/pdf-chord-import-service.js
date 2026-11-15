import { analyzeChordText, isChordSymbol, isLikelyChordLine } from "../modules/chord-symbol.js";

const PDF_MAX_PAGES = 24;

export function analyzeChordContent(value = "") {
  const lines = cleanExtractedText(value).split("\n").map((line) => line.trim()).filter(Boolean);
  let chordLines = 0;
  let chordTokens = 0;
  let bracketedChords = 0;

  lines.forEach((line) => {
    const withoutSection = line.replace(/^\[[^\]]{1,50}\]\s*/, "");
    const analysis = analyzeChordText(withoutSection);
    if (isLikelyChordLine(withoutSection)) {
      chordLines += 1;
      chordTokens += analysis.chordCount;
    }
    bracketedChords += [...line.matchAll(/\[([^\]\r\n]+)\]/g)]
      .filter((match) => isChordSymbol(match[1])).length;
  });

  return {
    lineCount: lines.length,
    chordLines,
    chordTokens,
    bracketedChords,
    isLikelyChordSheet: chordTokens >= 2 || bracketedChords >= 2
  };
}

function joinTextItems(items = []) {
  const lines = [];
  const sorted = items
    .filter((item) => String(item.str || "").trim())
    .map((item) => ({
      text: String(item.str || ""),
      x: Number(item.transform?.[4] || 0),
      y: Number(item.transform?.[5] || 0),
      width: Math.max(Number(item.width || 0), 1),
      height: Math.max(Math.abs(Number(item.height || item.transform?.[3] || 10)), 6)
    }))
    .sort((a, b) => Math.abs(b.y - a.y) > Math.max(a.height, b.height) * .45 ? b.y - a.y : a.x - b.x);

  sorted.forEach((item) => {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(candidate.height, item.height) * .45);
    if (!line) {
      line = { y: item.y, height: item.height, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  });

  const orderedLines = lines.sort((a, b) => b.y - a.y);
  if (!orderedLines.length) return "";

  const median = (values = []) => {
    const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!ordered.length) return 0;
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
  };

  // Chord sheets are normally laid out on a character grid. A single page-wide
  // grid is essential: rebuilding every line from column zero moves chords away
  // from the syllables they belong to.
  const allItems = orderedLines.flatMap((line) => line.items);
  const originX = Math.min(...allItems.map((item) => item.x));
  const characterWidths = allItems
    .filter((item) => item.text.trim())
    .map((item) => item.width / Math.max([...item.text].length, 1))
    .filter((width) => width > 1 && width < 30);
  const gridWidth = Math.max(3, median(characterWidths) || 7);

  const verticalGaps = orderedLines
    .slice(0, -1)
    .map((line, index) => line.y - orderedLines[index + 1].y)
    .filter((gap) => gap > 1);
  const lowerGaps = verticalGaps
    .slice()
    .sort((a, b) => a - b)
    .slice(0, Math.max(1, Math.ceil(verticalGaps.length * .5)));
  const regularLineStep = Math.max(6, median(lowerGaps) || median(orderedLines.map((line) => line.height)) || 12);

  const output = [];
  orderedLines.forEach((line, lineIndex) => {
    const row = line.items.sort((a, b) => a.x - b.x);
    let rendered = "";
    let right = originX;

    row.forEach((item, itemIndex) => {
      const targetColumn = Math.max(0, Math.round((item.x - originX) / gridWidth));
      const geometricGap = item.x - right;
      const minimumGap = itemIndex && geometricGap > gridWidth * .35 ? 1 : 0;
      const spaces = Math.max(minimumGap, targetColumn - [...rendered].length);
      if (spaces > 0) rendered += " ".repeat(Math.min(120, spaces));
      rendered += item.text;
      right = Math.max(right, item.x + item.width);
    });

    output.push(rendered.replace(/\s+$/, ""));

    const nextLine = orderedLines[lineIndex + 1];
    if (!nextLine) return;
    const verticalGap = line.y - nextLine.y;
    if (verticalGap > regularLineStep * 1.55) {
      const blankLines = Math.min(2, Math.max(1, Math.round(verticalGap / regularLineStep) - 1));
      output.push(...Array(blankLines).fill(""));
    }
  });

  return output.join("\n");
}

function cleanExtractedText(value = "", { preserveFirstLineIndent = false } = {}) {
  const normalized = String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n");
  return preserveFirstLineIndent
    ? normalized.replace(/^\n+|\n+$/g, "")
    : normalized.trim();
}

function comparable(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function inferCompassoFromBpm(bpm = "", compasso = "") {
  const informedCompasso = String(compasso || "").trim();
  if (informedCompasso) return informedCompasso;
  return String(bpm || "").trim() ? "4/4" : "";
}

export function prepareChordImport(contentText = "", { title = "", subtitle = "" } = {}) {
  const metadata = { originalKey: "", capo: "", bpm: "", compasso: "" };
  const comparableTitle = comparable(title);
  const comparableSubtitle = comparable(subtitle);
  const kept = [];
  cleanExtractedText(contentText).split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    const keyMatch = trimmed.match(/(?:^|[•|])\s*(?:tom(?:\s+original)?|original)\s*(?::|=|-)\s*([A-G](?:#|b)?m?)(?=\s|$|[•|])/i);
    const capoMatch = trimmed.match(/capo(?:traste)?\s*(?::|=|-)\s*([^•|]+)/i);
    const bpmMatch = trimmed.match(/(?:bpm\s*(?::|=|-)?\s*(\d{2,3})|(\d{2,3})\s*bpm)/i);
    const compassoMatch = trimmed.match(/compasso\s*(?::|=|-)?\s*(\d+\s*\/\s*\d+)/i);
    if (keyMatch && !metadata.originalKey) metadata.originalKey = keyMatch[1];
    if (capoMatch && !metadata.capo) metadata.capo = capoMatch[1].trim();
    if (bpmMatch && !metadata.bpm) metadata.bpm = bpmMatch[1] || bpmMatch[2];
    if (compassoMatch && !metadata.compasso) metadata.compasso = compassoMatch[1].replace(/\s+/g, "");
    const isMetadata = keyMatch || capoMatch || bpmMatch || compassoMatch;
    const comparableLine = comparable(trimmed);
    const isSelectedTitle = index < 2 && (
      (comparableTitle && comparableLine === comparableTitle)
      || (comparableTitle && comparableLine && comparableTitle.startsWith(`${comparableLine} `))
      || (comparableTitle && comparableLine && comparableLine.startsWith(`${comparableTitle} `))
      || (comparableSubtitle && comparableLine === comparableSubtitle)
    );
    const isGeneratedFooter = /^Minist[eé]rio Seven\s*[•|-]\s*\d+\s*\/\s*\d+$/i.test(trimmed);
    const isPageNumber = /^(?:p[aá]gina\s+)?\d+\s*(?:\/|de)\s*\d+$/i.test(trimmed);
    if (!isMetadata && !isSelectedTitle && !isGeneratedFooter && !isPageNumber) kept.push(line);
  });
  return { ...metadata, contentText: cleanExtractedText(kept.join("\n")) };
}

async function createOcrWorker(onProgress) {
  const { default: Tesseract } = await import("../../vendor/tesseract/tesseract.esm.min.js");
  return Tesseract.createWorker("por", 1, {
    workerPath: new URL("../../vendor/tesseract/worker.min.js", import.meta.url).href,
    corePath: new URL("../../vendor/tesseract/core", import.meta.url).href,
    langPath: new URL("../../vendor/tesseract/lang", import.meta.url).href,
    gzip: true,
    logger(message) {
      if (message.status === "recognizing text") onProgress?.(`OCR: ${Math.round((message.progress || 0) * 100)}%`);
    }
  });
}

async function recognizePage(page, worker, onProgress, pageNumber, pageCount) {
  onProgress?.(`Reconhecendo página ${pageNumber} de ${pageCount}…`);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport }).promise;
  const result = await worker.recognize(canvas);
  canvas.width = 1;
  canvas.height = 1;
  return {
    text: cleanExtractedText(result.data?.text || ""),
    confidence: Number.isFinite(result.data?.confidence) ? result.data.confidence : null
  };
}

export async function importChordPdfLocally(file, { onProgress } = {}) {
  if (!(file instanceof File)) throw new Error("Escolha um arquivo PDF válido.");
  if (!file.size) throw new Error("O arquivo PDF está vazio.");
  const pdfjs = await import("../../vendor/pdfjs/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("../../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
  onProgress?.("Abrindo PDF…");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const documentTask = pdfjs.getDocument({ data: bytes, useWorkerFetch: false });
  let pdf;
  try {
    pdf = await documentTask.promise;
  } catch {
    throw new Error("O PDF não pôde ser aberto. Ele pode estar corrompido ou protegido por senha.");
  }
  if (!pdf.numPages) {
    await pdf.destroy();
    throw new Error("O PDF não possui páginas para processar.");
  }
  if (pdf.numPages > PDF_MAX_PAGES) {
    await pdf.destroy();
    throw new Error(`O PDF tem ${pdf.numPages} páginas. O limite para importação é ${PDF_MAX_PAGES}.`);
  }

  const pages = [];
  const ocrConfidences = [];
  let worker = null;
  let usedOcr = false;
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress?.(`Lendo página ${pageNumber} de ${pdf.numPages}…`);
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent({ includeMarkedContent: false });
      let pageText = cleanExtractedText(joinTextItems(content.items), { preserveFirstLineIndent: true });
      if (pageText.replace(/\s/g, "").length < 20) {
        worker ||= await createOcrWorker(onProgress);
        const recognized = await recognizePage(page, worker, onProgress, pageNumber, pdf.numPages);
        pageText = recognized.text;
        if (recognized.confidence !== null) ocrConfidences.push(recognized.confidence);
        usedOcr = true;
      }
      pages.push(pageText);
      page.cleanup();
    }
  } finally {
    await worker?.terminate();
    await pdf.destroy();
  }

  const contentText = cleanExtractedText(pages.filter(Boolean).join("\n\n"));
  if (!contentText) throw new Error("Nenhum texto ou cifra reconhecível foi encontrado no PDF.");
  if (!analyzeChordContent(contentText).isLikelyChordSheet) {
    throw new Error("O PDF contém texto, mas não parece ser uma cifra. Escolha um documento com acordes ou continue manualmente.");
  }
  onProgress?.("PDF processado. Revise o resultado.");
  const ocrConfidence = ocrConfidences.length
    ? Math.round(ocrConfidences.reduce((total, value) => total + value, 0) / ocrConfidences.length)
    : null;
  return {
    contentText,
    usedOcr,
    pageCount: pages.length,
    ocrConfidence,
    lowConfidence: ocrConfidence !== null && ocrConfidence < 70
  };
}

export { cleanExtractedText, joinTextItems };
