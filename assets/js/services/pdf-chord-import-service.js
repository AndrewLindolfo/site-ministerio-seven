const PDF_MAX_PAGES = 24;

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

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const row = line.items.sort((a, b) => a.x - b.x);
      let output = "";
      let right = 0;
      row.forEach((item, index) => {
        const charWidth = item.width / Math.max(item.text.length, 1);
        const gap = index ? item.x - right : 0;
        if (index && gap > charWidth * .45) output += " ".repeat(Math.min(40, Math.max(1, Math.round(gap / Math.max(charWidth, 3)))));
        output += item.text;
        right = item.x + item.width;
      });
      return output.replace(/\s+$/, "");
    })
    .join("\n");
}

function cleanExtractedText(value = "") {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function prepareChordImport(contentText = "", { title = "", subtitle = "" } = {}) {
  const metadata = { originalKey: "", capo: "", bpm: "" };
  const titlePattern = title ? new RegExp(`^${escapeRegExp(title.trim())}$`, "i") : null;
  const subtitlePattern = subtitle ? new RegExp(`^${escapeRegExp(subtitle.trim())}$`, "i") : null;
  const kept = [];
  cleanExtractedText(contentText).split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    const keyMatch = trimmed.match(/(?:^|[•|])\s*(?:tom(?:\s+original)?|original)\s*:\s*([A-G](?:#|b)?m?)(?=\s|$|[•|])/i);
    const capoMatch = trimmed.match(/capo(?:traste)?\s*:\s*([^•|]+)/i);
    const bpmMatch = trimmed.match(/bpm\s*:\s*(\d{2,3})/i);
    if (keyMatch && !metadata.originalKey) metadata.originalKey = keyMatch[1];
    if (capoMatch && !metadata.capo) metadata.capo = capoMatch[1].trim();
    if (bpmMatch && !metadata.bpm) metadata.bpm = bpmMatch[1];
    const isMetadata = keyMatch || capoMatch || bpmMatch;
    const isSelectedTitle = index < 2 && (titlePattern?.test(trimmed) || subtitlePattern?.test(trimmed));
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
  return cleanExtractedText(result.data?.text || "");
}

export async function importChordPdfLocally(file, { onProgress } = {}) {
  if (!(file instanceof File)) throw new Error("Escolha um arquivo PDF válido.");
  const pdfjs = await import("../../vendor/pdfjs/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("../../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
  onProgress?.("Abrindo PDF…");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const documentTask = pdfjs.getDocument({ data: bytes, useWorkerFetch: false });
  const pdf = await documentTask.promise;
  if (pdf.numPages > PDF_MAX_PAGES) {
    await pdf.destroy();
    throw new Error(`O PDF tem ${pdf.numPages} páginas. O limite para importação é ${PDF_MAX_PAGES}.`);
  }

  const pages = [];
  let worker = null;
  let usedOcr = false;
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress?.(`Lendo página ${pageNumber} de ${pdf.numPages}…`);
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent({ includeMarkedContent: false });
      let pageText = cleanExtractedText(joinTextItems(content.items));
      if (pageText.replace(/\s/g, "").length < 20) {
        worker ||= await createOcrWorker(onProgress);
        pageText = await recognizePage(page, worker, onProgress, pageNumber, pdf.numPages);
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
  onProgress?.("PDF processado. Revise o resultado.");
  return { contentText, usedOcr, pageCount: pages.length };
}

export { cleanExtractedText, joinTextItems };
