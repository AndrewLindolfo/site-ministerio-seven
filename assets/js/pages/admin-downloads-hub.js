import { watchAuth, getAdminProfileForUser } from "../auth.js";
import { hasAnyModulePermission } from "../services/admin-permissions-service.js";

watchAuth(async (user) => {
  if (!user?.uid || !user?.email) return;
  try {
    const admin = await getAdminProfileForUser(user);
    if (!admin) return;
    document.querySelectorAll("[data-download-module]").forEach((card) => {
      card.classList.toggle("hidden", !hasAnyModulePermission(admin, card.dataset.downloadModule));
    });
  } catch (error) {
    console.error("Erro ao preparar áreas de downloads:", error);
  }
});
