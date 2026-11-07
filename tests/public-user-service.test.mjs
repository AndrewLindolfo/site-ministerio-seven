import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHttpsOrLocalUrl } from "../assets/js/lib/url-safety.js";

globalThis.window = { location: { origin: "https://ministerioseven.site" } };

test("aceita fotos internas e endereços HTTPS", () => {
  assert.equal(
    normalizeHttpsOrLocalUrl("/assets/img/v7/icon_120.png"),
    "https://ministerioseven.site/assets/img/v7/icon_120.png"
  );
  assert.equal(normalizeHttpsOrLocalUrl("https://images.example.com/avatar.png"), "https://images.example.com/avatar.png");
});

test("rejeita protocolos inseguros em fotos de perfil", () => {
  assert.equal(normalizeHttpsOrLocalUrl("javascript:alert(1)"), "");
  assert.equal(normalizeHttpsOrLocalUrl("http://images.example.com/avatar.png"), "");
  assert.equal(normalizeHttpsOrLocalUrl("https://["), "");
});
