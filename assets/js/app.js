import { initTheme } from "./theme.js";
import { setFooterYear } from "./ui.js";
import { initMobileMenu } from "./modules/mobile-menu.js";
import { initThemeBranding } from "./modules/theme-branding.js";
import { initDownloadsSplitMenu } from "./modules/downloads-menu.js";
import { initPublicNavigation } from "./modules/public-navigation.js";
import { initPublicAuthShell } from "./modules/public-auth-shell.js";
import { SITE_CONFIG } from "./config.js";
import { getPageName } from "./lib/page-route.js";

const PERSONAL_ACTION_PAGES = new Set([
  "cifra",
  "cifras",
  "favoritos",
  "musica",
  "musicas",
  "playlists"
]);

function injectAdminSiteShortcut() {
  const topbar = document.querySelector(".admin-topbar-inner");
  if (!topbar || document.getElementById("admin-view-site-link")) return;

  const headerActions = topbar.querySelector(".header-actions");
  const brand = topbar.querySelector(".admin-brand");
  const link = document.createElement("a");
  link.id = "admin-view-site-link";
  link.className = "admin-view-site-link";
  link.href = SITE_CONFIG.publicSiteUrl;
  link.textContent = "Ver site";

  if (headerActions) {
    topbar.insertBefore(link, headerActions);
  } else if (brand?.nextSibling) {
    topbar.insertBefore(link, brand.nextSibling);
  } else {
    topbar.appendChild(link);
  }
}

function isPersonalActionPage() {
  return PERSONAL_ACTION_PAGES.has(getPageName(window.location.pathname));
}

let publicAuthModulePromise = null;

async function loadPublicAuth() {
  publicAuthModulePromise ||= import("./public-auth.js");
  const module = await publicAuthModulePromise;
  module.initPublicAuth();
  return module;
}

function loadPublicFeatures() {
  loadPublicAuth().catch((error) => console.error("Erro ao carregar autenticação pública.", error));
  import("./search.js")
    .then(({ initSearch }) => initSearch())
    .catch((error) => console.error("Erro ao carregar a busca.", error));
  if (isPersonalActionPage()) {
    import("./modules/personal-actions.js")
      .then(({ initPersonalActions }) => initPersonalActions())
      .catch((error) => console.error("Erro ao carregar ações pessoais.", error));
  }
  if (document.querySelector(".home-page")) {
    import("./modules/notificacoes-popup.js")
      .then(({ initNotificacoesPopup }) => initNotificacoesPopup())
      .catch((error) => console.error("Erro ao carregar notificações.", error));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const isAdminPage = Boolean(document.querySelector(".admin-topbar"));
  initTheme();
  initThemeBranding();
  setFooterYear();

  if (isAdminPage) {
    injectAdminSiteShortcut();
    import("./modules/menu.js")
      .then(({ initAdminAccountMenu }) => initAdminAccountMenu())
      .catch((error) => console.error("Erro ao carregar a conta administrativa.", error));
    return;
  }

  initPublicNavigation();
  initPublicAuthShell();
  initMobileMenu();
  initDownloadsSplitMenu();
  document.addEventListener("seven:public-auth-request", async () => {
    const module = await loadPublicAuth();
    const user = await module.whenPublicAuthReady();
    if (user?.uid) document.getElementById("public-user-toggle")?.click();
    else module.openPublicAuthModal();
  });
  loadPublicFeatures();
});
