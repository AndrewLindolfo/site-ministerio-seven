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
