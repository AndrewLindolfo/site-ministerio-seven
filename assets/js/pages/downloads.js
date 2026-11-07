import { listDownloads } from "../services/downloads-service.js";

function setMessage(grid, message) {
  grid.replaceChildren();
  const text = document.createElement("p");
  text.textContent = message;
  grid.appendChild(text);
}

function renderDownloads(grid, items = []) {
  grid.replaceChildren();
  if (!items.length) {
    setMessage(grid, "Nenhum download disponível.");
    return;
  }

  for (const item of items) {
    const link = document.createElement("a");
    link.className = "destaque-box";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    if (item.imageUrl) {
      const image = document.createElement("img");
      image.src = item.imageUrl;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      link.appendChild(image);
    }
    const title = document.createElement("strong");
    title.textContent = item.title;
    link.appendChild(title);
    if (item.description) {
      const description = document.createElement("p");
      description.textContent = item.description;
      link.appendChild(description);
    }
    grid.appendChild(link);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("downloads-grid");
  if (!grid) return;
  setMessage(grid, "Carregando downloads...");
  try {
    renderDownloads(grid, await listDownloads(true));
  } catch (error) {
    console.error("Não foi possível carregar os downloads.", error);
    setMessage(grid, "Não foi possível carregar os downloads.");
  }
});
