import test from "node:test";
import assert from "node:assert/strict";
import { cleanExtractedText, joinTextItems, prepareChordImport } from "../assets/js/services/pdf-chord-import-service.js";

test("reconstrói linhas e espaços horizontais extraídos do PDF", () => {
  const text = joinTextItems([
    { str: "G", transform: [1, 0, 0, 12, 10, 100], width: 8, height: 12 },
    { str: "D", transform: [1, 0, 0, 12, 80, 100], width: 8, height: 12 },
    { str: "Porque Ele vive", transform: [1, 0, 0, 12, 10, 80], width: 100, height: 12 }
  ]);

  const [chords, lyric] = text.split("\n");
  assert.match(chords, /^G\s+D$/);
  assert.equal(lyric, "Porque Ele vive");
});

test("normaliza texto reconhecido sem destruir linhas vazias", () => {
  assert.equal(cleanExtractedText("  Intro  \r\n\r\nG   D  \r\n\r\n\r\n\r\nVerso  "), "Intro\n\nG   D\n\n\nVerso");
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

test("remove o título selecionado mesmo com diferença de acentuação", () => {
  const result = prepareChordImport("A BENÇÃO\nTom: Bb • BPM: 150\nBb   Eb/G\nQue o Senhor te abençoe", { title: "A Bênção" });
  assert.equal(result.originalKey, "Bb");
  assert.equal(result.bpm, "150");
  assert.equal(result.contentText, "Bb   Eb/G\nQue o Senhor te abençoe");
});
