
import {
  buildChordNotes,
  buildKeyboardVariation,
  normalizeInstrumentName,
  parseChordSymbol
} from "./chord-theory.js";

const STRINGED_SHAPES = {
  violao: {
    "A": [
      { label: "Aberta", positions: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
      { label: "Pestana", positions: [5, 7, 7, 6, 5, 5], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 5, fromString: 1, toString: 6 } }
    ],
    "Am": [
      { label: "Aberta", positions: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
      { label: "Pestana", positions: [5, 7, 7, 5, 5, 5], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 5, fromString: 1, toString: 6 } }
    ],
    "B": [
      { label: "Pestana", positions: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 3, 4, 4, 1], barre: { fret: 2, fromString: 2, toString: 6 } },
      { label: "Forma E", positions: [7, 9, 9, 8, 7, 7], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 7, fromString: 1, toString: 6 } }
    ],
    "Bm": [
      { label: "Pestana", positions: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 2, fromString: 2, toString: 6 } },
      { label: "Forma Am", positions: [7, 9, 9, 7, 7, 7], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 7, fromString: 1, toString: 6 } }
    ],
    "C": [
      { label: "Aberta", positions: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
      { label: "Pestana", positions: [8, 10, 10, 9, 8, 8], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 8, fromString: 1, toString: 6 } }
    ],
    "Cm": [
      { label: "Pestana", positions: [3, 5, 5, 4, 3, 3], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 3, fromString: 1, toString: 6 } }
    ],
    "C#": [
      { label: "Pestana", positions: [-1, 4, 6, 6, 6, 4], fingers: [0, 1, 3, 4, 4, 1], barre: { fret: 4, fromString: 2, toString: 6 } }
    ],
    "C#m": [
      { label: "Pestana", positions: [-1, 4, 6, 6, 5, 4], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 4, fromString: 2, toString: 6 } },
      { label: "Forma Am", positions: [9, 11, 11, 9, 9, 9], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 9, fromString: 1, toString: 6 } }
    ],
    "D": [
      { label: "Aberta", positions: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] }
    ],
    "Dm": [
      { label: "Aberta", positions: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] }
    ],
    "E": [
      { label: "Aberta", positions: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
      { label: "Pestana", positions: [12, 14, 14, 13, 12, 12], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 12, fromString: 1, toString: 6 } }
    ],
    "Em": [
      { label: "Aberta", positions: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] }
    ],
    "F": [
      { label: "Pestana", positions: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, fromString: 1, toString: 6 } }
    ],
    "F#m": [
      { label: "Pestana", positions: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 2, fromString: 1, toString: 6 } }
    ],
    "G": [
      { label: "Aberta", positions: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
      { label: "Forma E", positions: [3, 5, 5, 4, 3, 3], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 3, fromString: 1, toString: 6 } }
    ],
    "G#m": [
      { label: "Pestana", positions: [4, 6, 6, 4, 4, 4], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 4, fromString: 1, toString: 6 } }
    ]
  },
  guitarra: {},
  baixo: {
    "A": [
      { label: "Principal", strings: 4, positions: [5, 7, 7, 6], fingers: [1, 3, 4, 2] },
      { label: "Forma 2", strings: 4, positions: [0, 0, 2, 2], fingers: [0, 0, 1, 2] }
    ],
    "C#m": [
      { label: "Principal", strings: 4, positions: [9, 11, 11, 9], fingers: [1, 3, 4, 1], barre: { fret: 9, fromString: 1, toString: 4 } }
    ],
    "E": [
      { label: "Principal", strings: 4, positions: [0, 2, 2, 1], fingers: [0, 2, 3, 1] },
      { label: "Forma 2", strings: 4, positions: [7, 9, 9, 9], fingers: [1, 3, 4, 4] }
    ],
    "B": [
      { label: "Principal", strings: 4, positions: [2, 4, 4, 4], fingers: [1, 2, 3, 4] }
    ]
  }
};

