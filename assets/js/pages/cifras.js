import { listCifras } from "../services/cifras-service.js";
import { createPersonalButtons, refreshPersonalActionButtons } from "../modules/personal-actions.js";
import { normalizeInternalHref, normalizeSearchText } from "../modules/alphabet-filter.js";

function normalizeInitialLetter(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "#";
  const first = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

function agruparPorMusica(items = []) {
  const mapa = new Map();
  for (const item of items) {
    const slug = String(item.slug || "").trim();
    const titulo = String(item.title || "").trim();
    if (!slug || !titulo) continue;
    if (!mapa.has(slug)) {
      mapa.set(slug, { titulo, slug, href:`./cifra.html?slug=${encodeURIComponent(slug)}` });
    }
  }
  return Array.from(mapa.values()).sort((a,b)=>a.titulo.localeCompare(b.titulo,"pt-BR"));
}

function renderList(containerId, items = [], emptyMessage = "Nenhuma cifra encontrada.") {
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
      link.textContent = item.titulo || "Sem título";
      const actions = document.createElement("span");
      actions.className = "personal-action-group";
      actions.innerHTML = createPersonalButtons({
        type: "cifra",
        title: item.titulo,
        href: item.href,
        slug: item.slug || ""
      });
      row.append(link, actions);
      section.appendChild(row);
    });

    container.appendChild(section);
  }
  refreshPersonalActionButtons(container);
}

document.addEventListener("DOMContentLoaded", async () => {
  const input = document.getElementById("cifras-filter-input");
  const containerId = "cifras-lista-alfabetica";
  renderList(containerId, [], "Carregando cifras...");

  try {
    const todas = await listCifras(true);
    const agrupadas = agruparPorMusica(todas);

    const render = (term = "") => {
      const normalized = normalizeSearchText(term);
      const filtered = !normalized ? agrupadas : agrupadas.filter((item) => normalizeSearchText(item.titulo).includes(normalized));
      renderList(containerId, filtered, "Nenhuma cifra encontrada.");
    };

    render();
    input?.addEventListener("input", (event) => render(event.target.value));
  } catch (error) {
    console.error("Erro ao carregar cifras:", error);
    renderList(containerId, [], "Não foi possível carregar as cifras.");
  }
});
