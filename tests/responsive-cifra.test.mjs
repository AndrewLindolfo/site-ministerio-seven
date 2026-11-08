import test from "node:test";
import assert from "node:assert/strict";
import { splitAlignedPair } from "../assets/js/modules/responsive-cifra.js";

test("quebra cifra e letra nas mesmas colunas", () => {
  const chords = "C#m          A          E";
  const lyrics = "Agora espero o prêmio que me prometeu";
  const result = splitAlignedPair(chords, lyrics, 22);

  assert.ok(result.length > 1);
  assert.deepEqual(result.flatMap((part) => part.chords.trim().split(/\s+/).filter(Boolean)), ["C#m", "A", "E"]);
  assert.equal(result.map((part) => part.lyrics.trim()).join(" "), lyrics);
  result.forEach((part) => {
    assert.ok(part.chords.length <= 22);
    assert.ok(part.lyrics.length <= 22);
  });
});

test("mantém linha curta em um único bloco", () => {
  assert.deepEqual(splitAlignedPair("C     G", "Linha curta", 40), [
    { chords: "C     G", lyrics: "Linha curta" }
  ]);
});
