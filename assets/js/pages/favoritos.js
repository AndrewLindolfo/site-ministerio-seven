import { getCurrentPublicUser, openPublicAuthModal, watchPublicAuth, whenPublicAuthReady } from "../public-auth.js";
import { getUserLibrary } from "../services/user-library-service.js";

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function groupItems(items = []) {
  const grouped = new Map();
  items.forEach((item) => {
    const key = `${String(item.title || "").trim().toLowerCase()}__${String(item.slug || "").trim().toLowerCase()}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        title: item.title || "",
        musica: null,
        cifra: null
      });
    }
    const row = grouped.get(key);
    if (item.type === "musica" && !row.musica) row.musica = item;
    if (item.type === "cifra" && !row.cifra) row.cifra = item;
  });
  return Array.from(grouped.values()).sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "pt-BR"));
}

function renderRows(items = []) {
  const box = document.getElementById("favorites-list");
  if (!box) return;

  if (!items.length) {
    box.innerHTML = '<div class="personal-library-empty">Nenhum item aqui ainda.</div>';
    return;
  }

  const grouped = groupItems(items);
  box.innerHTML = grouped.map((row) => `
    <div class="personal-library-row personal-library-row--grouped">
      <div class="personal-library-title">${escapeHtml(row.title)}</div>
      <div class="personal-library-actions">
        ${row.musica ? `<a class="personal-library-chip" href="${row.musica.href}">Música</a>` : ""}
        ${row.cifra ? `<a class="personal-library-chip" href="${row.cifra.href}">Cifra</a>` : ""}
      </div>
    </div>
  `).join("");
}

async function renderPage() {
  const hint = document.getElementById("favorites-login-hint");
  const user = getCurrentPublicUser();
  if (!user?.uid) {
    if (hint) {
      hint.classList.remove("hidden");
      hint.innerHTML = 'Faça login para ver seus favoritos. <button type="button" id="favorites-login-button" class="personal-library-primary">Entrar</button>';
      document.getElementById("favorites-login-button")?.addEventListener("click", openPublicAuthModal);
    }
    renderRows([]);
    return;
  }

  hint?.classList.add("hidden");
  const library = await getUserLibrary(user.uid);
  renderRows(library.favorites || []);
}

document.addEventListener("DOMContentLoaded", async () => {
  await whenPublicAuthReady();
  await renderPage();
  watchPublicAuth(() => renderPage());
});
