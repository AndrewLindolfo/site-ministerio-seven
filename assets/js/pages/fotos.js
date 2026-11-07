import { listAlbuns } from "../services/albuns-service.js";

function renderAlbuns(grid, items = []) {
  grid.innerHTML = items.length ? items.map((item) => `
    <a class="destaque-box" href="${item.albumUrl || "#"}" target="_blank" rel="noopener noreferrer">
      ${item.coverUrl ? `<img src="${item.coverUrl}" alt="${item.title}" loading="lazy" decoding="async" />` : ""}
      <strong>${item.title || ""}</strong>
    </a>
  `).join("") : "<p>Nenhum álbum disponível.</p>";
}

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("albuns-grid");
  if (!grid) return;

  grid.innerHTML = "<p>Carregando álbuns...</p>";

  try {
    const items = await listAlbuns(true);
    renderAlbuns(grid, items);
  } catch (error) {
    console.error("Erro ao carregar álbuns:", error);
    grid.innerHTML = "<p>Não foi possível carregar os álbuns.</p>";
  }
});
