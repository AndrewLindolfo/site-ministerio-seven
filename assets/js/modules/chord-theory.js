/**
 * Infraestrutura base de acordes — teoria e normalização.
 * Não integra automaticamente com a página da cifra nesta etapa.
 */

const NOTE_SEQUENCE_SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const FLAT_TO_SHARP = {
  "Db":"C#","Eb":"D#","Gb":"F#","Ab":"G#","Bb":"A#",
  "Cb":"B","Fb":"E"
};
const SHARP_TO_FLAT = {
  "C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb"
};

const CHORD_REGEX = /^([A-G])([#b]?)([^/]*?)(?:\/([A-G])([#b]?))?$/;

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
  const raw = String(symbol || "").trim();
  const match = raw.match(CHORD_REGEX);
  if (!match) return null;

  const [, rootLetter, accidental, qualityRaw = "", bassLetter = "", bassAccidental = ""] = match;
  const root = normalizeNote(rootLetter + (accidental || ""));
  const quality = qualityRaw || "";
  const bass = bassLetter ? normalizeNote(bassLetter + (bassAccidental || "")) : "";

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
  const q = String(quality || "").toLowerCase();

  if (!q || q === "maj") return [0, 4, 7];
  if (q === "m" || q === "min") return [0, 3, 7];
  if (q === "5") return [0, 7];
  if (q === "dim") return [0, 3, 6];
  if (q === "aug") return [0, 4, 8];
  if (q === "sus2") return [0, 2, 7];
  if (q === "sus4" || q === "sus") return [0, 5, 7];
  if (q === "6") return [0, 4, 7, 9];
  if (q === "m6") return [0, 3, 7, 9];
  if (q === "7") return [0, 4, 7, 10];
  if (q === "maj7" || q === "7m" || q === "7maj" || q === "7m+") return [0, 4, 7, 11];
  if (q === "m7") return [0, 3, 7, 10];
  if (q === "9") return [0, 4, 7, 10, 14];
  if (q === "m9") return [0, 3, 7, 10, 14];
  if (q === "add9") return [0, 4, 7, 14];
  if (q === "madd9") return [0, 3, 7, 14];
  if (q === "11") return [0, 4, 7, 10, 14, 17];
  if (q === "13") return [0, 4, 7, 10, 14, 21];

  // fallback amplo para manter a infraestrutura tolerante
  if (q.includes("m7")) return [0, 3, 7, 10];
  if (q.includes("maj7")) return [0, 4, 7, 11];
  if (q.includes("m")) return [0, 3, 7];
  if (q.includes("sus2")) return [0, 2, 7];
  if (q.includes("sus4") || q.includes("sus")) return [0, 5, 7];
  if (q.includes("add9")) return [0, 4, 7, 14];
  if (q.includes("dim")) return [0, 3, 6];
  if (q.includes("aug")) return [0, 4, 8];
  if (q.includes("7")) return [0, 4, 7, 10];

  return [0, 4, 7];
}

export function buildChordNotes(symbol = "") {
  const parsed = typeof symbol === "string" ? parseChordSymbol(symbol) : symbol;
  if (!parsed) return [];

  const rootIdx = noteIndex(parsed.root);
  if (rootIdx < 0) return [];

  const notes = intervalPatternFromQuality(parsed.quality)
    .map(interval => NOTE_SEQUENCE_SHARP[(rootIdx + interval) % 12]);

  if (parsed.bass && !notes.includes(parsed.bass)) {
    return [parsed.bass, ...notes];
  }
  return notes;
}

export function normalizeInstrumentName(instrument = "") {
  const raw = String(instrument || "").trim().toLowerCase();
  if (!raw) return "violao";
  if (["violão","violao"].includes(raw)) return "violao";
  if (["guitarra"].includes(raw)) return "guitarra";
  if (["baixo","bass"].includes(raw)) return "baixo";
  if (["teclado","keyboard","piano"].includes(raw)) return "teclado";
  return raw;
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

export function buildStringedFallbackVariation(symbol = "", instrument = "violao") {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return null;

  const noteList = buildChordNotes(parsed);
  return {
    id: `${parsed.normalized}-${normalizeInstrumentName(instrument)}-1`,
    label: "Principal",
    displayName: chordDisplayName(parsed),
    root: parsed.root,
    quality: parsed.quality,
    bass: parsed.bass,
    notes: noteList,
    // fallback simples; etapa 2 pode substituir por shapes reais completos
    strings: normalizeInstrumentName(instrument) === "baixo" ? 4 : 6,
    frets: [],
    fingers: [],
    barre: null,
    isFallback: true
  };
}