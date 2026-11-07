import { watchAuth, getAdminProfileByEmail } from "../auth.js";
import { hasPermission, isPrimaryAdmin } from "../services/admin-permissions-service.js";
import { listMusicas, removeMusica } from "../services/musicas-service.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

async function renderMusicas() {
  const box = document.getElementById("admin-musicas-list");
  const search = document.getElementById("admin-musicas-search");
  if (!box) return;

  const all = await listMusicas(false);
  const term = String(search?.value || "").trim().toLowerCase();
  const filtered = all.filter((item) => String(item.title || "").toLowerCase().includes(term));

  box.innerHTML = filtered.length ? filtered.map((item) => `
    <div class="admin-list-card">
      <div>
        <strong>${item.title || ""}</strong>
        ${item.subtitle ? `<p>${item.subtitle}</p>` : ""}
      </div>
      <div class="admin-list-actions">
        <a class="button-outline" href="./editor-musica.html?id=${item.id}">Editar</a>
        <button class="button-danger" type="button" data-delete-id="${item.id}">Excluir</button>
      </div>
    </div>
  `).join("") : "<p>Nenhuma música cadastrada.</p>";

  box.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Deseja excluir esta música?")) return;
      const item = filtered.find((entry) => entry.id === button.dataset.deleteId);
      await removeMusica(button.dataset.deleteId);
      await recordAdminActivity({ action: "delete", module: "musicas", itemId: button.dataset.deleteId, itemName: item?.title || "Música" });
      alert("🗑️ Música excluída com sucesso!");
      await renderMusicas();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("admin-musicas-search")?.addEventListener("input", renderMusicas);
  await renderMusicas();
});

function applyMusicPermissions(admin) {
  const createBtn = document.querySelector('.admin-toolbar .button-primary');
  if (createBtn) createBtn.classList.toggle('hidden', !hasPermission(admin, 'musicas', 'create'));
  document.querySelectorAll('.admin-list-actions .button-outline').forEach((el) => {
    el.classList.toggle('hidden', !hasPermission(admin, 'musicas', 'edit'));
  });
  document.querySelectorAll('[data-delete-id]').forEach((el) => {
    el.classList.toggle('hidden', !hasPermission(admin, 'musicas', 'delete'));
  });
}

watchAuth(async (user) => {
  if (!user?.email) return;
  const admin = await getAdminProfileByEmail(user.email);
  if (!admin) return;
  const rerender = async () => { await renderMusicas(); applyMusicPermissions(admin); };
  document.getElementById("admin-musicas-search")?.removeEventListener("input", renderMusicas);
  document.getElementById("admin-musicas-search")?.addEventListener("input", rerender);
  await rerender();
});
