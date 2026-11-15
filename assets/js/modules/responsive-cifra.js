import { analyzeChordText, cleanChordToken, isLikelyChordLine, shouldFormatChordToken } from "./chord-symbol.js";

function isSafeBoundary(text, position) {
  if (position <= 0 || position >= text.length) return true;
  return /\s/.test(text[position - 1] || "") || /\s/.test(text[position] || "");
}

function findBreakPosition(chords, lyrics, start, tentativeEnd, totalLength, maxColumns) {
  if (tentativeEnd >= totalLength) return totalLength;
  const earliest = start + Math.max(1, Math.floor(maxColumns * 0.55));

  for (let position = tentativeEnd; position >= earliest; position -= 1) {
    if (isSafeBoundary(lyrics, position) && isSafeBoundary(chords, position)) return position;
  }
  for (let position = tentativeEnd; position >= earliest; position -= 1) {
    if (isSafeBoundary(lyrics, position)) return position;
  }
  for (let position = tentativeEnd; position >= earliest; position -= 1) {
    if (isSafeBoundary(chords, position)) return position;
  }
  return tentativeEnd;
}

export function splitAlignedPair(chords = "", lyrics = "", maxColumns = 40) {
  const chordLine = String(chords || "").replace(/\u00a0/g, " ");
  const lyricLine = String(lyrics || "").replace(/\u00a0/g, " ");
  const columns = Math.max(8, Math.floor(Number(maxColumns) || 40));
  const totalLength = Math.max(chordLine.length, lyricLine.length);
  if (!totalLength) return [{ chords: "", lyrics: "" }];

  const segments = [];
  let start = 0;
  while (start < totalLength) {
    const tentativeEnd = Math.min(start + columns, totalLength);
    const end = findBreakPosition(chordLine, lyricLine, start, tentativeEnd, totalLength, columns);
    segments.push({
      chords: chordLine.slice(start, end).replace(/\s+$/, ""),
      lyrics: lyricLine.slice(start, end).replace(/\s+$/, "")
    });
    start = end;
    while (start < totalLength && /\s/.test(chordLine[start] || "") && /\s/.test(lyricLine[start] || "")) {
      start += 1;
    }
  }
  return segments;
}

function htmlToLines(html = "") {
  const normalized = String(html || "")
    .replace(/\r\n?/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\n/g, "\n");
  return normalized.split("\n");
}

function segmentText(segmentHtml = "") {
  const node = document.createElement("div");
  node.innerHTML = segmentHtml;
  return String(node.textContent || "").replace(/\u00a0/g, " ");
}

function isPlainLyricSegment(segmentHtml = "") {
  const node = document.createElement("div");
  node.innerHTML = segmentHtml;
  return !node.querySelector("*");
}

function createChordLine(text = "") {
  const line = document.createElement("div");
  line.className = "cifra-pair-line cifra-pair-chords";
  const parts = String(text || "").split(/(\s+)/);
  const analysis = analyzeChordText(text);
  parts.forEach((part) => {
    if (part && !/^\s+$/.test(part) && shouldFormatChordToken(part, analysis)) {
      const span = document.createElement("span");
      span.className = "chord-token";
      span.dataset.chordSymbol = cleanChordToken(part).token;
      span.textContent = part;
      line.appendChild(span);
    } else {
      line.appendChild(document.createTextNode(part));
    }
  });
  if (!line.textContent) line.appendChild(document.createTextNode("\u00a0"));
  return line;
}

function createLyricLine(text = "") {
  const line = document.createElement("div");
  line.className = "cifra-pair-line cifra-pair-lyrics";
  line.textContent = text || "\u00a0";
  return line;
}

function availableColumns(content) {
  const style = window.getComputedStyle(content);
  const horizontalPadding = parseFloat(style.paddingLeft || "0") + parseFloat(style.paddingRight || "0");
  const availableWidth = Math.max(1, content.clientWidth - horizontalPadding);
  const probe = document.createElement("span");
  probe.className = "cifra-width-probe";
  probe.textContent = "0".repeat(100);
  content.appendChild(probe);
  const characterWidth = Math.max(1, probe.getBoundingClientRect().width / 100);
  probe.remove();
  return Math.max(8, Math.floor(availableWidth / characterWidth));
}

export function reflowResponsiveCifra(content) {
  if (!content) return;
  const columns = availableColumns(content);
  content.querySelectorAll(".cifra-aligned-pair").forEach((pair) => {
    const chords = pair.dataset.chords || "";
    const lyrics = pair.dataset.lyrics || "";
    const fragment = document.createDocumentFragment();
    splitAlignedPair(chords, lyrics, columns).forEach((segment) => {
      const row = document.createElement("div");
      row.className = "cifra-pair-segment";
      row.append(createChordLine(segment.chords), createLyricLine(segment.lyrics));
      fragment.appendChild(row);
    });
    pair.replaceChildren(fragment);
  });
  content.dataset.responsiveColumns = String(columns);
}

export function prepareResponsiveCifra(content) {
  if (!content) return;
  const sourceHtml = content.innerHTML.includes("<br")
    ? content.innerHTML
    : content.textContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r\n?|\n/g, "<br>");
  const lines = htmlToLines(sourceHtml);
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < lines.length; index += 1) {
    const currentHtml = lines[index];
    const currentText = segmentText(currentHtml);
    const nextHtml = lines[index + 1];
    const nextText = nextHtml === undefined ? "" : segmentText(nextHtml);
    const canPair = isLikelyChordLine(currentText) && nextHtml !== undefined && nextText.trim() &&
      !isLikelyChordLine(nextText) && isPlainLyricSegment(nextHtml);

    if (canPair) {
      const pair = document.createElement("div");
      pair.className = "cifra-aligned-pair";
      pair.dataset.chords = currentText;
      pair.dataset.lyrics = nextText;
      fragment.appendChild(pair);
      index += 1;
      continue;
    }

    const line = document.createElement("div");
    line.className = "cifra-standalone-line";
    line.innerHTML = currentHtml || "&nbsp;";
    fragment.appendChild(line);
  }

  content.replaceChildren(fragment);
  reflowResponsiveCifra(content);
}
