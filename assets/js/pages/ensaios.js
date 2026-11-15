import { explainFirebaseError } from "../db.js";
import { openPublicAuthModal, watchPublicAuth } from "../public-auth.js";
import { getMemberProfileForUser, memberHasPermission } from "../services/member-permissions-service.js";
import { listAllModoEnsaioSongs, listModoEnsaios, removeModoEnsaio } from "../services/modo-ensaio-service.js";

const $ = (selector) => document.querySelector(selector);
let member = null;
let sessions = [];

function setStatus(message = "", error = false) {
  $("#member-rehearsals-status").textContent = message;
  $("#member-rehearsals-status").classList.toggle("error", error);
}

function showDenied() {
  $("#member-rehearsals-list").replaceChildren();
  $("#member-new-rehearsal").classList.add("hidden");
  $("#member-access-denied").classList.remove("hidden");
  setStatus("");
}

async function copyLink(id, button) {
  const url = new URL("/modo-ensaio", location.origin);
  url.searchParams.set("id", id);
  try {
    await navigator.clipboard.writeText(url.href);
    button.textContent = "Link copiado!";
    setTimeout(() => button.textContent = "Copiar link", 1500);
  } catch {
    window.prompt("Copie o link:", url.href);
  }
}

async function render() {
  const counts = new Map();
  (await listAllModoEnsaioSongs()).forEach((song) => counts.set(song.sessionId, (counts.get(song.sessionId) || 0) + 1));
  const root = $("#member-rehearsals-list");
  root.replaceChildren();
  sessions.forEach((session) => {
    const card = document.createElement("article");
    card.className = "modo-admin-card";
    const meta = [session.date ? new Date(`${session.date}T12:00:00`).toLocaleDateString("pt-BR") : "", session.time, session.location].filter(Boolean).join(" • ");
    card.innerHTML = `<div><div class="modo-status-pill ${session.active ? "is-active" : ""}">${session.active ? "Link ativo" : "Rascunho"}</div><h2></h2><p class="modo-admin-meta"></p><p>${counts.get(session.id) || 0} música(s)</p></div><div class="modo-card-actions"></div>`;
    card.querySelector("h2").textContent = session.title;
    card.querySelector(".modo-admin-meta").textContent = meta;
    const actions = card.querySelector(".modo-card-actions");
    if (session.active) {
      const open = document.createElement("a"); open.className = "button-outline"; open.href = `./modo-ensaio?id=${encodeURIComponent(session.id)}`; open.textContent = "Abrir"; actions.append(open);
      const copy = document.createElement("button"); copy.type = "button"; copy.className = "button-outline"; copy.textContent = "Copiar link"; copy.onclick = () => copyLink(session.id, copy); actions.append(copy);
    }
    if (memberHasPermission(member, "edit")) {
      const edit = document.createElement("a"); edit.className = "button-primary"; edit.href = `./editor-ensaio?id=${encodeURIComponent(session.id)}`; edit.textContent = "Editar"; actions.append(edit);
    }
    if (memberHasPermission(member, "delete")) {
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "button-danger"; remove.textContent = "Excluir";
      remove.onclick = async () => {
        if (!confirm(`Excluir o ensaio “${session.title}”?`)) return;
        remove.disabled = true;
        try { await removeModoEnsaio(session.id); sessions = sessions.filter((item) => item.id !== session.id); await render(); }
        catch (error) { setStatus(explainFirebaseError(error), true); remove.disabled = false; }
      };
      actions.append(remove);
    }
    root.append(card);
  });
  if (!sessions.length) root.innerHTML = '<div class="modo-empty">Nenhum ensaio cadastrado ainda.</div>';
  setStatus(`${sessions.length} ensaio(s) disponível(is).`);
}

$("#member-login-button")?.addEventListener("click", openPublicAuthModal);
watchPublicAuth(async (user) => {
  if (!user) return showDenied();
  try {
    member = await getMemberProfileForUser(user);
    if (!member) return showDenied();
    $("#member-access-denied").classList.add("hidden");
    $("#member-new-rehearsal").classList.toggle("hidden", !memberHasPermission(member, "create"));
    setStatus("Carregando ensaios…");
    sessions = await listModoEnsaios();
    await render();
  } catch (error) {
    setStatus(explainFirebaseError(error), true);
  }
});
