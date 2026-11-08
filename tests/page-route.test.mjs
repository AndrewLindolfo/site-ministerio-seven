import test from "node:test";
import assert from "node:assert/strict";
import { getPageName } from "../assets/js/lib/page-route.js";

test("normaliza rotas limpas do Firebase Hosting", () => {
  assert.equal(getPageName("/cifra"), "cifra");
  assert.equal(getPageName("/musica"), "musica");
  assert.equal(getPageName("/playlists"), "playlists");
});

test("mantém compatibilidade com páginas HTML e subdiretórios", () => {
  assert.equal(getPageName("/cifra.html"), "cifra");
  assert.equal(getPageName("/admin/musica.html"), "musica");
  assert.equal(getPageName("/"), "index");
});
