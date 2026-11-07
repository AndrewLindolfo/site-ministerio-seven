import { listCifras } from "../services/cifras-service.js";
import { createPersonalButtons, refreshPersonalActionButtons } from "../modules/personal-actions.js";

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
    const chave = slug || titulo.toLowerCase();
    if (!chave) continue;
    if (!mapa.has(chave)) {
      mapa.set(chave, { titulo, slug, href:`./cifra.html?slug=${encodeURIComponent(slug)}` });
    }
  }
  return Array.from(mapa.values()).sort((a,b)=>a.titulo.localeCompare(b.titulo,"pt-BR"));
}

function renderList(containerId, items = [], emptyMessage = "Nenhuma cifra encontrada.") {
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
            type:"cifra",
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
  const input = document.getElementById("cifras-filter-input");
  const containerId = "cifras-lista-alfabetica";
  renderList(containerId, [], "Carregando cifras...");

  try {
    const todas = await listCifras(true);
    const agrupadas = agruparPorMusica(todas);

    const render = (term = "") => {
      const normalized = String(term || "").trim().toLowerCase();
      const filtered = !normalized ? agrupadas : agrupadas.filter((item) => item.titulo.toLowerCase().includes(normalized));
      renderList(containerId, filtered, "Nenhuma cifra encontrada.");
    };

    render();
    input?.addEventListener("input", (event) => render(event.target.value));
  } catch (error) {
    console.error("Erro ao carregar cifras:", error);
    renderList(containerId, [], "Não foi possível carregar as cifras.");
  }
});
