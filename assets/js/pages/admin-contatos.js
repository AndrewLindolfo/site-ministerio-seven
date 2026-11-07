import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { getCollection, updateDocument, deleteDocument, serverTimestamp, explainFirebaseError } from "../db.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

let currentAdmin = null;
let contacts = [];

function setStatus(message = "", isError = false) {
  const status = document.getElementById("admin-contatos-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function formatDate(value) {
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value || 0);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function buildContactCard(item) {
  const card = document.createElement("article");
  card.className = "admin-list-card";
  const details = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = `${item.nome || "Sem nome"} — ${item.assunto || "Sem assunto"}`;
  const email = document.createElement("p");
  email.textContent = item.email || "E-mail não informado";
  const message = document.createElement("p");
  message.textContent = item.mensagem || "";
  details.append(heading, email, message);
  const date = formatDate(item.createdAt);
  if (date) {
    const time = document.createElement("small");
    time.textContent = date;
    details.append(time);
  }

  const actions = document.createElement("div");
  actions.className = "admin-list-actions";
  if (hasPermission(currentAdmin, "contatos", "delete")) {
    if (!item.lido) {
      const markRead = document.createElement("button");
      markRead.className = "button-outline";
      markRead.type = "button";
      markRead.textContent = "Marcar como lido";
      markRead.addEventListener("click", async () => {
        markRead.disabled = true;
        try {
          await updateDocument("contatos", item.id, { lido: true, readAt: serverTimestamp() });
          item.lido = true;
          renderContacts();
          await recordAdminActivity({ action: "update", module: "contatos", itemId: item.id, itemName: item.assunto || item.nome || "Contato", details: "Contato marcado como lido." });
        } catch (error) {
          console.error("Erro ao marcar contato como lido:", error);
          setStatus(explainFirebaseError(error), true);
          markRead.disabled = false;
        }
      });
      actions.append(markRead);
    }
    const remove = document.createElement("button");
    remove.className = "button-danger";
    remove.type = "button";
    remove.textContent = "Excluir";
    remove.addEventListener("click", async () => {
      if (!confirm("Excluir permanentemente esta mensagem de contato?")) return;
      remove.disabled = true;
      try {
        await deleteDocument("contatos", item.id);
        await recordAdminActivity({ action: "delete", module: "contatos", itemId: item.id, itemName: item.assunto || item.nome || "Contato" });
        contacts = contacts.filter((contact) => contact.id !== item.id);
        renderContacts();
        setStatus("Contato excluído com sucesso.");
      } catch (error) {
        console.error("Erro ao excluir contato:", error);
        setStatus(explainFirebaseError(error), true);
        remove.disabled = false;
      }
    });
    actions.append(remove);
  } else if (item.lido) {
    const read = document.createElement("span");
    read.textContent = "Lido";
    actions.append(read);
  }
  card.append(details, actions);
  return card;
}

function renderContacts() {
  const box = document.getElementById("admin-contatos-list");
  if (!box) return;
  box.replaceChildren(...contacts.map(buildContactCard));
  if (!contacts.length) {
    const empty = document.createElement("p");
    empty.textContent = "Nenhum contato recebido.";
    box.append(empty);
  }
  setStatus(`${contacts.length} contato(s) exibido(s).`);
}

async function loadContacts() {
  setStatus("Carregando contatos…");
  contacts = await getCollection("contatos", {
    orderBy: { field: "createdAt", direction: "desc" },
    limit: 200
  });
  renderContacts();
}

watchAuth(async (user) => {
  if (!user?.uid || !user?.email) return;
  try {
    currentAdmin = await getAdminProfileForUser(user);
    if (!currentAdmin || !hasPermission(currentAdmin, "contatos", "view")) {
      setStatus("Você não tem permissão para ver contatos.", true);
      return;
    }
    await loadContacts();
  } catch (error) {
    console.error("Erro ao carregar contatos:", error);
    setStatus(explainFirebaseError(error), true);
  }
});
