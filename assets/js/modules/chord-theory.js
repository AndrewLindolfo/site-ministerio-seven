import { parseChordSymbol as parseChordSymbolCore } from "./chord-symbol.js";

const NOTE_SEQUENCE_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const FLAT_TO_SHARP = {
  "Db":"C#","Eb":"D#","Gb":"F#","Ab":"G#","Bb":"A#",
  "Cb":"B","Fb":"E"
};

export function normalizeNote(note = "") {
  const raw = String(note || "").trim();
  if (!raw) return "";
  const fixed = raw.charAt(0).toUpperCase() + raw.slice(1);
  return FLAT_TO_SHARP[fixed] || fixed;
}

export function noteIndex(note = "") {
  const normalized = normalizeNote(note);
  return NOTE_SEQUENCE_SHARP.indexOf(normalized);
}

export function transposeNote(note = "", semitones = 0) {
  const idx = noteIndex(note);
  if (idx < 0) return note;
  const next = (idx + semitones % 12 + 12) % 12;
  return NOTE_SEQUENCE_SHARP[next];
}

export function parseChordSymbol(symbol = "") {
  const parsed = parseChordSymbolCore(symbol);
  if (!parsed) return null;

  const raw = parsed.raw;
  const root = normalizeNote(parsed.root);
  const extensionSuffix = parsed.slashParts
    .filter((part) => part.type === "extension")
    .map((part) => `/${part.raw}`)
    .join("");
  const quality = `${parsed.body}${extensionSuffix}`;
  const bass = parsed.bass ? normalizeNote(parsed.bass) : "";

  return {
    raw,
    root,
    quality,
    bass,
    normalized: bass ? `${root}${quality}/${bass}` : `${root}${quality}`
  };
}

export function chordDisplayName(parsed) {
  if (!parsed) return "";
  return parsed.bass
    ? `${parsed.root}${parsed.quality}/${parsed.bass}`
    : `${parsed.root}${parsed.quality}`;
}

function intervalPatternFromQuality(quality = "") {
  const raw = String(quality || "");
  const q = raw.toLowerCase();
  let intervals;

  if (/ø|m7\s*\(?b5\)?/.test(q)) intervals = [0, 3, 6];
  else if (/dim|[°º]/.test(q) || q === "o") intervals = [0, 3, 6];
  else if (q === "aug" || q === "+") intervals = [0, 4, 8];
  else if (/sus2/.test(q)) intervals = [0, 2, 7];
  else if (/sus(?:4)?/.test(q)) intervals = [0, 5, 7];
  else if (/^(?:m|min|mi|-)/.test(q)) intervals = [0, 3, 7];
  else if (q === "5") intervals = [0, 7];
  else intervals = [0, 4, 7];

  const add = (value) => {
    if (!intervals.includes(value)) intervals.push(value);
  };
  if (/7m|maj7|7maj|7\+|Δ7|△7/i.test(raw)) add(11);
  else if (/7/.test(q)) add(10);
  if (/6/.test(q)) add(9);
  if (/9/.test(q)) add(14);
  if (/11/.test(q)) add(17);
  if (/13/.test(q)) add(21);
  if (/ø|m7\s*\(?b5\)?/.test(q)) add(10);

  return intervals.sort((a, b) => a - b);
}

export function buildChordNotes(symbol = "") {
  const parsed = typeof symbol === "string" ? parseChordSymbol(symbol) : symbol;
  if (!parsed) return [];

  const rootIdx = noteIndex(parsed.root);
  if (rootIdx < 0) return [];

  const notes = intervalPatternFromQuality(parsed.quality)
    .map(interval => NOTE_SEQUENCE_SHARP[(rootIdx + interval) % 12]);

  if (parsed.bass) return [parsed.bass, ...notes.filter((note) => note !== parsed.bass)];
  return notes;
}

export function normalizeInstrumentName(instrument = "") {
  const raw = String(instrument || "").trim().toLowerCase();
  if (!raw) return "violao";
  if (["violão","violao"].includes(raw)) return "violao";
  if (raw === "guitarra") return "guitarra";
  if (["baixo","bass"].includes(raw)) return "baixo";
  if (["teclado","keyboard","piano"].includes(raw)) return "teclado";
  return "violao";
}

export function buildKeyboardVariation(symbol = "") {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return null;

  return {
    id: `${parsed.normalized}-keys-1`,
    label: "Principal",
    notes: buildChordNotes(parsed),
    displayName: chordDisplayName(parsed)
  };
}
