function $(selector) {
  return document.querySelector(selector);
}

function closeMenu(menu) {
  if (!menu) return;
  menu.classList.remove("is-open");
  menu.setAttribute("aria-hidden", "true");
  menu.style.display = "none";
  document.body.classList.remove("menu-open");
}

function openMenu(menu) {
  if (!menu) return;
  menu.classList.add("is-open");
  menu.setAttribute("aria-hidden", "false");
  menu.style.display = "block";
  document.body.classList.add("menu-open");
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
  applyResponsiveState();
}
