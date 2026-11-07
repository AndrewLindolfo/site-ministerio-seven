function createMenuMarkup(basePath = ".") {
  return `
    <div class="downloads-submenu hidden" data-downloads-submenu>
      <a href="${basePath}/downloads.html">Geral</a>
      <a href="${basePath}/downloads-por-musica.html">Por Música</a>
    </div>
  `;
}

function enhanceDesktopLink(link) {
  if (!link || link.dataset.downloadsSplitReady === "1") return;
  link.dataset.downloadsSplitReady = "1";
  const wrapper = document.createElement("div");
  wrapper.className = "downloads-nav-group";
  link.parentNode.insertBefore(wrapper, link);
  wrapper.appendChild(link);
  wrapper.insertAdjacentHTML("beforeend", createMenuMarkup("."));

  link.href = "#";
  link.setAttribute("aria-expanded", "false");
  link.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const menu = wrapper.querySelector("[data-downloads-submenu]");
    const willOpen = menu.classList.contains("hidden");
    document.querySelectorAll("[data-downloads-submenu]").forEach((item) => item.classList.add("hidden"));
    document.querySelectorAll(".downloads-nav-group > a").forEach((item) => item.setAttribute("aria-expanded", "false"));
    menu.classList.toggle("hidden", !willOpen);
    link.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });
}

function enhanceMobileLink(link) {
  if (!link || link.dataset.downloadsSplitReady === "1") return;
  link.dataset.downloadsSplitReady = "1";
  link.dataset.submenuToggle = "1";
  link.href = "#";
  link.setAttribute("aria-expanded", "false");
  link.insertAdjacentHTML("afterend", `
    <div class="mobile-downloads-submenu hidden" data-downloads-submenu>
      <a href="./downloads.html" class="mobile-nav-link">Geral</a>
      <a href="./downloads-por-musica.html" class="mobile-nav-link">Por Música</a>
    </div>
  `);
  const menu = link.nextElementSibling;

  link.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const willOpen = menu.classList.contains("hidden");
    document.querySelectorAll(".mobile-downloads-submenu").forEach((item) => item.classList.add("hidden"));
    document.querySelectorAll(".mobile-menu-panel [data-submenu-toggle='1']").forEach((item) => item.setAttribute("aria-expanded", "false"));
    menu.classList.toggle("hidden", !willOpen);
    link.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });
}

export function initDownloadsSplitMenu() {
  const desktopLink = document.querySelector(".main-nav a[href='./downloads.html']");
  const mobileLink = document.querySelector(".mobile-menu-panel a[href='./downloads.html']");
  if (desktopLink) enhanceDesktopLink(desktopLink);
  if (mobileLink) enhanceMobileLink(mobileLink);

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".downloads-nav-group")) {
      document.querySelectorAll(".downloads-submenu").forEach((item) => item.classList.add("hidden"));
      document.querySelectorAll(".downloads-nav-group > a").forEach((item) => item.setAttribute("aria-expanded", "false"));
    }
  });
}
