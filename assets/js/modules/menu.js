import { $, $$ } from "../utils.js";
import { logout, watchAuth } from "../auth.js";
import { normalizeProfilePhotoUrl } from "../services/public-user-service.js";

function fillAdminUser(user) {
  const emailEls = $$("#admin-user-email");
  const photoEls = $$("#admin-user-photo");
  const toggle = $("#admin-account-toggle");
  const photoSrc = normalizeProfilePhotoUrl(user?.photoURL) || "../assets/img/v7/icon_120.png";
  const altText = String(user?.displayName || user?.email || "Conta").trim().slice(0, 200);

  emailEls.forEach((el) => {
    el.textContent = user?.email || "";
  });

  photoEls.forEach((el) => {
    el.src = photoSrc;
    el.alt = altText;
  });

  if (toggle) {
    const image = document.createElement("img");
    image.src = photoSrc;
    image.alt = altText;
    image.className = "admin-account-toggle-photo";
    toggle.replaceChildren(image);
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
    toggle.setAttribute("aria-expanded", "false");
    const close = () => {
      menu.classList.add("hidden");
      toggle.setAttribute("aria-expanded", "false");
    };
    toggle.addEventListener("click", () => {
      const hidden = menu.classList.toggle("hidden");
      toggle.setAttribute("aria-expanded", hidden ? "false" : "true");
    });

    document.addEventListener("click", (event) => {
      if (!menu.contains(event.target) && !toggle.contains(event.target)) {
        close();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !menu.classList.contains("hidden")) {
        close();
        toggle.focus();
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      logoutButton.disabled = true;
      try {
        await logout();
      } catch (error) {
        console.error("Não foi possível sair da conta administrativa.", error);
        logoutButton.disabled = false;
      }
    });
  }

  watchAuth((user) => {
    if (user) {
      fillAdminUser(user);
    }
  });
}
