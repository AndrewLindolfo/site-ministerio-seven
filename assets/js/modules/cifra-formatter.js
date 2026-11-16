import { analyzeChordText, cleanChordToken, parseChordSymbol, shouldFormatChordToken } from "./chord-symbol.js";

const SHARP_NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const FLAT_NOTES  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
const ENHARMONIC = {
  Cb: "B", "B#": "C", "E#": "F", Fb: "E",
  Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#"
};

export function normalizeNote(note = "") {
  const n = String(note || "").trim();
  return ENHARMONIC[n] || n;
}

export function transposeNote(note = "", steps = 0, preferFlats = false) {
  const original = String(note || "").trim();
  const normalized = normalizeNote(original);

  let idx = SHARP_NOTES.indexOf(normalized);
  if (idx === -1) idx = FLAT_NOTES.indexOf(original);
  if (idx === -1) {
    const match = original.match(/^([A-G])((?:#{1,2}|b{1,2}|[♯♭]|x)?)$/);
    if (match) {
      const naturalIndex = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]];
      const accidental = String(match[2] || "")
        .replaceAll("♯", "#")
        .replaceAll("♭", "b")
        .replaceAll("x", "##");
      idx = naturalIndex + [...accidental].reduce((sum, char) => sum + (char === "#" ? 1 : -1), 0);
    }
  }
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

function transposeChordToken(token = "", steps = 0) {
  const original = String(token || "");
  const parsed = parseChordSymbol(original);
  if (!parsed) return original;

  if (parsed.compoundParts?.length === 2) {
    const [primary, alternate] = parsed.compoundParts;
    const rebuilt = `${transposeChordToken(primary.raw, steps)}(${transposeChordToken(alternate.raw, steps)})`;
    return original.replace(cleanChordToken(original).token, rebuilt);
  }

  const useFlats = /b|♭/.test(parsed.rootRaw)
    || parsed.slashParts.some((part) => part.type === "bass" && /b|♭/.test(part.raw));
  const newRoot = transposeNote(parsed.root, steps, useFlats);
  const slash = parsed.slashParts.map((part) => part.type === "bass"
    ? transposeNote(part.note, steps, useFlats)
    : part.raw);
  const rebuilt = `${newRoot}${parsed.body}${slash.map((part) => `/${part}`).join("")}`;
  const cleaned = cleanChordToken(original).token;
  return original.replace(cleaned, rebuilt);
}

function transposeChordLine(line = "", steps = 0) {
  const analysis = analyzeChordText(line);
  return String(line || "").split(/(\s+)/).map((part) =>
    shouldFormatChordToken(part, analysis) ? transposeChordToken(part, steps) : part
  ).join("");
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
  return lines.map((line) => transposeChordLine(line, steps)).join("\n");
}
