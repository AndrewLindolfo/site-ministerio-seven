function getAssetPrefix() {
  const path = window.location.pathname || "";
  const isAdmin = /\/admin\//.test(path) || /\/admin-[^/]+\.html$/i.test(path);
  return isAdmin ? "../assets" : "assets";
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

  // No modo escuro aparece sol para ir ao claro
  // No modo claro aparece lua para ir ao escuro
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

  const headerLogo = document.getElementById("header-v7-logo");
  const footerLogo = document.getElementById("footer-logo");
  const heroBanner = document.getElementById("hero-banner");
  const favicon = ensureFavicon();

  if (headerLogo) {
    headerLogo.src = isDark
      ? `${assets}/img/v7/icon_dark.png`
      : `${assets}/img/v7/icon_light.png`;
  }

  if (footerLogo) {
    footerLogo.src = isDark
      ? `${assets}/img/logo/logo_dark.png`
      : `${assets}/img/logo/logo_light.png`;
  }

  if (heroBanner) {
    heroBanner.style.backgroundImage = isDark
      ? `url("${assets}/img/banner/banner_dark.png")`
      : `url("${assets}/img/banner/banner_light.png")`;
  }

  if (favicon) {
    favicon.href = `${assets}/img/favicon/favicon-white-32.png`;
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

  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    setTimeout(applyThemeBranding, 0);
  });
}
