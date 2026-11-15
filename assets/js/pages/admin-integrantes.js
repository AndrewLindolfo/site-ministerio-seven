import {
  cloneDefaultMemberPermissions,
  getEffectiveMemberPermissions,
  listMembers,
  removeMember,
  saveMember
} from "../services/member-permissions-service.js";
import { watchAuth } from "../auth.js";

const $ = (selector) => document.querySelector(selector);
let members = [];

function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function setStatus(message = "", error = false) {
  $("#member-status").textContent = message;
  $("#member-status").classList.toggle("error", error);
}

function readPermissions() {
  const permissions = cloneDefaultMemberPermissions();
  document.querySelectorAll("[data-member-permission]").forEach((input) => {
    permissions.ensaios[input.dataset.memberPermission] = input.checked === true;
  });
  return permissions;
}

function writePermissions(member = null) {
  const permissions = getEffectiveMemberPermissions(member);
  document.querySelectorAll("[data-member-permission]").forEach((input) => {
    input.checked = permissions.ensaios[input.dataset.memberPermission] === true;
  });
}

function resetForm() {
  $("#member-id").value = "";
  $("#member-name").value = "";
  $("#member-email").value = "";
  $("#member-active").checked = true;
  $("#member-uid-status").textContent = "No primeiro login válido, a conta Google será vinculada automaticamente a este integrante.";
  writePermissions();
}

function permissionTags(member) {
  const permissions = getEffectiveMemberPermissions(member).ensaios;
  return Object.entries(permissions).filter(([, enabled]) => enabled).map(([key]) => ({ create: "Criar", edit: "Editar", delete: "Excluir" }[key]));
}

function renderList() {
  const root = $("#member-list");
  root.innerHTML = members.length ? members.map((member) => `
    <article class="admin-list-card">
      <div>
        <strong>${escapeHtml(member.name)}</strong>
        <p class="admin-admin-email">${escapeHtml(member.email)}</p>
        <p class="admin-admin-email">${member.active ? "Ativo" : "Inativo"} • ${member.uid ? "Conta vinculada" : "Aguardando primeiro login"}</p>
        <div class="admin-admin-tags">${permissionTags(member).map((tag) => `<span class="admin-admin-tag">${tag}</span>`).join("") || '<span class="admin-admin-tag">Somente visualização</span>'}</div>
      </div>
      <div class="admin-list-actions"><button type="button" class="button-outline" data-edit-member="${escapeHtml(member.id)}">Editar</button><button type="button" class="button-danger" data-delete-member="${escapeHtml(member.id)}">Excluir</button></div>
    </article>`).join("") : "<p>Nenhum integrante cadastrado.</p>";
  setStatus(members.length ? `${members.length} integrante(s) cadastrado(s).` : "");
  root.querySelectorAll("[data-edit-member]").forEach((button) => button.addEventListener("click", () => {
    const member = members.find((item) => item.id === button.dataset.editMember);
    if (!member) return;
    $("#member-id").value = member.id;
    $("#member-name").value = member.name || "";
    $("#member-email").value = member.email || "";
    $("#member-active").checked = member.active === true;
    $("#member-uid-status").textContent = member.uid ? "Esta conta Google já está vinculada ao integrante." : "Aguardando o primeiro login desta conta Google.";
    writePermissions(member);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
  root.querySelectorAll("[data-delete-member]").forEach((button) => button.addEventListener("click", async () => {
    const member = members.find((item) => item.id === button.dataset.deleteMember);
    if (!member || !confirm(`Excluir o integrante “${member.name}”?`)) return;
    button.disabled = true;
    try {
      await removeMember(member.id);
      members = members.filter((item) => item.id !== member.id);
      renderList();
    } catch (error) {
      setStatus(error?.message || "Não foi possível excluir o integrante.", true);
      button.disabled = false;
    }
  }));
}

document.addEventListener("DOMContentLoaded", async () => {
  resetForm();
  $("#member-reset").addEventListener("click", resetForm);
  $("#member-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = { name: $("#member-name").value, email: $("#member-email").value, active: $("#member-active").checked, permissions: readPermissions() };
    const existingId = $("#member-id").value;
    form.querySelectorAll("input, button").forEach((control) => control.disabled = true);
    setStatus("Salvando integrante…");
    try {
      await saveMember(payload, existingId);
      resetForm();
      members = await listMembers();
      renderList();
      setStatus("Integrante salvo com sucesso.");
    } catch (error) {
      setStatus(error?.message || "Não foi possível salvar o integrante.", true);
    } finally {
      form.querySelectorAll("input, button").forEach((control) => control.disabled = false);
    }
  });
});

let loaded = false;
watchAuth(async (user) => {
  if (!user || loaded) return;
  try {
    setStatus("Carregando integrantes…");
    members = await listMembers();
    renderList();
    loaded = true;
  } catch (error) {
    setStatus(error?.message || "Não foi possível carregar os integrantes.", true);
  }
});
