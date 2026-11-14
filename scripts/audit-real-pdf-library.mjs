import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import * as pdfjs from "../assets/vendor/pdfjs/pdf.min.mjs";
import { analyzeChordContent, joinTextItems, prepareChordImport } from "../assets/js/services/pdf-chord-import-service.js";

const library = process.env.SEVEN_PDF_LIBRARY || "";
if (!library) throw new Error("Defina SEVEN_PDF_LIBRARY com a pasta que contém os PDFs.");

pdfjs.GlobalWorkerOptions.workerSrc = new URL("../assets/vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;

async function listPdfs(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listPdfs(fullPath));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) files.push(fullPath);
  }
  return files;
}

async function inspectPdf(filePath) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await readFile(filePath)), useWorkerFetch: false }).promise;
  const pages = [];
  let pagesNeedingOcr = 0;
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const text = joinTextItems((await page.getTextContent({ includeMarkedContent: false })).items);
      if (text.replace(/\s/g, "").length < 20) pagesNeedingOcr += 1;
      pages.push(text);
      page.cleanup();
    }
    const title = path.basename(filePath, path.extname(filePath)).replace(/^\d+[.)]\s*/, "").trim();
    const prepared = prepareChordImport(pages.join("\n\n"), { title });
    const musical = analyzeChordContent(prepared.contentText);
    return {
      file: path.relative(library, filePath),
      pages: pdf.numPages,
      pagesNeedingOcr,
      contentLength: prepared.contentText.length,
      chordLines: musical.chordLines,
      chordTokens: musical.chordTokens,
      likelyChordSheet: musical.isLikelyChordSheet,
      key: prepared.originalKey,
      bpm: prepared.bpm
    };
  } finally {
    await pdf.destroy();
  }
}

const files = await listPdfs(library);
const results = [];
const failures = [];
for (const [index, filePath] of files.entries()) {
  try {
    results.push(await inspectPdf(filePath));
  } catch (error) {
    failures.push({ file: path.relative(library, filePath), message: error?.message || String(error) });
  }
  if ((index + 1) % 25 === 0) console.error(`Analisados ${index + 1} de ${files.length} PDFs…`);
}

const ocrCandidates = results.filter((item) => item.pagesNeedingOcr > 0 || item.contentLength < 40);
const nonChordCandidates = results.filter((item) => !item.likelyChordSheet);
const summary = {
  total: files.length,
  readable: results.length,
  directText: results.filter((item) => item.pagesNeedingOcr === 0 && item.contentLength >= 40).length,
  ocrCandidates: ocrCandidates.length,
  likelyChordSheets: results.filter((item) => item.likelyChordSheet).length,
  nonChordCandidates: nonChordCandidates.length,
  failures: failures.length,
  totalPages: results.reduce((total, item) => total + item.pages, 0),
  keysDetected: results.filter((item) => item.key).length,
  bpmDetected: results.filter((item) => item.bpm).length
};

console.log(JSON.stringify({ summary, ocrCandidates, nonChordCandidates, failures }, null, 2));
if (failures.length) process.exitCode = 1;
