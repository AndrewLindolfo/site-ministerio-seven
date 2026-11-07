import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChordNotes,
  normalizeInstrumentName,
  normalizeNote,
  parseChordSymbol,
  transposeNote
} from "../assets/js/modules/chord-theory.js";

test("normaliza acidentes e transpõe notas", () => {
  assert.equal(normalizeNote("Bb"), "A#");
  assert.equal(normalizeNote("cb"), "B");
  assert.equal(transposeNote("B", 1), "C");
  assert.equal(transposeNote("C", -1), "B");
});

test("interpreta acordes simples, alterados e com baixo", () => {
  assert.deepEqual(parseChordSymbol("C#m7/G#"), {
    raw: "C#m7/G#",
    root: "C#",
    quality: "m7",
    bass: "G#",
    normalized: "C#m7/G#"
  });
  assert.equal(parseChordSymbol("H7"), null);
});

test("calcula as notas essenciais dos acordes", () => {
  assert.deepEqual(buildChordNotes("C"), ["C", "E", "G"]);
  assert.deepEqual(buildChordNotes("Am7"), ["A", "C", "E", "G"]);
  assert.deepEqual(buildChordNotes("D/F#"), ["F#", "D", "A"]);
});

test("limita instrumentos às opções suportadas", () => {
  assert.equal(normalizeInstrumentName("Violão"), "violao");
  assert.equal(normalizeInstrumentName("piano"), "teclado");
  assert.equal(normalizeInstrumentName("instrumento-inválido"), "violao");
});
