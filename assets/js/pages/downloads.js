import { listDownloads } from "../services/downloads-service.js";

function renderDownloads(grid, items = []) {
  grid.innerHTML = items.length ? items.map((item) => `
    <a class="destaque-box" href="${item.url || "#"}" target="_blank" rel="noopener noreferrer">
      ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.title}" loading="lazy" decoding="async" />` : ""}
      <strong>${item.title || ""}</strong>
      ${item.description ? `<p>${item.description}</p>` : ""}
    </a>
  `).join("") : "<p>Nenhum download disponível.</p>";
}

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("downloads-grid");
  if (!grid) return;

  grid.innerHTML = "<p>Carregando downloads...</p>";

  try {
    const items = await listDownloads(true);
    renderDownloads(grid, items);
  } catch (error) {
    console.error("Erro ao carregar downloads:", error);
    grid.innerHTML = "<p>Não foi possível carregar os downloads.</p>";
  }
});
