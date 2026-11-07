function $(selector) {
  return document.querySelector(selector);
}

function closeMenu(menu) {
  if (!menu) return;
  menu.classList.remove("is-open");
  menu.setAttribute("aria-hidden", "true");
  menu.style.display = "none";
  document.body.classList.remove("menu-open");
  document.getElementById("mobile-menu-toggle")?.setAttribute("aria-expanded", "false");
}

function openMenu(menu) {
  if (!menu) return;
  menu.classList.add("is-open");
  menu.setAttribute("aria-hidden", "false");
  menu.style.display = "block";
  document.body.classList.add("menu-open");
  const toggle = document.getElementById("mobile-menu-toggle");
  toggle?.setAttribute("aria-expanded", "true");
  menu.querySelector("#mobile-menu-close")?.focus();
}

function isMobileOrTablet() {
  return window.innerWidth <= 1024;
}

export function initMobileMenu() {
  const menu = $("#mobile-menu");
  const toggle = $("#mobile-menu-toggle");
  const closeBtn = $("#mobile-menu-close");
  const overlay = $("#mobile-menu-overlay");
  const links = document.querySelectorAll(".mobile-nav-link");

  if (!menu || !toggle) return;
  toggle.setAttribute("aria-controls", menu.id || "mobile-menu");
  toggle.setAttribute("aria-expanded", "false");

  const applyResponsiveState = () => {
    if (isMobileOrTablet()) {
      toggle.style.display = "";
      if (!menu.classList.contains("is-open")) {
        menu.style.display = "none";
        menu.setAttribute("aria-hidden", "true");
      }
    } else {
      toggle.style.display = "none";
      closeMenu(menu);
    }
  };

  toggle.addEventListener("click", () => {
    if (!isMobileOrTablet()) return;
    const isOpen = menu.classList.contains("is-open");
    if (isOpen) closeMenu(menu);
    else openMenu(menu);
  });

  closeBtn?.addEventListener("click", () => closeMenu(menu));
  overlay?.addEventListener("click", () => closeMenu(menu));
  links.forEach((link) => link.addEventListener("click", (event) => {
    if (event.currentTarget?.dataset?.submenuToggle === "1") return;
    closeMenu(menu);
  }));

  window.addEventListener("resize", applyResponsiveState);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.classList.contains("is-open")) {
      closeMenu(menu);
      toggle.focus();
    }
  });
  applyResponsiveState();
}
