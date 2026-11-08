import test from "node:test";
import assert from "node:assert/strict";
import {
  autoCorrelate,
  centsOff,
  medianFrequency,
  normalizeMetronomeBpm,
  normalizeTimeSignature,
  noteFromPitch,
  NOTE_NAMES,
  secondsPerBeat
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

test("encontra a fundamental mesmo com harmônico mais intenso", () => {
  const sampleRate = 44100;
  const fundamental = 220;
  const buffer = Float32Array.from({ length: 4096 }, (_, index) => {
    const time = index / sampleRate;
    return (0.35 * Math.sin(2 * Math.PI * fundamental * time)) +
      (0.65 * Math.sin(2 * Math.PI * fundamental * 2 * time));
  });
  const frequency = autoCorrelate(buffer, sampleRate);
  assert.ok(Math.abs(frequency - fundamental) < 2, `Frequência calculada: ${frequency}`);
});

test("não inventa nota durante silêncio", () => {
  assert.equal(autoCorrelate(new Float32Array(2048), 44100), -1);
});

test("estabiliza leituras de frequência pelo valor mediano", () => {
  assert.equal(medianFrequency([440, 441, 880, 439, 440.5]), 440.5);
  assert.equal(medianFrequency([]), -1);
});

test("limita BPM e compasso aos valores suportados", () => {
  assert.equal(normalizeMetronomeBpm(10), 30);
  assert.equal(normalizeMetronomeBpm(500), 240);
  assert.equal(normalizeMetronomeBpm("inválido"), 72);
  assert.equal(normalizeTimeSignature(6), 6);
  assert.equal(normalizeTimeSignature(1000), 4);
});

test("calcula o intervalo musical pelo BPM normalizado", () => {
  assert.equal(secondsPerBeat(60), 1);
  assert.equal(secondsPerBeat(120), 0.5);
  assert.equal(secondsPerBeat(300), 0.25);
});
