import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { canAccessAdminPage, isPrimaryAdmin } from "../services/admin-permissions-service.js";

function resolveCardVisibility(admin, key = "") {
  if (!admin) return false;
  switch (key) {
    case "musicas": return canAccessAdminPage(admin, "musicas");
    case "cifras": return canAccessAdminPage(admin, "cifras");
    case "programacoes": return canAccessAdminPage(admin, "programacoes");
    case "fotos": return canAccessAdminPage(admin, "fotos");
    case "downloads": return canAccessAdminPage(admin, "downloads");
    case "contatos": return canAccessAdminPage(admin, "contatos");
    case "notificacoes": return canAccessAdminPage(admin, "notificacoes");
    case "ensaios": return canAccessAdminPage(admin, "ensaios");
    case "links":
    case "backup":
    case "admins":
      return isPrimaryAdmin(admin);
    case "logs":
      return canAccessAdminPage(admin, "logs");
    default:
      return true;
  }
}

function revealDashboard() {
  document.body.classList.remove("admin-dashboard-permissions-pending");
}

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("admin-dashboard-permissions-pending");

  watchAuth(async (user) => {
    if (!user?.uid || !user?.email) {
      document.querySelectorAll("[data-admin-module]").forEach((card) => card.classList.add("hidden"));
      revealDashboard();
      return;
    }

    try {
      const admin = await getAdminProfileForUser(user);

      document.querySelectorAll("[data-admin-module]").forEach((card) => {
        const visible = resolveCardVisibility(admin, card.dataset.adminModule);
        card.classList.toggle("hidden", !visible);
      });

      revealDashboard();
    } catch (error) {
      console.error("Erro ao preparar painel administrativo:", error);
      document.querySelectorAll("[data-admin-module]").forEach((card) => card.classList.add("hidden"));
      revealDashboard();
    }
  });
});
