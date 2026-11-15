import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { explainFirebaseError, normalizeText } from "../db.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { listMusicas } from "../services/musicas-service.js";
import { listCifras, getInstrumentLabel } from "../services/cifras-service.js";
import { createModoEnsaio, getModoEnsaio, listModoEnsaioSongs, removeModoEnsaio, updateModoEnsaio } from "../services/modo-ensaio-service.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

const id = new URLSearchParams(location.search).get("id") || "";
const state = { musicas: [], cifras: [], selected: [] };
const byId = (value) => document.getElementById(value);
const els = {};
let admin = null;
let userUid = "";
let session = null;
let initialized = false;

function map() { ["title", "date", "time", "location", "description", "active", "search", "search-results", "selected-songs", "editor-status", "save", "delete", "open-public"].forEach((key) => els[key] = byId(`modo-${key}`)); els.form = byId("modo-editor-form"); }
function setStatus(message, error = false) { els["editor-status"].textContent = message || ""; els["editor-status"].classList.toggle("error", error); }
function can(action) { return hasPermission(admin, "ensaios", action); }
function variants(musicaId) { return state.cifras.filter((item) => item.musicaId === musicaId); }

function addSong(music) {
  const options = variants(music.id); const cifra = options[0] || {};
  state.selected.push({ musicaId: music.id, title: music.title, slug: music.slug || "", cifraId: cifra.id || "", cifraTitle: cifra.title || "", instrumento: cifra.instrumento || "violao", bpm: cifra.bpm || "", compasso: cifra.compasso || "", originalKey: cifra.originalKey || music.originalKey || "", notes: "" });
  els.search.value = ""; renderSearch(); renderSelected();
}

function renderSearch() {
  const term = normalizeText(els.search.value); const used = new Set(state.selected.map((item) => item.musicaId));
  const rows = state.musicas.filter((item) => !used.has(item.id)).filter((item) => !term || normalizeText(`${item.title} ${item.subtitle || ""} ${item.author || ""}`).includes(term)).slice(0, 40);
  els["search-results"].replaceChildren();
  rows.forEach((music) => { const li = document.createElement("li"); const button = document.createElement("button"); button.type = "button"; button.className = "modo-search-item"; button.innerHTML = `<strong></strong><small></small>`; button.querySelector("strong").textContent = music.title; button.querySelector("small").textContent = variants(music.id).length ? `${variants(music.id).length} cifra(s) disponível(is)` : "Somente letra"; button.onclick = () => addSong(music); li.append(button); els["search-results"].append(li); });
  if (!rows.length) els["search-results"].innerHTML = `<li class="modo-empty-inline">Nenhuma música disponível.</li>`;
}

function move(index, delta) { const next = index + delta; if (next < 0 || next >= state.selected.length) return; [state.selected[index], state.selected[next]] = [state.selected[next], state.selected[index]]; renderSelected(); }

