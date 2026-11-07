import test from "node:test";
import assert from "node:assert/strict";
import { filterByTerm, normalizeSearchText } from "../assets/js/modules/alphabet-filter.js";

test("normaliza maiúsculas, espaços e acentos na busca", () => {
  assert.equal(normalizeSearchText("  Coração  "), "coracao");
  assert.equal(normalizeSearchText("ÁGUA VIVA"), "agua viva");
});

test("filtra títulos sem diferenciar acentos", () => {
  const items = [{ title: "Coração Adorador" }, { title: "Água Viva" }];
  assert.deepEqual(filterByTerm(items, "coracao"), [items[0]]);
  assert.deepEqual(filterByTerm(items, "AGUA"), [items[1]]);
});
