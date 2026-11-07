import { $, $$ } from "../utils.js";
import { logout, watchAuth } from "../auth.js";

function fillAdminUser(user) {
  const emailEls = $$("#admin-user-email");
  const photoEls = $$("#admin-user-photo");
  const toggle = $("#admin-account-toggle");
  const photoSrc = user?.photoURL || "../assets/img/v7/icon_120.png";
  const altText = user?.displayName || user?.email || "Conta";

  emailEls.forEach((el) => {
    el.textContent = user?.email || "";
  });

  photoEls.forEach((el) => {
    el.src = photoSrc;
    el.alt = altText;
  });

  if (toggle) {
    toggle.innerHTML = `<img src="${photoSrc}" alt="${altText}" class="admin-account-toggle-photo" />`;
    toggle.setAttribute("aria-label", altText);
    toggle.title = altText;
  }
}

function ensureAdminViewSiteLink(menu) {
  if (!menu || menu.querySelector("#admin-view-site-menu-link")) return;

  const link = document.createElement("a");
  link.id = "admin-view-site-menu-link";
  link.href = "../index.html";
  link.className = "admin-account-site-link";
  link.textContent = "Ver site";

  const logoutButton = menu.querySelector("#admin-logout-button");
  if (logoutButton) {
    menu.insertBefore(link, logoutButton);
  } else {
    menu.appendChild(link);
  }
}

export function initAdminAccountMenu() {
  const toggle = $("#admin-account-toggle");
  const menu = $("#admin-account-menu");
  const logoutButton = $("#admin-logout-button");

  ensureAdminViewSiteLink(menu);

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      menu.classList.toggle("hidden");
    });

    document.addEventListener("click", (event) => {
      if (!menu.contains(event.target) && !toggle.contains(event.target)) {
        menu.classList.add("hidden");
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      await logout();
    });
  }

  watchAuth((user) => {
    if (user) {
      fillAdminUser(user);
    }
  });
}
