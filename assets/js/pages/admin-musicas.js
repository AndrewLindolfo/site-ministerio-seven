import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { normalizeText, explainFirebaseError } from "../db.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { listMusicas, removeMusica } from "../services/musicas-service.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

let currentAdmin = null;
let allMusicas = [];
let hasLoaded = false;

function setStatus(message = "", isError = false) {
  const status = document.getElementById("admin-musicas-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function buildMusicCard(item) {
  const card = document.createElement("div");
  card.className = "admin-list-card";

  const details = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = item.title || "Música sem título";
  details.append(title);

  if (item.subtitle) {
    const subtitle = document.createElement("p");
    subtitle.textContent = item.subtitle;
    details.append(subtitle);
  }

  const actions = document.createElement("div");
  actions.className = "admin-list-actions";

  if (hasPermission(currentAdmin, "musicas", "edit")) {
    const edit = document.createElement("a");
    edit.className = "button-outline";
    edit.href = `./editor-musica.html?id=${encodeURIComponent(item.id)}`;
    edit.textContent = "Editar";
    actions.append(edit);
  }

  if (hasPermission(currentAdmin, "musicas", "delete")) {
    const remove = document.createElement("button");
    remove.className = "button-danger";
    remove.type = "button";
    remove.textContent = "Excluir";
    remove.addEventListener("click", async () => {
      if (!confirm(`Deseja excluir a música “${item.title || "Sem título"}”?`)) return;
      remove.disabled = true;
      try {
        await removeMusica(item.id);
        await recordAdminActivity({ action: "delete", module: "musicas", itemId: item.id, itemName: item.title || "Música" });
        allMusicas = allMusicas.filter((entry) => entry.id !== item.id);
        renderMusicas();
        setStatus("Música excluída com sucesso.");
      } catch (error) {
        console.error("Erro ao excluir música:", error);
        setStatus(explainFirebaseError(error), true);
        remove.disabled = false;
      }
    });
    actions.append(remove);
  }

  card.append(details, actions);
  return card;
}

function renderMusicas() {
  const box = document.getElementById("admin-musicas-list");
  const search = document.getElementById("admin-musicas-search");
  if (!box || !currentAdmin) return;

  const term = normalizeText(search?.value || "");
  const filtered = allMusicas.filter((item) => normalizeText(`${item.title || ""} ${item.subtitle || ""}`).includes(term));
  box.replaceChildren(...filtered.map(buildMusicCard));

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.textContent = term ? "Nenhuma música encontrada." : "Nenhuma música cadastrada.";
    box.append(empty);
  }
  setStatus(`${filtered.length} música(s) exibida(s).`);
}

async function loadMusicas() {
  setStatus("Carregando músicas…");
  try {
    allMusicas = await listMusicas(false);
    hasLoaded = true;
    renderMusicas();
  } catch (error) {
    console.error("Erro ao carregar músicas:", error);
    setStatus(explainFirebaseError(error), true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("admin-musicas-search")?.addEventListener("input", renderMusicas);
});

watchAuth(async (user) => {
  if (!user?.uid || !user?.email) return;
  try {
    currentAdmin = await getAdminProfileForUser(user);
    if (!currentAdmin) return;
    document.querySelector(".admin-toolbar .button-primary")?.classList.toggle("hidden", !hasPermission(currentAdmin, "musicas", "create"));
    if (hasLoaded) renderMusicas();
    else await loadMusicas();
  } catch (error) {
    console.error("Erro ao preparar a gestão de músicas:", error);
    setStatus(explainFirebaseError(error), true);
  }
});
