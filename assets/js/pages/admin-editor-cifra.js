import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { hasPermission, getAllowedCifraInstruments, canManageCifraInstrument } from "../services/admin-permissions-service.js";
import { setCifraEditorHtml, getCifraEditorPlainText, getCifraEditorHtml } from "../editor.js";
import { listMusicas, getMusica } from "../services/musicas-service.js";
import { getCifra, saveCifra, findDuplicateCifraInstrument, removeCifra, normalizeChordColor, normalizeInstrument, getInstrumentLabel } from "../services/cifras-service.js";
import { normalizeText, explainFirebaseError } from "../db.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";
import { initAdminChordAssistant } from "../modules/admin-chord-assistant.js";

const cifraId = new URLSearchParams(window.location.search).get("id") || "";
let selectedMusicaId = "";
let selectedMusica = null;
let currentAdmin = null;
let currentCifra = null;
let allMusicas = [];
let hasInitialized = false;

function setStatus(message = "", isError = false) {
  const status = document.getElementById("admin-editor-cifra-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function canSaveCifra() {
  if (!currentAdmin) return false;
  return hasPermission(currentAdmin, "cifras", cifraId ? "edit" : "create") && getAllowedCifraInstruments(currentAdmin).length > 0;
}

function canDeleteCifra() {
  return Boolean(currentAdmin && cifraId && hasPermission(currentAdmin, "cifras", "delete") && currentCifra && canManageCifraInstrument(currentAdmin, currentCifra.instrumento));
}

function setSelectedMusic(item) {
  selectedMusicaId = item?.id || "";
  selectedMusica = item || null;
  const input = document.getElementById("cifra-musica-search");
  const box = document.getElementById("cifra-musica-resultados");
  if (input) input.value = item?.title || "";
  if (!box) return;
  box.replaceChildren();
  if (!item) return;
  const message = document.createElement("p");
  message.append("Música vinculada: ");
  const title = document.createElement("strong");
  title.textContent = item.title || "Música";
  message.append(title);
  box.append(message);
}

function renderMusicSearch(term = "") {
  const box = document.getElementById("cifra-musica-resultados");
  if (!box) return;
  const query = normalizeText(term);
  const matches = allMusicas.filter((item) => normalizeText(`${item.title} ${item.subtitle}`).includes(query)).slice(0, 8);
  box.replaceChildren();
  matches.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button-outline";
    button.textContent = item.title;
    button.addEventListener("click", () => setSelectedMusic(item));
    box.append(button);
  });
  if (query && !matches.length) {
    const empty = document.createElement("p");
    empty.textContent = "Nenhuma música encontrada.";
    box.append(empty);
  }
}

function setInstrumentOptions(preferred = "") {
  const select = document.getElementById("cifra-instrumento");
  if (!select) return;
  const allowed = getAllowedCifraInstruments(currentAdmin);
  [...select.options].forEach((option) => {
    option.hidden = !allowed.includes(option.value);
    option.disabled = !allowed.includes(option.value);
  });
  const normalizedPreferred = normalizeInstrument(preferred || select.value);
  select.value = allowed.includes(normalizedPreferred) ? normalizedPreferred : (allowed[0] || "");
}

function setFieldAccess(id, permission) {
  const element = document.getElementById(id);
  if (!element) return;
  element.classList.toggle("hidden", !permission);
  element.disabled = !permission;
}

function applyPermissions() {
  const allowed = getAllowedCifraInstruments(currentAdmin);
  setInstrumentOptions(currentCifra?.instrumento || "");
  setFieldAccess("cifra-capo", hasPermission(currentAdmin, "cifras", "capo"));
  setFieldAccess("cifra-bpm", hasPermission(currentAdmin, "cifras", "bpm"));
  setFieldAccess("cifra-compasso", hasPermission(currentAdmin, "cifras", "compasso"));
  setFieldAccess("cifra-instrumento", allowed.length > 0);
  document.querySelector('#admin-editor-cifra-form button[type="submit"]')?.classList.toggle("hidden", !canSaveCifra());
  document.getElementById("delete-cifra-button")?.classList.toggle("hidden", !canDeleteCifra());
}

function waitForEditor(timeout = 5000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      if (window.tinymce?.get("cifra-conteudo")) return resolve(true);
      if (Date.now() - started >= timeout) return resolve(false);
      setTimeout(check, 120);
    };
    check();
  });
}

