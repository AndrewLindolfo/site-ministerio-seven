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
  if (idx === -1) return original;

  const next = (idx + steps + 1200) % 12;
  return preferFlats ? FLAT_NOTES[next] : SHARP_NOTES[next];
}

function isChordToken(token = "") {
  const t = String(token).trim();
  return /^[A-G](?:#|b)?(?:m|maj|min|sus|dim|aug|add|mmaj)?[0-9º+\-]*(?:\([^)]+\))?(?:\/[A-G](?:#|b)?)?$/.test(t);
}

function transposeChordToken(token = "", steps = 0) {
  return String(token).replace(
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

function isChordLine(line = "") {
  const trimmed = String(line || "").trim();
  if (!trimmed) return false;

  const tokens = trimmed
    .split(/\s+/)
    .map(cleanToken)
    .filter(Boolean);

  if (!tokens.length) return false;

  for (const token of tokens) {
    if (!isChordToken(token)) return false;
  }
  return true;
}

export function transposeText(text = "", steps = 0) {
  return String(text || "")
    .split("\n")
    .map((line) => {
      if (!isChordLine(line)) return line;

      return line.replace(
        /\b([A-G](?:#|b)?(?:m|maj|min|sus|dim|aug|add|mmaj)?[0-9º+\-]*(?:\([^)]+\))?(?:\/[A-G](?:#|b)?)?)\b/g,
        (match) => isChordToken(match) ? transposeChordToken(match, steps) : match
      );
    })
    .join("\n");
}
