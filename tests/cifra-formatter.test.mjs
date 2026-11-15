import test from "node:test";
import assert from "node:assert/strict";

import {
  transposeKeyLabel,
  transposeText
} from "../assets/js/modules/cifra-formatter.js";

test("transpõe o tom exibido e acordes em linhas exclusivas", () => {
  assert.equal(transposeKeyLabel("G", 1), "G#");
  assert.equal(transposeText("G C Em D", 1), "G# C# Fm D#");
});

test("transpõe acordes entre colchetes junto da letra", () => {
  assert.equal(
    transposeText("[G] Deus é fiel em todo [C] tempo\n[Em] Sua graça me [D] sustém", 1),
    "[G#] Deus é fiel em todo [C#] tempo\n[Fm] Sua graça me [D#] sustém"
  );
});

test("preserva marcadores que não são acordes", () => {
  assert.equal(transposeText("[Intro]\n[G] Aleluia", 2), "[Intro]\n[A] Aleluia");
  assert.equal(transposeText("Aleluia", 2), "Aleluia");
});

test("transpõe acordes diminutos sem perder o símbolo", () => {
  assert.equal(transposeText("D#° Em F#º", 1), "E° Fm Gº");
});

test("transpõe extensão numérica e baixo sem alterar os modificadores", () => {
  assert.equal(transposeText("A7/9 A7/C# F#m7(b5)", 2), "B7/9 B7/D# G#m7(b5)");
});

test("transpõe acordes válidos mesmo com um token desconhecido na linha", () => {
  assert.equal(transposeText("D A7/9 desconhecido Em", 2), "E B7/9 desconhecido F#m");
});
