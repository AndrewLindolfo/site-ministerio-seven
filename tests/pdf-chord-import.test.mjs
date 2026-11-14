import test from "node:test";
import assert from "node:assert/strict";
import { analyzeChordContent, cleanExtractedText, joinTextItems, prepareChordImport } from "../assets/js/services/pdf-chord-import-service.js";

test("reconstrói linhas e espaços horizontais extraídos do PDF", () => {
  const text = joinTextItems([
    { str: "G", transform: [1, 0, 0, 12, 10, 100], width: 8, height: 12 },
    { str: "D", transform: [1, 0, 0, 12, 80, 100], width: 8, height: 12 },
    { str: "Porque Ele vive", transform: [1, 0, 0, 12, 18, 80], width: 120, height: 12 }
  ]);

  const [chords, lyric] = text.split("\n");
  assert.match(chords, /^G\s+D$/);
  assert.equal(lyric, " Porque Ele vive");
});

test("preserva recuos relativos e espaços verticais entre blocos do PDF", () => {
  const text = joinTextItems([
    { str: "Bb", transform: [1, 0, 0, 12, 28.35, 679.39], width: 14.4, height: 12 },
    { str: "Eb/G", transform: [1, 0, 0, 12, 165.17, 679.39], width: 28.8, height: 12 },
    { str: "Que", transform: [1, 0, 0, 12, 49.95, 663.76], width: 21.6, height: 12 },
    { str: "o", transform: [1, 0, 0, 12, 78.75, 663.76], width: 7.2, height: 12 },
    { str: "Senhor", transform: [1, 0, 0, 12, 93.16, 663.76], width: 43.21, height: 12 },
    { str: "te", transform: [1, 0, 0, 12, 143.57, 663.76], width: 14.4, height: 12 },
    { str: "abençoe", transform: [1, 0, 0, 12, 201.17, 663.76], width: 50.41, height: 12 },
    { str: "[Refrão]", transform: [1, 0, 0, 12, 28.35, 632.50], width: 57.6, height: 12 }
  ]);

  const lines = text.split("\n");
  assert.equal(lines[0], "Bb                 Eb/G");
  assert.equal(lines[1], "   Que o Senhor te      abençoe");
  assert.equal(lines[2], "");
  assert.equal(lines[3], "[Refrão]");
});

test("normaliza texto reconhecido sem destruir linhas vazias", () => {
  assert.equal(cleanExtractedText("  Intro  \r\n\r\nG   D  \r\n\r\n\r\n\r\nVerso  "), "Intro\n\nG   D\n\n\nVerso");
});

test("preserva o recuo do primeiro acorde de uma nova página", () => {
  assert.equal(cleanExtractedText("      F  \nE os filhos dos teus filhos\n", { preserveFirstLineIndent: true }), "      F\nE os filhos dos teus filhos");
});

test("remove sublinhados decorativos inseridos dentro de palavras", () => {
  assert.equal(cleanExtractedText("Am__ém, amém\nF#m7"), "Amém, amém\nF#m7");
});

test("remove título e paginação do PDF, preservando metadados úteis", () => {
  const result = prepareChordImport("Grande é o Senhor\nTom: A • Capotraste: 2 • BPM: 72\nA      E/G#\nGrande é o Senhor\nMinistério Seven • 1/1", { title: "Grande é o Senhor" });
  assert.equal(result.originalKey, "A");
  assert.equal(result.capo, "2");
  assert.equal(result.bpm, "72");
  assert.equal(result.contentText, "A      E/G#\nGrande é o Senhor");
});

test("distingue uma cifra de um documento comum com texto", () => {
  const chord = analyzeChordContent("[Intro] Gm7  Eb7M  Bb  F4\nBb/F  F  F#º  Gm7\nQue o Senhor te abençoe");
  const document = analyzeChordContent("CERTIFICADO DE CAPELÃO\nDeclaramos para os devidos fins que esta pessoa concluiu o curso.");

  assert.equal(chord.isLikelyChordSheet, true);
  assert.ok(chord.chordTokens >= 2);
  assert.equal(document.isLikelyChordSheet, false);
});

test("remove o título selecionado mesmo com diferença de acentuação", () => {
  const result = prepareChordImport("A BENÇÃO\nTom: Bb • BPM: 150\nBb   Eb/G\nQue o Senhor te abençoe", { title: "A Bênção" });
  assert.equal(result.originalKey, "Bb");
  assert.equal(result.bpm, "150");
  assert.equal(result.contentText, "Bb   Eb/G\nQue o Senhor te abençoe");
});

test("remove o título do documento quando o nome do arquivo também inclui o artista", () => {
  const result = prepareChordImport("A BENÇÃO\nTom: Bb\nBb   Eb/G\nQue o Senhor te abençoe", { title: "A BENÇÃO Gabriel Guedes" });
  assert.equal(result.contentText, "Bb   Eb/G\nQue o Senhor te abençoe");
});
