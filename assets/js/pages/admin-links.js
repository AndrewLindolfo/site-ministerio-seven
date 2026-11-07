import { getSiteConfig, saveSiteConfig } from "../services/config-service.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("admin-links-form") || document.getElementById("admin-config-form");
  if (!form) return;

  const config = await getSiteConfig();
  const map = [
    ["link-instagram", "config-instagram", "instagramUrl"],
    ["arroba-instagram", "config-instagram-arroba", "instagramHandle"],
    ["email-oficial", "config-email", "officialEmail"],
    ["agenda-embed", "config-agenda", "agendaEmbed"]
  ];

  map.forEach(([idA, idB, key]) => {
    const input = document.getElementById(idA) || document.getElementById(idB);
    if (input) input.value = config?.[key] || "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveSiteConfig({
      instagramUrl: (document.getElementById("link-instagram") || document.getElementById("config-instagram"))?.value || "",
      instagramHandle: (document.getElementById("arroba-instagram") || document.getElementById("config-instagram-arroba"))?.value || "",
      officialEmail: (document.getElementById("email-oficial") || document.getElementById("config-email"))?.value || "",
      agendaEmbed: (document.getElementById("agenda-embed") || document.getElementById("config-agenda"))?.value || ""
    });
    await recordAdminActivity({ action: "update", module: "links", itemId: "site", itemName: "Links do site" });
    alert("Links salvos com sucesso.");
  });
});