STRINGED_SHAPES.guitarra = JSON.parse(JSON.stringify(STRINGED_SHAPES.violao));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function el(tag, className = "", html = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

function normalizeShape(shape, instrument) {
  const strings = shape.strings || (instrument === "baixo" ? 4 : 6);
  const positions = (shape.positions || []).slice();
  while (positions.length < strings) positions.unshift(-1);
  const fingers = (shape.fingers || []).slice();
  while (fingers.length < strings) fingers.unshift(0);
  const nonZero = positions.filter(v => v > 0);
  const minPositive = nonZero.length ? Math.min(...nonZero) : 1;
  const maxPositive = nonZero.length ? Math.max(...nonZero) : 4;
  const baseFret = shape.baseFret || (maxPositive <= 4 ? 1 : minPositive);
  return { ...shape, strings, positions, fingers, baseFret, visibleFrets: 5 };
}

export function createChordViewerShell() {
  const root = el("div", "chord-viewer");
  root.innerHTML = `
    <div class="chord-viewer__header">
      <strong class="chord-viewer__title">Acorde</strong>
      <div class="chord-viewer__nav">
        <button type="button" class="chord-viewer__prev" aria-label="Variação anterior">‹</button>
        <span class="chord-viewer__counter">1/1</span>
        <button type="button" class="chord-viewer__next" aria-label="Próxima variação">›</button>
      </div>
    </div>
    <div class="chord-viewer__body"></div>
    <div class="chord-viewer__notes"></div>
  `;
  return root;
}

function renderKeyboard(body, variation) {
  body.innerHTML = "";
  const wrap = el("div", "chord-keys");
  const all = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  all.forEach(note => {
    const key = el("div", `chord-key ${note.includes("#") ? "is-black" : "is-white"} ${variation.notes.includes(note) ? "is-active" : ""}`);
    key.dataset.note = note;
    key.textContent = note;
    wrap.appendChild(key);
  });
  body.appendChild(wrap);
}

function renderStringed(body, variation, instrument) {
  body.innerHTML = "";
  const shape = normalizeShape(variation, instrument);

  const wrap = el("div", `chord-strings chord-strings--${instrument}`);
  wrap.appendChild(el("div", "chord-strings__variation-label", shape.label || "Principal"));

  const diagram = el("div", "chord-diagram");
  diagram.style.setProperty("--strings", String(shape.strings));
  diagram.style.setProperty("--frets", String(shape.visibleFrets));

  const markers = el("div", "chord-diagram__markers");
  for (let i = 0; i < shape.strings; i += 1) {
    const pos = shape.positions[i];
    const marker = el("span", "chord-diagram__marker", pos < 0 ? "×" : pos === 0 ? "○" : "");
    markers.appendChild(marker);
  }
  diagram.appendChild(markers);

  const board = el("div", "chord-diagram__board");
  for (let i = 0; i < shape.strings; i += 1) {
    const stringLine = el("span", "chord-diagram__string");
    stringLine.style.left = `${(i / (shape.strings - 1 || 1)) * 100}%`;
    board.appendChild(stringLine);
  }
  for (let fret = 0; fret <= shape.visibleFrets; fret += 1) {
    const fretLine = el("span", `chord-diagram__fret ${fret === 0 && shape.baseFret === 1 ? "is-nut" : ""}`);
    fretLine.style.top = `${(fret / shape.visibleFrets) * 100}%`;
    board.appendChild(fretLine);
  }

  if (shape.barre && shape.barre.fret >= shape.baseFret && shape.barre.fret < shape.baseFret + shape.visibleFrets) {
    const barre = el("span", "chord-diagram__barre");
    const fretOffset = shape.barre.fret - shape.baseFret;
    const topPct = ((fretOffset + 0.5) / shape.visibleFrets) * 100;
    const fromIdx = shape.strings - shape.barre.toString;
    const toIdx = shape.strings - shape.barre.fromString;
    const leftPct = (fromIdx / (shape.strings - 1 || 1)) * 100;
    const rightPct = (toIdx / (shape.strings - 1 || 1)) * 100;
    barre.style.top = `${topPct}%`;
    barre.style.left = `${leftPct}%`;
    barre.style.width = `${Math.max(0, rightPct - leftPct)}%`;
    board.appendChild(barre);
  }

  for (let i = 0; i < shape.positions.length; i += 1) {
    const pos = shape.positions[i];
    if (pos <= 0) continue;
    if (pos < shape.baseFret || pos >= shape.baseFret + shape.visibleFrets) continue;
    const dot = el("span", "chord-diagram__dot");
    dot.style.left = `${(i / (shape.strings - 1 || 1)) * 100}%`;
    dot.style.top = `${(((pos - shape.baseFret) + 0.5) / shape.visibleFrets) * 100}%`;
    const finger = shape.fingers[i];
    dot.textContent = finger ? String(finger) : "";
    board.appendChild(dot);
  }

  diagram.appendChild(board);

  if (shape.baseFret > 1) {
    diagram.appendChild(el("div", "chord-diagram__base-fret", `${shape.baseFret}ª casa`));
  }

  wrap.appendChild(diagram);

  const caption = shape.baseFret > 1 ? `Base ${shape.baseFret}` : (shape.barre ? "Pestana" : "Forma aberta");
  wrap.appendChild(el("div", "chord-diagram__caption", caption));
  body.appendChild(wrap);
}

function getShapeVariations(symbol = "", instrument = "violao") {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return [];
  const key = parsed.normalized;
  const dict = STRINGED_SHAPES[normalizeInstrumentName(instrument)] || {};
  const direct = dict[key];
  if (direct?.length) return clone(direct);
  const base = dict[`${parsed.root}${parsed.quality}`];
  if (base?.length) return clone(base);
  return [];
}

function buildStringedFallbackVariation(symbol = "", instrument = "violao") {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return null;
  return {
    id: `${parsed.normalized}-${instrument}-fallback`,
    label: "Referência",
    displayName: parsed.normalized,
    notes: buildChordNotes(parsed),
    strings: normalizeInstrumentName(instrument) === "baixo" ? 4 : 6,
    positions: new Array(normalizeInstrumentName(instrument) === "baixo" ? 4 : 6).fill(-1),
    fingers: [],
    isFallback: true
  };
}

export function getChordVariations(symbol = "", instrument = "violao") {
  const normalizedInstrument = normalizeInstrumentName(instrument);
  if (normalizedInstrument === "teclado") {
    const v = buildKeyboardVariation(symbol);
    return v ? [v] : [];
  }

  const shapes = getShapeVariations(symbol, normalizedInstrument);
  if (shapes.length) {
    return shapes.map((shape, index) => ({
      ...shape,
      id: `${symbol}-${normalizedInstrument}-${index + 1}`,
      displayName: symbol,
      notes: buildChordNotes(symbol)
    }));
  }

  const fallback = buildStringedFallbackVariation(symbol, normalizedInstrument);
  return fallback ? [fallback] : [];
}

export function renderChordViewer(shell, symbol = "", instrument = "violao", startIndex = 0) {
  if (!shell) return null;

  const variations = getChordVariations(symbol, instrument);
  const title = shell.querySelector(".chord-viewer__title");
  const body = shell.querySelector(".chord-viewer__body");
  const notes = shell.querySelector(".chord-viewer__notes");
  const counter = shell.querySelector(".chord-viewer__counter");
  const prev = shell.querySelector(".chord-viewer__prev");
  const next = shell.querySelector(".chord-viewer__next");

  if (!variations.length) {
    title.textContent = symbol || "Acorde";
    body.innerHTML = '<div class="chord-viewer__empty">Diagrama indisponível.</div>';
    notes.textContent = "";
    counter.textContent = "0/0";
    prev.disabled = true;
    next.disabled = true;
    return { variations: [], index: 0 };
  }

  let index = Math.max(0, Math.min(startIndex, variations.length - 1));

  const paint = () => {
    const variation = variations[index];
    title.textContent = variation.displayName || symbol || "Acorde";
    notes.textContent = (variation.notes || buildChordNotes(symbol)).join(" • ");
    counter.textContent = `${index + 1}/${variations.length}`;
    prev.disabled = variations.length <= 1;
    next.disabled = variations.length <= 1;

    if (normalizeInstrumentName(instrument) === "teclado") {
      renderKeyboard(body, variation);
    } else {
      renderStringed(body, variation, normalizeInstrumentName(instrument));
    }
  };

  prev.onclick = () => {
    if (variations.length <= 1) return;
    index = (index - 1 + variations.length) % variations.length;
    paint();
  };

  next.onclick = () => {
    if (variations.length <= 1) return;
    index = (index + 1) % variations.length;
    paint();
  };

  paint();
  return {
    variations,
    get index() { return index; },
    set index(value) {
      index = Math.max(0, Math.min(value, variations.length - 1));
      paint();
    }
  };
}
