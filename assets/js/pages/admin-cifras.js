import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { normalizeText, explainFirebaseError } from "../db.js";
import { hasPermission, canManageCifraInstrument } from "../services/admin-permissions-service.js";
import { listCifras, removeCifra, getInstrumentLabel } from "../services/cifras-service.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

let currentAdmin = null;
let allCifras = [];
let hasLoaded = false;

function setStatus(message = "", isError = false) {
  const status = document.getElementById("admin-cifras-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function groupCifras(items = []) {
  const groups = new Map();
  items.forEach((item) => {
    const key = item.musicaId || `${item.slug || ""}::${item.title || ""}`;
    const group = groups.get(key);
    if (group) group.variants.push(item);
    else groups.set(key, { key, title: item.title || "", subtitle: item.subtitle || "", variants: [item] });
  });
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

function createChooser() {
  const overlay = document.createElement("div");
  overlay.className = "admin-cifra-chooser-overlay";
  overlay.innerHTML = `
    <div class="admin-cifra-chooser-backdrop" data-close="true"></div>
    <div class="admin-cifra-chooser-card" role="dialog" aria-modal="true" aria-labelledby="admin-cifra-chooser-title">
      <button type="button" class="admin-cifra-chooser-close" data-close="true" aria-label="Fechar">✕</button>
      <h3 id="admin-cifra-chooser-title">Escolha o instrumento</h3>
      <p class="admin-cifra-chooser-subtitle"></p>
      <div class="admin-cifra-chooser-options"></div>
    </div>`;
  document.body.append(overlay);
  return overlay;
}

function chooseInstrument(title, variants = []) {
  if (!variants.length) return Promise.resolve(null);
  if (variants.length === 1) return Promise.resolve(variants[0]);

  const overlay = createChooser();
  overlay.querySelector(".admin-cifra-chooser-subtitle").textContent = `Selecione a variante de instrumento para “${title}”.`;
  const options = overlay.querySelector(".admin-cifra-chooser-options");
  const sorted = [...variants].sort((a, b) => getInstrumentLabel(a.instrumento).localeCompare(getInstrumentLabel(b.instrumento), "pt-BR"));

  return new Promise((resolve) => {
    const finish = (result = null) => {
      document.removeEventListener("keydown", onKeydown);
      overlay.remove();
      resolve(result);
    };
    const onKeydown = (event) => {
      if (event.key === "Escape") finish(null);
    };
    sorted.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-cifra-chooser-option";
      button.textContent = getInstrumentLabel(item.instrumento || "violao");
      button.addEventListener("click", () => finish(item), { once: true });
      options.append(button);
    });
    overlay.querySelectorAll("[data-close='true']").forEach((element) => element.addEventListener("click", () => finish(null), { once: true }));
    document.addEventListener("keydown", onKeydown);
    options.querySelector("button")?.focus();
  });
}

function buildCard(group) {
  const card = document.createElement("div");
  card.className = "admin-list-card";
  const details = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = group.title || "Cifra sem título";
  details.append(title);
  if (group.subtitle) {
    const subtitle = document.createElement("p");
    subtitle.textContent = group.subtitle;
    details.append(subtitle);
  }
  const actions = document.createElement("div");
  actions.className = "admin-list-actions";
  if (hasPermission(currentAdmin, "cifras", "edit")) {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "button-outline";
    edit.textContent = "Editar";
    edit.addEventListener("click", async () => {
      const selected = await chooseInstrument(group.title, group.variants);
      if (selected) window.location.href = `./editor-cifra.html?id=${encodeURIComponent(selected.id)}`;
    });
    actions.append(edit);
  }
  if (hasPermission(currentAdmin, "cifras", "delete")) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button-danger";
    remove.textContent = "Excluir";
    remove.addEventListener("click", async () => {
      const selected = await chooseInstrument(group.title, group.variants);
      if (!selected || !confirm(`Deseja excluir a cifra de ${getInstrumentLabel(selected.instrumento)}?`)) return;
      remove.disabled = true;
      try {
        await removeCifra(selected.id);
        await recordAdminActivity({ action: "delete", module: "cifras", itemId: selected.id, itemName: selected.title || group.title || "Cifra", details: `Instrumento: ${getInstrumentLabel(selected.instrumento)}` });
        allCifras = allCifras.filter((item) => item.id !== selected.id);
        renderCifras();
        setStatus("Cifra excluída com sucesso.");
      } catch (error) {
        console.error("Erro ao excluir cifra:", error);
        setStatus(explainFirebaseError(error), true);
        remove.disabled = false;
      }
    });
    actions.append(remove);
  }
  card.append(details, actions);
  return card;
}

function renderCifras() {
  const box = document.getElementById("admin-cifras-list");
  if (!box || !currentAdmin) return;
  const term = normalizeText(document.getElementById("admin-cifras-search")?.value || "");
  const visible = allCifras.filter((item) => canManageCifraInstrument(currentAdmin, item.instrumento || "violao"));
  const filtered = groupCifras(visible).filter((group) => normalizeText(`${group.title} ${group.subtitle}`).includes(term));
  box.replaceChildren(...filtered.map(buildCard));
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.textContent = term ? "Nenhuma cifra encontrada." : "Nenhuma cifra cadastrada.";
    box.append(empty);
  }
  setStatus(`${filtered.length} música(s) com cifra exibida(s).`);
}

async function loadCifras() {
  setStatus("Carregando cifras…");
  try {
    allCifras = await listCifras(false);
    hasLoaded = true;
    renderCifras();
  } catch (error) {
    console.error("Erro ao carregar cifras:", error);
    setStatus(explainFirebaseError(error), true);
  }
}

document.addEventListener("DOMContentLoaded", () => document.getElementById("admin-cifras-search")?.addEventListener("input", renderCifras));

watchAuth(async (user) => {
  if (!user?.uid || !user?.email) return;
  try {
    currentAdmin = await getAdminProfileForUser(user);
    if (!currentAdmin) return;
    document.querySelector(".admin-toolbar .button-primary")?.classList.toggle("hidden", !hasPermission(currentAdmin, "cifras", "create"));
    if (hasLoaded) renderCifras();
    else await loadCifras();
  } catch (error) {
    console.error("Erro ao preparar a gestão de cifras:", error);
    setStatus(explainFirebaseError(error), true);
  }
});
