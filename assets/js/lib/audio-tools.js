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
  const size = buffer.length;
  let rms = 0;
  let mean = 0;
  for (let index = 0; index < size; index += 1) mean += buffer[index];
  mean /= size;
  for (let index = 0; index < size; index += 1) {
    const centered = buffer[index] - mean;
    rms += centered * centered;
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return -1;

  const minFrequency = 55;
  const maxFrequency = 1400;
  const minLag = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const maxLag = Math.min(Math.floor(size / 2), Math.ceil(sampleRate / minFrequency));
  const difference = new Float64Array(maxLag + 1);
  const normalized = new Float64Array(maxLag + 1);

  for (let lag = 1; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let index = 0; index < size - lag; index += 1) {
      const delta = (buffer[index] - mean) - (buffer[index + lag] - mean);
      sum += delta * delta;
    }
    difference[lag] = sum;
  }

  normalized[0] = 1;
  let runningSum = 0;
  for (let lag = 1; lag <= maxLag; lag += 1) {
    runningSum += difference[lag];
    normalized[lag] = runningSum ? (difference[lag] * lag) / runningSum : 1;
  }

  let bestLag = -1;
  let bestScore = 1;
  for (let lag = minLag; lag < maxLag; lag += 1) {
    const score = normalized[lag];
    const localMinimum = score <= normalized[lag - 1] && score < normalized[lag + 1];
    if (localMinimum && score < 0.15) {
      bestScore = score;
      bestLag = lag;
      break;
    }
    if (localMinimum && score < bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (bestLag < 0 || bestScore > 0.35) return -1;

  let period = bestLag;
  const left = normalized[bestLag - 1];
  const center = normalized[bestLag];
  const right = normalized[bestLag + 1];
  const denominator = left - (2 * center) + right;
  if (denominator) {
    period += 0.5 * (left - right) / denominator;
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

export function secondsPerBeat(bpm) {
  return 60 / normalizeMetronomeBpm(bpm);
}

export function medianFrequency(values = []) {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!sorted.length) return -1;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
