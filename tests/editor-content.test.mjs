import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeCifraPlainText,
  normalizeRichCifraHtml,
  plainToCifraHtml
} from "../assets/js/editor.js";

test("preserva pontuação, acentos, linhas vazias e espaços da cifra", () => {
  const source = "  C#m7        A\r\nNão há outro igual!\r\n\r\n    D/F#  G\r\n";
  assert.equal(
    normalizeCifraPlainText(source),
    "  C#m7        A\nNão há outro igual!\n\n    D/F#  G\n"
  );
});

test("converte texto de cifra sem colapsar o alinhamento", () => {
  assert.equal(
    plainToCifraHtml("  C   G/B\nLetra, com pontuação."),
    "&nbsp;&nbsp;C&nbsp;&nbsp;&nbsp;G/B<br>Letra,&nbsp;com&nbsp;pontuação."
  );
});

test("não remove espaços externos do HTML musical", () => {
  assert.equal(normalizeRichCifraHtml("  <span>C</span>  \r\n"), "  <span>C</span>  \n");
});