async function initializeEditor() {
  setStatus("Carregando editor…");
  allMusicas = await listMusicas(true);
  if (!cifraId) {
    setInstrumentOptions();
    renderMusicSearch("");
    applyPermissions();
    setStatus("");
    return;
  }

  currentCifra = await getCifra(cifraId);
  if (!currentCifra) throw new Error("Cifra não encontrada.");
  if (!canManageCifraInstrument(currentAdmin, currentCifra.instrumento)) throw new Error("Você não tem permissão para gerenciar cifras deste instrumento.");

  const linkedMusic = allMusicas.find((item) => item.id === currentCifra.musicaId) || await getMusica(currentCifra.musicaId);
  setSelectedMusic(linkedMusic || { id: currentCifra.musicaId, title: currentCifra.title });
  document.getElementById("cifra-tom").value = currentCifra.originalKey || "";
  document.getElementById("cifra-capo").value = currentCifra.capo || "";
  document.getElementById("cifra-bpm").value = currentCifra.bpm || "";
  document.getElementById("cifra-compasso").value = currentCifra.compasso || "";
  document.getElementById("cifra-chord-color").value = normalizeChordColor(currentCifra.chordColor);
  setInstrumentOptions(currentCifra.instrumento);
  applyPermissions();
  await waitForEditor();
  setCifraEditorHtml(String(currentCifra.cifraHtml || currentCifra.cifraText || "").replace(/\r\n?/g, "\n"));
  setStatus("");
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminChordAssistant({ getSelectedMusic: () => selectedMusica });
  document.getElementById("cifra-musica-search")?.addEventListener("input", (event) => {
    selectedMusicaId = "";
    selectedMusica = null;
    renderMusicSearch(event.target.value);
  });

  document.getElementById("admin-editor-cifra-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canSaveCifra()) return setStatus("Você não tem permissão para salvar esta cifra.", true);
    if (!selectedMusicaId) return setStatus("Selecione uma música vinculada.", true);
    const submit = event.target.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const instrument = normalizeInstrument(document.getElementById("cifra-instrumento")?.value || currentCifra?.instrumento);
      if (!canManageCifraInstrument(currentAdmin, instrument)) throw new Error("Você não tem permissão para este instrumento.");
      const music = allMusicas.find((item) => item.id === selectedMusicaId) || await getMusica(selectedMusicaId);
      if (!music) throw new Error("A música vinculada não existe ou está inativa.");
      const duplicate = await findDuplicateCifraInstrument(selectedMusicaId, instrument, cifraId);
      if (duplicate) {
        if (confirm(`Já existe uma cifra de ${getInstrumentLabel(instrument)} para esta música. Deseja editá-la?`)) {
          window.location.href = `./editor-cifra.html?id=${encodeURIComponent(duplicate.id)}`;
        }
        return;
      }
      const canCapo = hasPermission(currentAdmin, "cifras", "capo");
      const canBpm = hasPermission(currentAdmin, "cifras", "bpm");
      const canCompasso = hasPermission(currentAdmin, "cifras", "compasso");
      const bpm = canBpm ? document.getElementById("cifra-bpm").value.trim() : (currentCifra?.bpm || "");
      const compasso = canCompasso ? document.getElementById("cifra-compasso").value.trim() : (currentCifra?.compasso || "");
      if ((bpm && !compasso) || (!bpm && compasso)) throw new Error("BPM e compasso devem ser preenchidos juntos.");
      const payload = {
        musicaId: selectedMusicaId,
        title: music.title,
        subtitle: music.subtitle || "",
        cifraText: getCifraEditorPlainText().replace(/\r\n?/g, "\n"),
        cifraHtml: getCifraEditorHtml(),
        originalKey: document.getElementById("cifra-tom").value.trim(),
        capo: canCapo ? document.getElementById("cifra-capo").value.trim() : (currentCifra?.capo || ""),
        bpm,
        compasso,
        instrumento: instrument,
        chordColor: normalizeChordColor(document.getElementById("cifra-chord-color").value),
        active: cifraId ? currentCifra?.active !== false : true
      };
      setStatus("Salvando cifra…");
      const savedId = await saveCifra(payload, cifraId);
      await recordAdminActivity({ action: cifraId ? "update" : "create", module: "cifras", itemId: savedId, itemName: `${music.title} (${getInstrumentLabel(instrument)})` });
      window.location.href = "./cifras.html";
    } catch (error) {
      console.error("Erro ao salvar cifra:", error);
      setStatus(explainFirebaseError(error), true);
    } finally {
      submit.disabled = false;
    }
  });

  document.getElementById("delete-cifra-button")?.addEventListener("click", async (event) => {
    if (!canDeleteCifra()) return setStatus("Você não tem permissão para excluir esta cifra.", true);
    if (!confirm("Deseja excluir esta cifra?")) return;
    event.currentTarget.disabled = true;
    try {
      await removeCifra(cifraId);
      await recordAdminActivity({ action: "delete", module: "cifras", itemId: cifraId, itemName: currentCifra?.title || "Cifra" });
      window.location.href = "./cifras.html";
    } catch (error) {
      console.error("Erro ao excluir cifra:", error);
      setStatus(explainFirebaseError(error), true);
      event.currentTarget.disabled = false;
    }
  });
});

watchAuth(async (user) => {
  if (!user?.uid || !user?.email) return;
  try {
    currentAdmin = await getAdminProfileForUser(user);
    if (!currentAdmin) return;
    if (!hasInitialized) {
      await initializeEditor();
      hasInitialized = true;
    } else {
      applyPermissions();
    }
  } catch (error) {
    console.error("Erro ao preparar o editor de cifra:", error);
    setStatus(explainFirebaseError(error), true);
  }
});
