const PUBLIC_NAV_ITEMS = [
  ["Início", "./index.html"],
  ["Músicas", "./musicas.html"],
  ["Cifras", "./cifras.html"],
  ["Agenda", "./agenda.html"],
  ["Álbuns", "./fotos.html"],
  ["Downloads", "./downloads.html"],
  ["Ferramentas", "./ferramentas.html"],
  ["Contato", "./contato.html"]
];

function normalizePath(path = "") {
  const clean = String(path).split(/[?#]/)[0].replace(/\/$/, "");
  return clean.split("/").pop()?.replace(/\.html$/i, "") || "index";
}

function createLink(label, href, mobile = false) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  if (mobile) link.className = "mobile-nav-link";
  if (normalizePath(location.pathname) === normalizePath(href)) {
    link.classList.add("is-current");
    link.setAttribute("aria-current", "page");
  }
  return link;
}

function rebuildDesktopNavigation(nav) {
  nav.replaceChildren(...PUBLIC_NAV_ITEMS.map(([label, href]) => createLink(label, href)));
}

function rebuildMobileNavigation(nav) {
  const close = nav.querySelector("#mobile-menu-close") || document.createElement("button");
  if (!close.id) {
    close.type = "button";
    close.id = "mobile-menu-close";
    close.setAttribute("aria-label", "Fechar menu");
    close.textContent = "✕";
  }
  nav.replaceChildren(
    close,
    ...PUBLIC_NAV_ITEMS.map(([label, href]) => createLink(label, href, true))
  );
}

export function initPublicNavigation() {
  document.querySelectorAll(".main-nav").forEach(rebuildDesktopNavigation);
  document.querySelectorAll(".mobile-menu-panel").forEach(rebuildMobileNavigation);
}

