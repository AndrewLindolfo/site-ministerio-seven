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
import { getAdminProfileByEmail } from "./auth.js";
import { isPrimaryAdmin } from "./services/admin-permissions-service.js";
import { auth } from "./firebase.js";

function injectAdminSiteShortcut() {
  const topbar = document.querySelector(".admin-topbar-inner");
  if (!topbar || document.getElementById("admin-view-site-link")) return;

  const headerActions = topbar.querySelector(".header-actions");
  const brand = topbar.querySelector(".admin-brand");
  const link = document.createElement("a");
  link.id = "admin-view-site-link";
  link.className = "admin-view-site-link";
  link.href = "../index.html";
  link.textContent = "Ver site";

  if (headerActions) {
    topbar.insertBefore(link, headerActions);
  } else if (brand?.nextSibling) {
    topbar.insertBefore(link, brand.nextSibling);
  } else {
    topbar.appendChild(link);
  }
}

async function injectAdminCreateShortcut() {
  const topbar = document.querySelector(".admin-topbar-inner");
  if (!topbar || document.getElementById("admin-create-link")) return;
  const user = auth.currentUser;
  if (!user?.email) return;
  const admin = await getAdminProfileByEmail(user.email);
  if (!isPrimaryAdmin(admin)) return;

  const headerActions = topbar.querySelector(".header-actions");
  const link = document.createElement("a");
  link.id = "admin-create-link";
  link.className = "admin-view-site-link";
  link.href = "./admins.html";
  link.textContent = "Criar ADM";

  if (headerActions) {
    topbar.insertBefore(link, headerActions);
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

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  injectHomeLinks();
  initThemeBranding();
  setFooterYear();
  initSearch();
  initMobileMenu();
  initDownloadsSplitMenu();
  initPublicAuth();
  initPersonalActions();
  initAdminAccountMenu();
  injectAdminSiteShortcut();
  await injectAdminCreateShortcut();
  initNotificacoesPopup();
});
