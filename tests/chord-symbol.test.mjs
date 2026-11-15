import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeChordText,
  isChordSymbol,
  isLikelyChordLine,
  parseChordSymbol,
  shouldFormatChordToken
} from "../assets/js/modules/chord-symbol.js";

test("reconhece qualidades, extensões, alterações e inversões usuais", () => {
  const valid = [
    "C", "Cm", "Cmaj7", "C7M", "C7+", "CΔ7", "C5", "C6", "C6/9",
    "C7", "C7/9", "C9", "C11", "C13", "Cadd9", "Csus2", "Csus4",
    "Cdim", "C°", "Cº", "Cø", "Caug", "C+", "Cm7(b5)", "C7(b9)",
    "C7(#5/#9)", "F#m7", "Bb7M(9)", "G/B", "A7/C#", "D♭maj7", "F♯m9"
  ];

  valid.forEach((symbol) => assert.equal(isChordSymbol(symbol), true, symbol));
});

test("rejeita palavras e marcações que não são acordes", () => {
  const invalid = ["Deus", "Quero", "Refrão", "Intro", "Abençoe", "H7", "Cbanana", "7/9"];
  invalid.forEach((symbol) => assert.equal(isChordSymbol(symbol), false, symbol));
});

test("separa extensão numérica de baixo invertido", () => {
  const extension = parseChordSymbol("A7/9");
  const inversion = parseChordSymbol("A7/C#");

  assert.equal(extension.slashParts[0].type, "extension");
  assert.equal(inversion.slashParts[0].type, "bass");
  assert.equal(inversion.bass, "C#");
});

test("um token inválido não bloqueia os acordes válidos da linha", () => {
  const line = "D   A7/9   formato-desconhecido   Em   D#°";
  const analysis = analyzeChordText(line);

  assert.equal(shouldFormatChordToken("D", analysis), true);
  assert.equal(shouldFormatChordToken("A7/9", analysis), true);
  assert.equal(shouldFormatChordToken("formato-desconhecido", analysis), false);
  assert.equal(shouldFormatChordToken("Em", analysis), true);
  assert.equal(shouldFormatChordToken("D#°", analysis), true);
  assert.equal(isLikelyChordLine(line), true);
});

test("não colore a letra A isolada dentro de uma frase", () => {
  const analysis = analyzeChordText("A graça de Deus me alcançou");
  assert.equal(shouldFormatChordToken("A", analysis), false);
  assert.equal(isLikelyChordLine("A graça de Deus me alcançou"), false);
});

test("não confunde a preposição Em com o acorde Mi menor", () => {
  const analysis = analyzeChordText("Em Tuas mãos, em Tuas mãos");
  assert.equal(shouldFormatChordToken("Em", analysis), false);
  assert.equal(isLikelyChordLine("Em Tuas mãos, em Tuas mãos"), false);
});
