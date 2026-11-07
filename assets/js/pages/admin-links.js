import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { explainFirebaseError } from "../db.js";
import { isPrimaryAdmin } from "../services/admin-permissions-service.js";
import { getSiteConfig, saveSiteConfig } from "../services/config-service.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

let canManage = false;
let hasInitialized = false;

function byId(id) {
  return document.getElementById(id);
}

function setStatus(message = "", isError = false) {
  const status = byId("admin-links-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

async function loadConfig() {
  setStatus("Carregando configuração…");
  const config = await getSiteConfig();
  byId("link-instagram").value = config?.instagramUrl || "";
  byId("arroba-instagram").value = config?.instagramHandle || "";
  byId("email-oficial").value = config?.officialEmail || "";
  byId("agenda-embed").value = config?.agendaEmbed || "";
  setStatus("");
}

document.addEventListener("DOMContentLoaded", () => {
  byId("admin-links-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canManage) return setStatus("Somente o administrador principal pode alterar esta configuração.", true);
    const submit = event.target.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      setStatus("Salvando configuração…");
      await saveSiteConfig({
        instagramUrl: byId("link-instagram").value,
        instagramHandle: byId("arroba-instagram").value,
        officialEmail: byId("email-oficial").value,
        agendaEmbed: byId("agenda-embed").value
      });
      await recordAdminActivity({ action: "update", module: "links", itemId: "site", itemName: "Links do site" });
      setStatus("Configuração salva com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
      setStatus(explainFirebaseError(error), true);
    } finally {
      submit.disabled = false;
    }
  });
});

watchAuth(async (user) => {
  if (!user?.uid || !user?.email) return;
  try {
    const admin = await getAdminProfileForUser(user);
    canManage = isPrimaryAdmin(admin);
    document.querySelector('#admin-links-form button[type="submit"]')?.classList.toggle("hidden", !canManage);
    if (canManage && !hasInitialized) {
      await loadConfig();
      hasInitialized = true;
    }
  } catch (error) {
    console.error("Erro ao preparar configuração:", error);
    setStatus(explainFirebaseError(error), true);
  }
});
