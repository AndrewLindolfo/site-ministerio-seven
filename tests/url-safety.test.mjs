import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHttpsOrLocalUrl } from "../assets/js/lib/url-safety.js";

test("aceita HTTPS e caminhos da própria origem", () => {
  globalThis.window = { location: { origin: "https://ministerioseven.site" } };
  assert.equal(normalizeHttpsOrLocalUrl("/musicas.html"), "https://ministerioseven.site/musicas.html");
  assert.equal(normalizeHttpsOrLocalUrl("https://example.com/arquivo.pdf"), "https://example.com/arquivo.pdf");
});

test("rejeita protocolos executáveis e HTTP externo", () => {
  globalThis.window = { location: { origin: "https://ministerioseven.site" } };
  assert.equal(normalizeHttpsOrLocalUrl("javascript:alert(1)"), "");
  assert.equal(normalizeHttpsOrLocalUrl("data:text/html,teste"), "");
  assert.equal(normalizeHttpsOrLocalUrl("http://example.com/arquivo"), "");
});
