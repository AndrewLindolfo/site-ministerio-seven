import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { explainFirebaseError } from "../db.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { listModoEnsaios, listModoEnsaioSongs, removeModoEnsaio } from "../services/modo-ensaio-service.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

let admin = null;
let sessions = [];
const status = document.getElementById("modo-ensaio-status");
const list = document.getElementById("modo-ensaio-list");

function setStatus(message, error = false) { status.textContent = message || ""; status.classList.toggle("error", error); }

async function copyLink(id, button) {
  const url = new URL("/modo-ensaio.html", window.location.origin); url.searchParams.set("id", id);
  try { await navigator.clipboard.writeText(url.href); button.textContent = "Link copiado!"; setTimeout(() => button.textContent = "Copiar link", 1600); }
  catch { window.prompt("Copie o link:", url.href); }
}

async function render() {
  list.replaceChildren();
  for (const item of sessions) {
    const songs = await listModoEnsaioSongs(item.id);
    const card = document.createElement("article"); card.className = "modo-admin-card";
    const meta = [item.date ? new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR") : "", item.time, item.location].filter(Boolean).join(" • ");
    card.innerHTML = `<div><div class="modo-status-pill ${item.active ? "is-active" : ""}">${item.active ? "Link ativo" : "Rascunho"}</div><h2></h2><p class="modo-admin-meta"></p><p>${songs.length} música(s)</p></div><div class="modo-card-actions"></div>`;
    card.querySelector("h2").textContent = item.title || "Sem título"; card.querySelector(".modo-admin-meta").textContent = meta;
    const actions = card.querySelector(".modo-card-actions");
    if (item.active) { const open = document.createElement("a"); open.className = "button-outline"; open.href = `../modo-ensaio.html?id=${encodeURIComponent(item.id)}`; open.target = "_blank"; open.textContent = "Abrir"; actions.append(open); const copy = document.createElement("button"); copy.type = "button"; copy.className = "button-outline"; copy.textContent = "Copiar link"; copy.onclick = () => copyLink(item.id, copy); actions.append(copy); }
    if (hasPermission(admin, "ensaios", "edit")) { const edit = document.createElement("a"); edit.className = "button-primary"; edit.href = `./editor-modo-ensaio.html?id=${encodeURIComponent(item.id)}`; edit.textContent = "Editar"; actions.append(edit); }
    if (hasPermission(admin, "ensaios", "delete")) { const remove = document.createElement("button"); remove.type = "button"; remove.className = "button-danger"; remove.textContent = "Excluir"; remove.onclick = async () => { if (!confirm(`Excluir “${item.title}”?`)) return; remove.disabled = true; try { await removeModoEnsaio(item.id); await recordAdminActivity({ action: "delete", module: "modo-ensaio", itemId: item.id, itemName: item.title }); sessions = sessions.filter((row) => row.id !== item.id); await render(); } catch (error) { setStatus(explainFirebaseError(error), true); remove.disabled = false; } }; actions.append(remove); }
    list.append(card);
  }
  if (!sessions.length) list.innerHTML = `<div class="modo-empty">Nenhum modo ensaio criado ainda.</div>`;
  setStatus(`${sessions.length} modo(s) ensaio cadastrado(s).`);
}

watchAuth(async (user) => { if (!user) return; try { admin = await getAdminProfileForUser(user); document.getElementById("btn-novo-modo-ensaio").classList.toggle("hidden", !hasPermission(admin, "ensaios", "create")); setStatus("Carregando…"); sessions = await listModoEnsaios(); await render(); } catch (error) { setStatus(explainFirebaseError(error), true); } });
