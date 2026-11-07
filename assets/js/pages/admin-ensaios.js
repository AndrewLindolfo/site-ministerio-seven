import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { explainFirebaseError } from "../db.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { listEnsaios, removeEnsaio } from "../services/ensaios-service.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

let currentAdmin = null;
let allEnsaios = [];

function setStatus(message = "", isError = false) {
  const status = document.getElementById("admin-ensaios-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function buildEnsaioCard(item) {
  const card = document.createElement("div");
  card.className = "admin-list-card";
  const details = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = item.titulo || "Ensaio sem título";
  details.append(title);

  if (item.descricao) {
    const description = document.createElement("p");
    description.className = "ensaio-item__description";
    description.textContent = item.descricao;
    details.append(description);
  }

  if (item.musicas?.length) {
    const songs = document.createElement("ol");
    songs.className = "ensaio-item__songs";
    item.musicas.forEach((song) => {
      const row = document.createElement("li");
      row.textContent = song.titulo || "Música";
      songs.append(row);
    });
    details.append(songs);
  } else {
    const empty = document.createElement("p");
    empty.className = "ensaio-item__empty";
    empty.textContent = "Nenhuma música vinculada.";
    details.append(empty);
  }

  const actions = document.createElement("div");
  actions.className = "admin-list-actions";
  if (hasPermission(currentAdmin, "ensaios", "edit")) {
    const edit = document.createElement("a");
    edit.className = "button-outline";
    edit.href = `./editor-ensaio.html?id=${encodeURIComponent(item.id)}`;
    edit.textContent = "Editar";
    actions.append(edit);
  }
  if (hasPermission(currentAdmin, "ensaios", "delete")) {
    const remove = document.createElement("button");
    remove.className = "button-danger";
    remove.type = "button";
    remove.textContent = "Excluir";
    remove.addEventListener("click", async () => {
      if (!confirm(`Deseja excluir o ensaio “${item.titulo || "Sem título"}”?`)) return;
      remove.disabled = true;
      try {
        await removeEnsaio(item.id);
        await recordAdminActivity({ action: "delete", module: "ensaios", itemId: item.id, itemName: item.titulo || "Ensaio" });
        allEnsaios = allEnsaios.filter((entry) => entry.id !== item.id);
        renderEnsaios();
        setStatus("Ensaio excluído com sucesso.");
      } catch (error) {
        console.error("Erro ao excluir ensaio:", error);
        setStatus(explainFirebaseError(error), true);
        remove.disabled = false;
      }
    });
    actions.append(remove);
  }
  card.append(details, actions);
  return card;
}

function renderEnsaios() {
  const box = document.getElementById("admin-ensaios-list");
  if (!box || !currentAdmin) return;
  box.replaceChildren(...allEnsaios.map(buildEnsaioCard));
  if (!allEnsaios.length) {
    const empty = document.createElement("div");
    empty.className = "admin-list-card";
    empty.textContent = "Nenhum ensaio cadastrado.";
    box.append(empty);
  }
  setStatus(`${allEnsaios.length} ensaio(s) cadastrado(s).`);
}

async function loadEnsaios() {
  setStatus("Carregando ensaios…");
  try {
    allEnsaios = await listEnsaios();
    renderEnsaios();
  } catch (error) {
    console.error("Erro ao carregar ensaios:", error);
    setStatus(explainFirebaseError(error), true);
  }
}

watchAuth(async (user) => {
  if (!user?.uid || !user?.email) return;
  try {
    currentAdmin = await getAdminProfileForUser(user);
    if (!currentAdmin) return;
    document.getElementById("btn-novo-ensaio")?.classList.toggle("hidden", !hasPermission(currentAdmin, "ensaios", "create"));
    await loadEnsaios();
  } catch (error) {
    console.error("Erro ao preparar ensaios:", error);
    setStatus(explainFirebaseError(error), true);
  }
});
