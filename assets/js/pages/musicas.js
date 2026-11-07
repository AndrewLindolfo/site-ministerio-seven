import { listMusicas } from "../services/musicas-service.js";
import { createPersonalButtons, refreshPersonalActionButtons } from "../modules/personal-actions.js";
import { normalizeInternalHref, normalizeSearchText } from "../modules/alphabet-filter.js";

function normalizeInitialLetter(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "#";
  const first = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

function renderList(containerId, items = [], emptyMessage = "Nenhuma música encontrada.") {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren();
  if (!items.length) {
    const message = document.createElement("p");
    message.textContent = emptyMessage;
    container.appendChild(message);
    return;
  }

  const grouped = items.reduce((acc, item) => {
    const letter = normalizeInitialLetter(item.titulo);
    (acc[letter] ||= []).push(item);
    return acc;
  }, {});
  const letters = Object.keys(grouped).sort((a,b)=> a==="#"?1:b==="#"?-1:a.localeCompare(b,"pt-BR"));

  for (const letter of letters) {
    const section = document.createElement("section");
    section.className = "alphabet-group";
    const heading = document.createElement("h2");
    heading.className = "alphabet-letter";
    heading.textContent = letter;
    section.appendChild(heading);

    grouped[letter].sort((a,b)=>a.titulo.localeCompare(b.titulo,"pt-BR")).forEach((item) => {
      const row = document.createElement("div");
      row.className = "music-list-item";
      const link = document.createElement("a");
      link.className = "music-list-link";
      link.href = normalizeInternalHref(item.href);
      link.textContent = item.titulo;
      const actions = document.createElement("span");
      actions.className = "personal-action-group";
      actions.innerHTML = createPersonalButtons({
            type:"musica",
            title:item.titulo,
            href:item.href,
            slug:item.slug || ""
          });
      row.append(link, actions);
      section.appendChild(row);
    });

    container.appendChild(section);
  }
  refreshPersonalActionButtons(container);
}

document.addEventListener("DOMContentLoaded", async () => {
  const input = document.getElementById("musicas-filter-input");
  const containerId = "musicas-lista-alfabetica";
  renderList(containerId, [], "Carregando músicas...");

  try {
    const all = (await listMusicas(true))
      .map((item) => ({
        titulo: String(item.title || "").trim(),
        slug: String(item.slug || "").trim()
      }))
      .filter((item) => item.titulo && item.slug)
      .map((item) => ({ ...item, href: `./musica.html?slug=${encodeURIComponent(item.slug)}` }));

    const render = (term = "") => {
      const normalized = normalizeSearchText(term);
      const filtered = !normalized ? all : all.filter((item) => normalizeSearchText(item.titulo).includes(normalized));
      renderList(containerId, filtered, "Nenhuma música encontrada.");
    };

    render();
    input?.addEventListener("input", (event) => render(event.target.value));
  } catch (error) {
    console.error("Erro ao carregar músicas:", error);
    renderList(containerId, [], "Não foi possível carregar as músicas.");
  }
});
