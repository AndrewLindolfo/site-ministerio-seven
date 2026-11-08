export function getAssetPrefix(pathname = window.location.pathname || "") {
  const path = pathname;
  const isAdmin = /(^|\/)admin(?:\/|$)/i.test(path) || /\/admin-[^/]+\.html$/i.test(path);
  return isAdmin ? "../assets" : "assets";
}

export function getThemeBrandingAssets(theme = "dark", assetPrefix = "assets") {
  const isDark = theme === "dark";
  return {
    headerLogo: `${assetPrefix}/img/v7/${isDark ? "icon_dark.png" : "icon_light.png"}`,
    footerLogo: `${assetPrefix}/img/logo/${isDark ? "logo_dark.png" : "logo_light.png"}`,
    heroBanner: `${assetPrefix}/img/banner/${isDark ? "banner_dark.png" : "banner_light.png"}`,
    favicon: `${assetPrefix}/img/favicon/${isDark ? "favicon-white-32.png" : "favicon_32.png"}`
  };
}

function ensureFavicon() {
  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.setAttribute("rel", "icon");
    document.head.appendChild(favicon);
  }
  return favicon;
}

function updateThemeToggleIcon(isDark) {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  toggle.textContent = isDark ? "☀️" : "🌙";
  toggle.setAttribute(
    "aria-label",
    isDark ? "Ativar modo claro" : "Ativar modo escuro"
  );
  toggle.setAttribute(
    "title",
    isDark ? "Ativar modo claro" : "Ativar modo escuro"
  );
}

export function applyThemeBranding() {
  const theme = document.documentElement.getAttribute("data-theme") || "dark";
  const isDark = theme === "dark";
  const assets = getAssetPrefix();
  const branding = getThemeBrandingAssets(theme, assets);

  const headerLogos = document.querySelectorAll("#header-v7-logo, .admin-v7");
  const footerLogo = document.getElementById("footer-logo");
  const heroBanner = document.getElementById("hero-banner");
  const favicon = ensureFavicon();

  headerLogos.forEach((headerLogo) => {
    headerLogo.src = branding.headerLogo;
  });

  if (footerLogo) {
    footerLogo.src = branding.footerLogo;
  }

  if (heroBanner) {
    heroBanner.style.backgroundImage = `url("${branding.heroBanner}")`;
  }

  if (favicon) {
    favicon.href = branding.favicon;
    favicon.type = "image/png";
  }

  updateThemeToggleIcon(isDark);
}

export function initThemeBranding() {
  applyThemeBranding();

  const observer = new MutationObserver(() => applyThemeBranding());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });
}
