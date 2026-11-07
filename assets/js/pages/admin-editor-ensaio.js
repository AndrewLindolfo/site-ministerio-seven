import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { normalizeText, explainFirebaseError } from "../db.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { listMusicas } from "../services/musicas-service.js";
import { createEnsaio, updateEnsaio, removeEnsaio, getEnsaio } from "../services/ensaios-service.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

const ensaioId = new URLSearchParams(window.location.search).get("id") || "";
const state = { musicas: [], selectedSongs: [] };
const els = {};
let currentAdmin = null;
let currentEnsaio = null;
let hasInitialized = false;

function waitForDom() {
  if (document.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => document.addEventListener("DOMContentLoaded", resolve, { once: true }));
}

function mapElements() {
  els.pageTitle = document.getElementById("editor-ensaio-title");
  els.form = document.getElementById("editor-ensaio-form");
  els.titulo = document.getElementById("ensaio-titulo");
  els.descricao = document.getElementById("ensaio-descricao");
  els.busca = document.getElementById("ensaio-busca-musica");
  els.searchResults = document.getElementById("ensaio-resultado-busca");
  els.selectedList = document.getElementById("ensaio-musicas-selecionadas");
  els.deleteButton = document.getElementById("delete-ensaio-button");
  els.saveButton = document.getElementById("salvar-ensaio-button");
  els.status = document.getElementById("admin-editor-ensaio-status");
}

function setStatus(message = "", isError = false) {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function canSave() {
  return Boolean(currentAdmin && hasPermission(currentAdmin, "ensaios", ensaioId ? "edit" : "create"));
}

function canDelete() {
  return Boolean(currentAdmin && ensaioId && hasPermission(currentAdmin, "ensaios", "delete"));
}

function applyPermissions() {
  els.saveButton?.classList.toggle("hidden", !canSave());
  els.deleteButton?.classList.toggle("hidden", !canDelete());
}

function renderMusicSearch() {
  if (!els.searchResults) return;
  const term = normalizeText(els.busca?.value || "");
  const selectedIds = new Set(state.selectedSongs.map((song) => song.id));
  const filtered = state.musicas
    .filter((song) => !selectedIds.has(song.id))
    .filter((song) => !term || normalizeText(`${song.title || ""} ${song.subtitle || ""}`).includes(term))
    .slice(0, 40);
  els.searchResults.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement("li");
    empty.className = "ensaio-search-empty";
    empty.textContent = term ? "Nenhuma música encontrada." : "Nenhuma música disponível para adicionar.";
    els.searchResults.append(empty);
    return;
  }
  filtered.forEach((song) => {
    const row = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ensaio-search-item";
    button.textContent = song.title || "Música sem título";
    button.addEventListener("click", () => {
      state.selectedSongs.push({ id: song.id, titulo: song.title || "Música sem título", slug: song.slug || "" });
      els.busca.value = "";
      renderMusicSearch();
      renderSelectedSongs();
    });
    row.append(button);
    els.searchResults.append(row);
  });
}

function makeActionButton(label, className, handler, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", handler);
  return button;
}

function moveSong(index, delta) {
  const next = index + delta;
  if (next < 0 || next >= state.selectedSongs.length) return;
  [state.selectedSongs[index], state.selectedSongs[next]] = [state.selectedSongs[next], state.selectedSongs[index]];
  renderSelectedSongs();
}

function renderSelectedSongs() {
  if (!els.selectedList) return;
  els.selectedList.replaceChildren();
  if (!state.selectedSongs.length) {
    const empty = document.createElement("li");
    empty.className = "ensaio-selected-empty";
    empty.textContent = "Nenhuma música adicionada ainda.";
    els.selectedList.append(empty);
    return;
  }
  state.selectedSongs.forEach((song, index) => {
    const row = document.createElement("li");
    row.className = "ensaio-selected-item";
    const title = document.createElement("span");
    title.textContent = `${index + 1}. ${song.titulo || "Música"}`;
    const actions = document.createElement("div");
    actions.className = "ensaio-selected-item__actions";
    actions.append(
      makeActionButton("↑", "btn-chip", () => moveSong(index, -1), index === 0),
      makeActionButton("↓", "btn-chip", () => moveSong(index, 1), index === state.selectedSongs.length - 1),
      makeActionButton("Remover", "btn-chip btn-chip--danger", () => {
        state.selectedSongs.splice(index, 1);
        renderSelectedSongs();
        renderMusicSearch();
      })
    );
    row.append(title, actions);
    els.selectedList.append(row);
  });
}

async function initializePage() {
  setStatus("Carregando editor…");
  state.musicas = await listMusicas(true);
  if (ensaioId) {
    currentEnsaio = await getEnsaio(ensaioId);
    if (!currentEnsaio) throw new Error("Ensaio não encontrado.");
    els.pageTitle.textContent = "Editar ensaio";
    els.saveButton.textContent = "Salvar alterações";
    els.titulo.value = currentEnsaio.titulo || "";
    els.descricao.value = currentEnsaio.descricao || "";
    state.selectedSongs = Array.isArray(currentEnsaio.musicas) ? [...currentEnsaio.musicas] : [];
  }
  renderMusicSearch();
  renderSelectedSongs();
  applyPermissions();
  setStatus("");
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!canSave()) return setStatus("Você não tem permissão para salvar este ensaio.", true);
  const titulo = els.titulo.value.trim();
  const descricao = els.descricao.value.trim();
  if (!titulo) return setStatus("Preencha o título do ensaio.", true);
  if (!state.selectedSongs.length) return setStatus("Adicione pelo menos uma música ao ensaio.", true);
  els.saveButton.disabled = true;
  try {
    setStatus("Salvando ensaio…");
    const payload = { titulo, descricao, musicas: state.selectedSongs };
    let savedId = ensaioId;
    if (ensaioId) await updateEnsaio(ensaioId, payload);
    else savedId = await createEnsaio(payload);
    await recordAdminActivity({ action: ensaioId ? "update" : "create", module: "ensaios", itemId: savedId, itemName: titulo });
    window.location.href = "./ensaios.html";
  } catch (error) {
    console.error("Erro ao salvar ensaio:", error);
    setStatus(explainFirebaseError(error), true);
    els.saveButton.disabled = false;
  }
}

async function handleDelete() {
  if (!canDelete()) return setStatus("Você não tem permissão para excluir este ensaio.", true);
  if (!confirm("Deseja excluir este ensaio?")) return;
  els.deleteButton.disabled = true;
  try {
    await removeEnsaio(ensaioId);
    await recordAdminActivity({ action: "delete", module: "ensaios", itemId: ensaioId, itemName: currentEnsaio?.titulo || "Ensaio" });
    window.location.href = "./ensaios.html";
  } catch (error) {
    console.error("Erro ao excluir ensaio:", error);
    setStatus(explainFirebaseError(error), true);
    els.deleteButton.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mapElements();
  els.busca?.addEventListener("input", renderMusicSearch);
  els.form?.addEventListener("submit", handleSubmit);
  els.deleteButton?.addEventListener("click", handleDelete);
});

watchAuth(async (user) => {
  if (!user?.uid || !user?.email) return;
  try {
    await waitForDom();
    currentAdmin = await getAdminProfileForUser(user);
    if (!currentAdmin) return;
    applyPermissions();
    if (!hasInitialized) {
      await initializePage();
      hasInitialized = true;
    }
  } catch (error) {
    console.error("Erro ao preparar o editor de ensaio:", error);
    setStatus(explainFirebaseError(error), true);
  }
});
