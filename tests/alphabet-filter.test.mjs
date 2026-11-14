import test from "node:test";
import assert from "node:assert/strict";
import { filterByTerm, normalizeInternalHref, normalizeSearchText } from "../assets/js/modules/alphabet-filter.js";

test("normaliza maiúsculas, espaços e acentos na busca", () => {
  assert.equal(normalizeSearchText("  Coração  "), "coracao");
  assert.equal(normalizeSearchText("ÁGUA VIVA"), "agua viva");
});

test("filtra títulos sem diferenciar acentos", () => {
  const items = [{ title: "Coração Adorador" }, { title: "Água Viva" }];
  assert.deepEqual(filterByTerm(items, "coracao"), [items[0]]);
  assert.deepEqual(filterByTerm(items, "AGUA"), [items[1]]);
});

test("preserva o subdiretório ao normalizar links internos relativos", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: {
      href: "https://example.github.io/ministerio-seven-site-test/cifras.html",
      origin: "https://example.github.io"
    }
  };

  try {
    assert.equal(
      normalizeInternalHref("./cifra.html?slug=a-bencao"),
      "/ministerio-seven-site-test/cifra.html?slug=a-bencao"
    );
    assert.equal(normalizeInternalHref("https://malicioso.example/cifra.html"), "#");
  } finally {
    globalThis.window = originalWindow;
  }
});
