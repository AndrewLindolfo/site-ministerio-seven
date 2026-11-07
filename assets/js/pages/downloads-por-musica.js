import { listDownloadsByMusic } from "../services/downloads-music-service.js";
import { normalizeSearchText } from "../modules/alphabet-filter.js";

function initialLetter(value = "") {
  const letter = normalizeSearchText(value).charAt(0).toUpperCase();
  return /[A-Z]/.test(letter) ? letter : "#";
}

function addDownloadLink(container, url, label, title) {
  if (!url) return;
  const link = document.createElement("a");
  link.className = "downloads-music-btn";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `Baixar ${label} de ${title}`);
  link.textContent = label;
  container.appendChild(link);
}

function renderList(items = [], emptyMessage = "Nenhum download por música encontrado.") {
  const container = document.getElementById("downloads-music-lista-alfabetica");
  if (!container) return;
  container.replaceChildren();
  if (!items.length) {
    const message = document.createElement("p");
    message.textContent = emptyMessage;
    container.appendChild(message);
    return;
  }

  const groups = items.reduce((result, item) => {
    const letter = initialLetter(item.title);
    (result[letter] ||= []).push(item);
    return result;
  }, {});
  const letters = Object.keys(groups).sort((a, b) => a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b, "pt-BR"));

  for (const letter of letters) {
    const section = document.createElement("section");
    section.className = "alphabet-group";
    const heading = document.createElement("h2");
    heading.className = "alphabet-letter";
    heading.textContent = letter;
    section.appendChild(heading);
    groups[letter]
      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"))
      .forEach((item) => {
        const row = document.createElement("div");
        row.className = "downloads-music-row";
        const title = document.createElement("div");
        title.className = "downloads-music-title";
        title.textContent = item.title;
        const actions = document.createElement("div");
        actions.className = "downloads-music-actions";
        addDownloadLink(actions, item.pdfUrl, "PDF", item.title);
        addDownloadLink(actions, item.pptUrl, "PPT", item.title);
        row.append(title, actions);
        section.appendChild(row);
      });
    container.appendChild(section);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const input = document.getElementById("downloads-music-filter-input");
  renderList([], "Carregando downloads...");
  try {
    const all = await listDownloadsByMusic(true);
    const render = (term = "") => {
      const query = normalizeSearchText(term);
      renderList(query ? all.filter((item) => normalizeSearchText(item.title).includes(query)) : all);
    };
    render();
    input?.addEventListener("input", (event) => render(event.target.value));
  } catch (error) {
    console.error("Não foi possível carregar os downloads por música.", error);
    renderList([], "Não foi possível carregar os downloads por música.");
  }
});
