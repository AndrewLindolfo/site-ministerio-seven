import test from "node:test";
import assert from "node:assert/strict";
import {
  autoCorrelate,
  centsOff,
  normalizeMetronomeBpm,
  normalizeTimeSignature,
  noteFromPitch,
  NOTE_NAMES
} from "../assets/js/lib/audio-tools.js";

test("identifica a nota Lá 440 Hz", () => {
  const pitch = noteFromPitch(440);
  assert.equal(pitch.midi, 69);
  assert.equal(NOTE_NAMES[pitch.noteIndex], "A");
  assert.equal(pitch.octave, 4);
  assert.equal(centsOff(440, pitch.midi), 0);
});

test("estima frequência de uma onda senoidal", () => {
  const sampleRate = 44100;
  const buffer = Float32Array.from({ length: 2048 }, (_, index) => Math.sin((2 * Math.PI * 440 * index) / sampleRate));
  const frequency = autoCorrelate(buffer, sampleRate);
  assert.ok(Math.abs(frequency - 440) < 2, `Frequência calculada: ${frequency}`);
});

test("limita BPM e compasso aos valores suportados", () => {
  assert.equal(normalizeMetronomeBpm(10), 30);
  assert.equal(normalizeMetronomeBpm(500), 240);
  assert.equal(normalizeMetronomeBpm("inválido"), 72);
  assert.equal(normalizeTimeSignature(6), 6);
  assert.equal(normalizeTimeSignature(1000), 4);
});
