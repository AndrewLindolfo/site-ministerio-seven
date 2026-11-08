import { initTheme } from "./theme.js";
import { setFooterYear } from "./ui.js";
import { initSearch } from "./search.js";
import { initMobileMenu } from "./modules/mobile-menu.js";
import { initAdminAccountMenu } from "./modules/menu.js";
import { initThemeBranding } from "./modules/theme-branding.js";
import { initNotificacoesPopup } from "./modules/notificacoes-popup.js";
import { initDownloadsSplitMenu } from "./modules/downloads-menu.js";
import { initPublicAuth } from "./public-auth.js";
import { initPersonalActions } from "./modules/personal-actions.js";
import { SITE_CONFIG } from "./config.js";

const PERSONAL_ACTION_PAGES = new Set([
  "cifra.html",
  "cifras.html",
  "favoritos.html",
  "musica.html",
  "musicas.html",
  "playlists.html"
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

function injectHomeLinks() {
  document.querySelectorAll(".main-nav, .mobile-menu-panel").forEach((nav) => {
    if (!nav || nav.querySelector('[data-home-link="1"]')) return;
    const homeLink = document.createElement("a");
    homeLink.href = "./index.html";
    homeLink.textContent = "Início";
    homeLink.setAttribute("data-home-link", "1");
    homeLink.className = nav.classList.contains("mobile-menu-panel") ? "mobile-nav-link" : "";
    nav.insertBefore(homeLink, nav.firstChild);
  });
}

function isPersonalActionPage() {
  const name = window.location.pathname.split("/").pop() || "index.html";
  return PERSONAL_ACTION_PAGES.has(name.toLowerCase());
}

document.addEventListener("DOMContentLoaded", () => {
  const isAdminPage = Boolean(document.querySelector(".admin-topbar"));
  initTheme();
  initThemeBranding();
  setFooterYear();

  if (isAdminPage) {
    initAdminAccountMenu();
    injectAdminSiteShortcut();
    return;
  }

  injectHomeLinks();
  initSearch();
  initMobileMenu();
  initDownloadsSplitMenu();
  initPublicAuth();
  if (isPersonalActionPage()) initPersonalActions();
  if (document.querySelector(".home-page")) initNotificacoesPopup();
});
