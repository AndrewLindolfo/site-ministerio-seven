const SHARP_NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const FLAT_NOTES  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
const ENHARMONIC = {
  Cb: "B", "B#": "C", "E#": "F", Fb: "E",
  Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#"
};

const CHORD_REGEX = /\b([A-G](?:#|b)?(?:[A-Za-z0-9º+\-]*(?:\([^)]+\))?)?(?:\/[A-G](?:#|b)?)?)\b/g;

const INTRO_LINE_REGEX = /^\s*\[Intro\]\s*$/i;
const INTRO_WITH_CHORDS_REGEX = /^\s*\[Intro\]\s+/i;
const STRICT_CHORD_TOKEN_REGEX = /^[A-G](?:#|b)?(?:(?:maj|min|m|sus|dim|aug|add|mmaj)?(?:2|4|5|6|7|7M|9|11|13)?(?:sus2|sus4|add2|add4|add9|maj7|maj9|maj11|maj13|m7|m9|m11|m13|dim7|aug7|7M)?(?:\([^)]+\))?)?(?:\/[A-G](?:#|b)?)?$/;

export function normalizeNote(note = "") {
  const n = String(note || "").trim();
  return ENHARMONIC[n] || n;
}

export function transposeNote(note = "", steps = 0, preferFlats = false) {
  const original = String(note || "").trim();
  const normalized = normalizeNote(original);

  let idx = SHARP_NOTES.indexOf(normalized);
  if (idx === -1) idx = FLAT_NOTES.indexOf(original);
  if (idx === -1) return original;

  const next = (idx + steps + 1200) % 12;
  return preferFlats ? FLAT_NOTES[next] : SHARP_NOTES[next];
}

function normalizeChordTokenCase(token = "") {
  const raw = String(token || "").trim();
  if (!raw) return raw;

  const match = raw.match(/^([A-Ga-g])([#bBdD]?)(.*)$/);
  if (!match) return raw;

  const root = match[1].toUpperCase();
  const accidental = match[2] === "#" ? "#" : /[bBdD]/.test(match[2] || "") ? "b" : "";
  const suffix = match[3] || "";

  return `${root}${accidental}${suffix}`;
}

function isChordToken(token = "") {
  const t = normalizeChordTokenCase(String(token).trim());
  return STRICT_CHORD_TOKEN_REGEX.test(t);
}

function transposeChordToken(token = "", steps = 0) {
  const normalizedToken = normalizeChordTokenCase(token);

  return String(normalizedToken).replace(
    /\b([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?\b/g,
    (_, root, suffix = "", bass = "") => {
      const useFlats = /b/.test(root) || /b/.test(bass || "");
      const newRoot = transposeNote(root, steps, useFlats);
      const newBass = bass ? transposeNote(bass, steps, useFlats) : "";
      return newBass ? `${newRoot}${suffix}/${newBass}` : `${newRoot}${suffix}`;
    }
  );
}

function cleanToken(token = "") {
  return String(token || "")
    .trim()
    .replace(/^[\[\(\{'"`]+/, "")
    .replace(/[\]\)\}'"`.,;:!?]+$/, "");
}

function isChordOnlyLine(line = "") {
  const tokens = String(line || "")
    .trim()
    .split(/\s+/)
    .map(cleanToken)
    .filter(Boolean);

  if (!tokens.length) return false;
  return tokens.every(isChordToken);
}

function transposeChordLine(line = "", steps = 0) {
  return line.replace(
    CHORD_REGEX,
    (match) => isChordToken(match) ? transposeChordToken(match, steps) : match
  );
}

function transposeBracketedChords(line = "", steps = 0) {
  return String(line || "").replace(/\[([^\]\r\n]+)\]/g, (match, token) => {
    const chord = String(token || "").trim();
    if (!isChordToken(chord)) return match;
    return `[${transposeChordToken(chord, steps)}]`;
  });
}

function hasBracketedChord(line = "") {
  return [...String(line || "").matchAll(/\[([^\]\r\n]+)\]/g)]
    .some((match) => isChordToken(String(match[1] || "").trim()));
}

export function transposeKeyLabel(value = "", steps = 0) {
  const raw = normalizeChordTokenCase(value);
  if (!raw) return raw;

  const match = raw.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) return raw;

  const root = match[1];
  const suffix = match[2] || "";
  const transposedRoot = transposeNote(root, steps, /b/.test(root));
  return `${transposedRoot}${suffix}`;
}

export function transposeText(text = "", steps = 0) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];

  let introBlockRemaining = 0;

  for (const line of lines) {
    const trimmed = String(line || "").trim();
    const lineWithBracketedChords = transposeBracketedChords(line, steps);

    if (INTRO_LINE_REGEX.test(trimmed)) {
      out.push(line);
      introBlockRemaining = 4; // próximas 1-4 linhas de acordes também entram
      continue;
    }

    if (INTRO_WITH_CHORDS_REGEX.test(trimmed)) {
      out.push(transposeChordLine(lineWithBracketedChords, steps));
      introBlockRemaining = 4;
      continue;
    }

    if (hasBracketedChord(line)) {
      out.push(lineWithBracketedChords);
      introBlockRemaining = 0;
      continue;
    }

    if (introBlockRemaining > 0) {
      if (isChordOnlyLine(trimmed)) {
        out.push(transposeChordLine(lineWithBracketedChords, steps));
        introBlockRemaining -= 1;
        continue;
      }

      introBlockRemaining = 0;
    }

    if (isChordOnlyLine(trimmed)) {
      out.push(transposeChordLine(lineWithBracketedChords, steps));
      continue;
    }

    out.push(lineWithBracketedChords);
  }

  return out.join("\n");
}
