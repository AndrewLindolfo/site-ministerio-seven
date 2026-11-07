import { listAlbuns } from "../services/albuns-service.js";

function setMessage(grid, message) {
  grid.replaceChildren();
  const text = document.createElement("p");
  text.textContent = message;
  grid.appendChild(text);
}

function renderAlbuns(grid, items = []) {
  grid.replaceChildren();
  if (!items.length) {
    setMessage(grid, "Nenhum álbum disponível.");
    return;
  }
  for (const item of items) {
    const link = document.createElement("a");
    link.className = "destaque-box";
    link.href = item.albumUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    if (item.coverUrl) {
      const image = document.createElement("img");
      image.src = item.coverUrl;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      link.appendChild(image);
    }
    const title = document.createElement("strong");
    title.textContent = item.title;
    link.appendChild(title);
    grid.appendChild(link);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("albuns-grid");
  if (!grid) return;
  setMessage(grid, "Carregando álbuns...");
  try {
    renderAlbuns(grid, await listAlbuns(true));
  } catch (error) {
    console.error("Não foi possível carregar os álbuns.", error);
    setMessage(grid, "Não foi possível carregar os álbuns.");
  }
});
