import { listDownloadsByMusic } from "../services/downloads-music-service.js";

function normalizeInitialLetter(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "#";
  const first = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

function groupByLetter(items = []) {
  return items.reduce((acc, item) => {
    const letter = normalizeInitialLetter(item.title || "");
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(item);
    return acc;
  }, {});
}

function renderList(items = []) {
  const container = document.getElementById("downloads-music-lista-alfabetica");
  if (!container) return;

  if (!items.length) {
    container.innerHTML = "<p>Nenhum download por música encontrado.</p>";
    return;
  }

  const grouped = groupByLetter(items);
  const letters = Object.keys(grouped).sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b, "pt-BR");
  });

  container.innerHTML = letters.map((letter) => `
    <section class="alphabet-group">
      <h2 class="alphabet-letter">${letter}</h2>
      ${grouped[letter]
        .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "pt-BR"))
        .map((item) => `
          <div class="downloads-music-row">
            <div class="downloads-music-title">${item.title || ""}</div>
            <div class="downloads-music-actions">
              ${item.pdfUrl ? `<a class="downloads-music-btn" href="${item.pdfUrl}" target="_blank" rel="noopener noreferrer" aria-label="Baixar PDF de ${item.title || ""}">PDF</a>` : ""}
              ${item.pptUrl ? `<a class="downloads-music-btn" href="${item.pptUrl}" target="_blank" rel="noopener noreferrer" aria-label="Baixar PowerPoint de ${item.title || ""}">PPT</a>` : ""}
            </div>
          </div>
        `).join("")}
    </section>
  `).join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  const input = document.getElementById("downloads-music-filter-input");
  try {
    const all = await listDownloadsByMusic(true);
    const render = (term = "") => {
      const normalized = String(term || "").trim().toLowerCase();
      const filtered = !normalized
        ? all
        : all.filter((item) => String(item.title || "").toLowerCase().includes(normalized));
      renderList(filtered);
    };

    render();
    input?.addEventListener("input", (event) => render(event.target.value));
  } catch (error) {
    console.error("Erro ao carregar downloads por música:", error);
    renderList([]);
  }
});
