import { getCurrentPublicUser, openPublicAuthModal, watchPublicAuth, whenPublicAuthReady } from "../public-auth.js";
import { getUserLibrary } from "../services/user-library-service.js";
import { normalizeInternalHref } from "../modules/alphabet-filter.js";

function groupItems(items = []) {
  const groups = new Map();
  for (const item of items) {
    const key = `${String(item.title || "").trim().toLowerCase()}__${String(item.slug || "").trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { title: item.title || "Sem título", musica: null, cifra: null });
    const row = groups.get(key);
    if (item.type === "musica" && !row.musica) row.musica = item;
    if (item.type === "cifra" && !row.cifra) row.cifra = item;
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

function addItemLink(container, item, label) {
  if (!item?.href) return;
  const link = document.createElement("a");
  link.className = "personal-library-chip";
  link.href = normalizeInternalHref(item.href);
  link.textContent = label;
  container.appendChild(link);
}

function renderRows(items = []) {
  const box = document.getElementById("favorites-list");
  if (!box) return;
  box.replaceChildren();
  const groups = groupItems(items);
  if (!groups.length) {
    const empty = document.createElement("div");
    empty.className = "personal-library-empty";
    empty.textContent = "Nenhum item aqui ainda.";
    box.appendChild(empty);
    return;
  }

  for (const group of groups) {
    const row = document.createElement("div");
    row.className = "personal-library-row personal-library-row--grouped";
    const title = document.createElement("div");
    title.className = "personal-library-title";
    title.textContent = group.title;
    const actions = document.createElement("div");
    actions.className = "personal-library-actions";
    addItemLink(actions, group.musica, "Música");
    addItemLink(actions, group.cifra, "Cifra");
    row.append(title, actions);
    box.appendChild(row);
  }
}

function renderLoginHint(hint) {
  if (!hint) return;
  hint.replaceChildren("Faça login para ver seus favoritos. ");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "personal-library-primary";
  button.textContent = "Entrar";
  button.addEventListener("click", openPublicAuthModal);
  hint.appendChild(button);
  hint.classList.remove("hidden");
}

async function renderPage() {
  const hint = document.getElementById("favorites-login-hint");
  const user = getCurrentPublicUser();
  if (!user?.uid) {
    renderLoginHint(hint);
    renderRows([]);
    return;
  }
  hint?.classList.add("hidden");
  try {
    const library = await getUserLibrary(user.uid);
    renderRows(library.favorites);
  } catch (error) {
    console.error("Não foi possível carregar os favoritos.", error);
    renderRows([]);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await whenPublicAuthReady();
  watchPublicAuth(renderPage);
});
