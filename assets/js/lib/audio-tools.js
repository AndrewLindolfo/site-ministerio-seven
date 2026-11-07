export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function noteFromPitch(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  const noteNumber = 12 * Math.log2(frequency / 440);
  const midi = Math.round(noteNumber) + 69;
  return {
    midi,
    noteIndex: ((midi % 12) + 12) % 12,
    octave: Math.floor(midi / 12) - 1
  };
}

export function centsOff(frequency, midi) {
  if (!Number.isFinite(frequency) || frequency <= 0 || !Number.isFinite(midi)) return 0;
  const reference = 440 * (2 ** ((midi - 69) / 12));
  return Math.floor(1200 * Math.log2(frequency / reference));
}

export function autoCorrelate(buffer, sampleRate) {
  if (!buffer?.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return -1;
  let rms = 0;
  for (let index = 0; index < buffer.length; index += 1) rms += buffer[index] * buffer[index];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.01) return -1;

  let start = 0;
  let end = buffer.length - 1;
  const threshold = 0.2;
  for (let index = 0; index < buffer.length / 2; index += 1) {
    if (Math.abs(buffer[index]) < threshold) {
      start = index;
      break;
    }
  }
  for (let index = 1; index < buffer.length / 2; index += 1) {
    if (Math.abs(buffer[buffer.length - index]) < threshold) {
      end = buffer.length - index;
      break;
    }
  }

  const sliced = buffer.slice(start, end);
  const size = sliced.length;
  const correlations = new Array(size).fill(0);
  for (let offset = 0; offset < size; offset += 1) {
    for (let index = 0; index < size - offset; index += 1) {
      correlations[offset] += sliced[index] * sliced[index + offset];
    }
  }

  let searchStart = 0;
  while (searchStart + 1 < size && correlations[searchStart] > correlations[searchStart + 1]) searchStart += 1;
  let maxValue = -1;
  let maxPosition = -1;
  for (let index = searchStart; index < size; index += 1) {
    if (correlations[index] > maxValue) {
      maxValue = correlations[index];
      maxPosition = index;
    }
  }
  if (maxPosition <= 0) return -1;

  let period = maxPosition;
  if (period < size - 1) {
    const left = correlations[period - 1];
    const center = correlations[period];
    const right = correlations[period + 1];
    const curve = (left + right - (2 * center)) / 2;
    const slope = (right - left) / 2;
    if (curve) period -= slope / (2 * curve);
  }
  return sampleRate / period;
}

export function normalizeMetronomeBpm(value) {
  const bpm = Number(value);
  return Number.isFinite(bpm) ? Math.max(30, Math.min(240, Math.round(bpm))) : 72;
}

export function normalizeTimeSignature(value) {
  const signature = Number(value);
  return [2, 3, 4, 5, 6, 7, 9, 12].includes(signature) ? signature : 4;
}
