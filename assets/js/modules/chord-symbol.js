const ROOT_REGEX = /^([A-G])((?:#{1,2}|b{1,2}|[♯♭]|x)?)/;
const BASS_REGEX = /^([A-G])((?:#{1,2}|b{1,2}|[♯♭]|x)?)$/;
const WORD_MODIFIER_REGEX = /^(?:major|minor|maj|min|mi|dim|aug|sus|add|alt|omit|no)/i;
const SYMBOL_MODIFIER_REGEX = /^(?:Δ|△|ø|Ø|°|º|o|m|M|\+|-)/;
const ALTERATION_REGEX = /^(?:[#b♯♭](?:13|11|9|7|6|5|4|3|2|1))/;
const NUMBER_REGEX = /^(?:13|11|9|7|6|5|4|3|2|1)/;

function normalizeAccidental(value = "") {
  return String(value || "").replaceAll("♯", "#").replaceAll("♭", "b").replaceAll("x", "##");
}

function hasBalancedParentheses(value = "") {
  let depth = 0;
  for (const char of String(value || "")) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function isWrappedByParentheses(value = "") {
  if (!value.startsWith("(") || !value.endsWith(")")) return false;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "(") depth += 1;
    if (value[index] === ")") depth -= 1;
    if (depth === 0 && index < value.length - 1) return false;
  }
  return depth === 0;
}

export function cleanChordToken(value = "") {
  let token = String(value || "").trim();
  let wrapped = false;

  token = token.replace(/^[|'"`]+/, "").replace(/[|'"`.,;:!?]+$/, "");
  const wrappers = [["[", "]"], ["{", "}"]];
  for (const [open, close] of wrappers) {
    if (token.startsWith(open) && token.endsWith(close)) {
      token = token.slice(1, -1).trim();
      wrapped = true;
    }
  }
  if (isWrappedByParentheses(token)) {
    token = token.slice(1, -1).trim();
    wrapped = true;
  }

  return { token, wrapped };
}

function splitTopLevelSlashes(value = "") {
  const parts = [];
  let depth = 0;
  let start = 0;
  const source = String(value || "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "/" && depth === 0) {
      parts.push(source.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(source.slice(start));
  return parts;
}

function validateModifierSequence(value = "", { allowSlash = false } = {}) {
  let rest = String(value || "").trim();
  if (!rest) return true;
  if (!hasBalancedParentheses(rest)) return false;

  while (rest) {
    const separators = allowSlash ? /^[\s,/]+/ : /^[\s,]+/;
    const separator = rest.match(separators);
    if (separator) {
      rest = rest.slice(separator[0].length);
      continue;
    }
    if (rest[0] === "(") {
      let depth = 0;
      let closing = -1;
      for (let index = 0; index < rest.length; index += 1) {
        if (rest[index] === "(") depth += 1;
        if (rest[index] === ")") depth -= 1;
        if (depth === 0) {
          closing = index;
          break;
        }
      }
      if (closing < 0 || !validateModifierSequence(rest.slice(1, closing), { allowSlash: true })) return false;
      rest = rest.slice(closing + 1);
      continue;
    }

    const match = rest.match(WORD_MODIFIER_REGEX)
      || rest.match(ALTERATION_REGEX)
      || rest.match(NUMBER_REGEX)
      || rest.match(SYMBOL_MODIFIER_REGEX);
    if (!match) return false;
    rest = rest.slice(match[0].length);
  }

  return true;
}

function parseSlashPart(value = "") {
  const raw = String(value || "").trim();
  const bass = raw.match(BASS_REGEX);
  if (bass) {
    return {
      type: "bass",
      raw,
      note: `${bass[1]}${normalizeAccidental(bass[2])}`
    };
  }
  if (/\d/.test(raw) && validateModifierSequence(raw, { allowSlash: false })) {
    return { type: "extension", raw };
  }
  return null;
}

export function parseChordSymbol(value = "") {
  const cleaned = cleanChordToken(value);
  const raw = cleaned.token;
  if (!raw || !hasBalancedParentheses(raw)) return null;

  const slashParts = splitTopLevelSlashes(raw);
  const head = slashParts.shift() || "";
  const rootMatch = head.match(ROOT_REGEX);
  if (!rootMatch) return null;

  const rootRaw = `${rootMatch[1]}${rootMatch[2] || ""}`;
  const body = head.slice(rootMatch[0].length);
  if (!validateModifierSequence(body)) return null;

  const parsedSlashParts = slashParts.map(parseSlashPart);
  if (parsedSlashParts.some((part) => !part)) return null;

  return {
    raw,
    root: `${rootMatch[1]}${normalizeAccidental(rootMatch[2])}`,
    rootRaw,
    body,
    slashParts: parsedSlashParts,
    bass: parsedSlashParts.find((part) => part.type === "bass")?.note || "",
    wrapped: cleaned.wrapped,
    explicit: cleaned.wrapped || Boolean(body) || parsedSlashParts.length > 0,
    strong: cleaned.wrapped
      || Boolean(rootMatch[2])
      || parsedSlashParts.length > 0
      || (Boolean(body) && body !== "m")
  };
}

export function isChordSymbol(value = "") {
  return Boolean(parseChordSymbol(value));
}

export function analyzeChordText(value = "") {
  const tokens = String(value || "").trim().split(/\s+/).filter(Boolean);
  const parsed = tokens.map((token) => parseChordSymbol(token));
  const chordCount = parsed.filter(Boolean).length;
  const explicitCount = parsed.filter((item) => item?.explicit).length;
  const strongCount = parsed.filter((item) => item?.strong).length;
  return {
    tokens,
    parsed,
    tokenCount: tokens.length,
    chordCount,
    explicitCount,
    strongCount,
    chordDensity: tokens.length ? chordCount / tokens.length : 0
  };
}

export function shouldFormatChordToken(value = "", context = null) {
  const parsed = parseChordSymbol(value);
  if (!parsed) return false;
  if (parsed.strong) return true;

  const analysis = context || analyzeChordText(value);
  if (analysis.tokenCount === 1) return true;
  return analysis.chordCount >= 2
    && (analysis.strongCount > 0 || analysis.chordDensity >= 0.5);
}

export function isLikelyChordLine(value = "") {
  const analysis = analyzeChordText(value);
  if (!analysis.chordCount) return false;
  if (analysis.chordCount === analysis.tokenCount) return true;
  return analysis.chordCount >= 2
    && analysis.chordDensity >= 0.5
    && (analysis.explicitCount > 0 || analysis.chordCount >= 3);
}
