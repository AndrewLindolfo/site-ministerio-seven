import test from "node:test";
import assert from "node:assert/strict";

import {
  getAssetPrefix,
  getThemeBrandingAssets
} from "../assets/js/modules/theme-branding.js";

test("resolve o prefixo de recursos para páginas públicas e administrativas", () => {
  assert.equal(getAssetPrefix("/musicas"), "assets");
  assert.equal(getAssetPrefix("/admin"), "../assets");
  assert.equal(getAssetPrefix("/admin/index.html"), "../assets");
  assert.equal(getAssetPrefix("/admin/musicas"), "../assets");
});

test("usa V7 e favicon brancos no modo escuro", () => {
  const assets = getThemeBrandingAssets("dark", "../assets");
  assert.equal(assets.headerLogo, "../assets/img/v7/icon_dark.png");
  assert.equal(assets.favicon, "../assets/img/favicon/favicon-white-32.png");
});

test("usa V7 e favicon pretos no modo claro", () => {
  const assets = getThemeBrandingAssets("light", "assets");
  assert.equal(assets.headerLogo, "assets/img/v7/icon_light.png");
  assert.equal(assets.favicon, "assets/img/favicon/favicon_32.png");
});
