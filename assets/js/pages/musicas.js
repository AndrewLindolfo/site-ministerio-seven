import { listMusicas } from "../services/musicas-service.js";
import { createPersonalButtons, refreshPersonalActionButtons } from "../modules/personal-actions.js";

function normalizeInitialLetter(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "#";
  const first = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

function renderList(containerId, items = [], emptyMessage = "Nenhuma música encontrada.") {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<p>${emptyMessage}</p>`;
    return;
  }

  const grouped = items.reduce((acc, item) => {
    const letter = normalizeInitialLetter(item.titulo);
    (acc[letter] ||= []).push(item);
    return acc;
  }, {});
  const letters = Object.keys(grouped).sort((a,b)=> a==="#"?1:b==="#"?-1:a.localeCompare(b,"pt-BR"));

  container.innerHTML = letters.map((letter)=>`
    <section class="alphabet-group">
      <h2 class="alphabet-letter">${letter}</h2>
      ${grouped[letter].sort((a,b)=>a.titulo.localeCompare(b.titulo,"pt-BR")).map((item)=>`
        <div class="music-list-item">
          <a class="music-list-link" href="${item.href}">${item.titulo}</a>
          <span class="personal-action-group">${createPersonalButtons({
            type:"musica",
            title:item.titulo,
            href:item.href,
            slug:item.slug || ""
          })}</span>
        </div>
      `).join("")}
    </section>
  `).join("");
  refreshPersonalActionButtons(container);
}

document.addEventListener("DOMContentLoaded", async () => {
  const input = document.getElementById("musicas-filter-input");
  const containerId = "musicas-lista-alfabetica";
  renderList(containerId, [], "Carregando músicas...");

  try {
    const all = (await listMusicas(true)).map((item) => ({
      titulo: item.title,
      slug: item.slug,
      href: `./musica.html?slug=${item.slug}`
    }));

    const render = (term = "") => {
      const normalized = String(term || "").trim().toLowerCase();
      const filtered = !normalized ? all : all.filter((item) => item.titulo.toLowerCase().includes(normalized));
      renderList(containerId, filtered, "Nenhuma música encontrada.");
    };

    render();
    input?.addEventListener("input", (event) => render(event.target.value));
  } catch (error) {
    console.error("Erro ao carregar músicas:", error);
    renderList(containerId, [], "Não foi possível carregar as músicas.");
  }
});