function renderSelected() {
  els["selected-songs"].replaceChildren();
  state.selected.forEach((song, index) => {
    const row = document.createElement("li"); row.className = "modo-selected-item";
    const header = document.createElement("div"); header.className = "modo-song-header"; const title = document.createElement("strong"); title.textContent = `${index + 1}. ${song.title}`; const actions = document.createElement("div");
    [["↑", () => move(index, -1), index === 0], ["↓", () => move(index, 1), index === state.selected.length - 1], ["Remover", () => { state.selected.splice(index, 1); renderSelected(); renderSearch(); }, false]].forEach(([label, handler, disabled]) => { const button = document.createElement("button"); button.type = "button"; button.className = label === "Remover" ? "btn-chip btn-chip--danger" : "btn-chip"; button.textContent = label; button.disabled = disabled; button.onclick = handler; actions.append(button); }); header.append(title, actions);
    const controls = document.createElement("div"); controls.className = "modo-song-controls"; const label = document.createElement("label"); label.innerHTML = `<span>Cifra para o palco</span>`; const select = document.createElement("select"); const none = document.createElement("option"); none.value = ""; none.textContent = "Somente letra"; select.append(none); variants(song.musicaId).forEach((cifra) => { const option = document.createElement("option"); option.value = cifra.id; option.textContent = `${getInstrumentLabel(cifra.instrumento)} — ${cifra.originalKey || "sem tom"}`; option.selected = cifra.id === song.cifraId; select.append(option); }); select.onchange = () => { const cifra = state.cifras.find((item) => item.id === select.value) || {}; Object.assign(song, { cifraId: cifra.id || "", cifraTitle: cifra.title || "", instrumento: cifra.instrumento || "violao", bpm: cifra.bpm || "", compasso: cifra.compasso || "", originalKey: cifra.originalKey || "" }); }; label.append(select); const note = document.createElement("label"); note.innerHTML = `<span>Observação para esta música</span>`; const input = document.createElement("input"); input.maxLength = 2000; input.placeholder = "Ex.: começar suave; repetir refrão 2x"; input.value = song.notes || ""; input.oninput = () => song.notes = input.value; note.append(input); controls.append(label, note); row.append(header, controls); els["selected-songs"].append(row);
  });
  if (!state.selected.length) els["selected-songs"].innerHTML = `<li class="modo-empty-inline">Adicione músicas pela busca ao lado.</li>`;
}

function payload() { return { title: els.title.value, date: els.date.value, time: els.time.value, location: els.location.value, description: els.description.value, active: els.active.checked, songs: state.selected }; }

async function initialize() {
  setStatus("Carregando músicas e cifras…"); [state.musicas, state.cifras] = await Promise.all([listMusicas(true), listCifras(true)]);
  if (id) { session = await getModoEnsaio(id); if (!session) throw new Error("Modo ensaio não encontrado."); state.selected = await listModoEnsaioSongs(id); els.title.value = session.title; els.date.value = session.date; els.time.value = session.time; els.location.value = session.location; els.description.value = session.description; els.active.checked = session.active; byId("modo-editor-title").textContent = "Editar modo ensaio"; els.save.textContent = "Salvar alterações"; els["open-public"].href = `../modo-ensaio.html?id=${encodeURIComponent(id)}`; els["open-public"].classList.toggle("hidden", !session.active); }
  els.save.classList.toggle("hidden", !can(id ? "edit" : "create")); els.delete.classList.toggle("hidden", !(id && can("delete"))); renderSearch(); renderSelected(); setStatus("");
}

async function submit(event) { event.preventDefault(); if (!can(id ? "edit" : "create")) return setStatus("Você não tem permissão para salvar.", true); if (!els.title.value.trim()) return setStatus("Informe o título.", true); if (!state.selected.length) return setStatus("Adicione pelo menos uma música.", true); els.save.disabled = true; try { setStatus("Salvando…"); const savedId = id ? await updateModoEnsaio(id, payload()) : await createModoEnsaio(payload(), userUid); await recordAdminActivity({ action: id ? "update" : "create", module: "modo-ensaio", itemId: savedId, itemName: els.title.value.trim() }); location.href = "./modo-ensaio.html"; } catch (error) { setStatus(explainFirebaseError(error), true); els.save.disabled = false; } }
async function remove() { if (!id || !can("delete") || !confirm("Excluir este modo ensaio?")) return; els.delete.disabled = true; try { await removeModoEnsaio(id); await recordAdminActivity({ action: "delete", module: "modo-ensaio", itemId: id, itemName: session?.title || "Modo ensaio" }); location.href = "./modo-ensaio.html"; } catch (error) { setStatus(explainFirebaseError(error), true); els.delete.disabled = false; } }

document.addEventListener("DOMContentLoaded", () => { map(); els.search.addEventListener("input", renderSearch); els.form.addEventListener("submit", submit); els.delete.addEventListener("click", remove); });
watchAuth(async (user) => { if (!user || initialized) return; try { while (!els.form) await new Promise((resolve) => setTimeout(resolve, 10)); userUid = user.uid; admin = await getAdminProfileForUser(user); await initialize(); initialized = true; } catch (error) { setStatus(explainFirebaseError(error), true); } });
