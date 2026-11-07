import { watchAuth, getAdminProfileByEmail } from "../auth.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { listEnsaios, removeEnsaio } from "../services/ensaios-service.js";

async function renderEnsaios() {
  const box = document.getElementById("admin-ensaios-list");
  if (!box) return;

  const all = await listEnsaios();
  box.innerHTML = all.length ? all.map((item) => `
    <div class="admin-list-card">
      <div>
        <strong>${escapeHtml(item.titulo || "")}</strong>
        ${item.descricao ? `<p class="ensaio-item__description">${escapeHtml(item.descricao)}</p>` : ""}
        ${item.musicas?.length ? `<ol class="ensaio-item__songs">${item.musicas.map((song) => `<li>${escapeHtml(song.titulo || '')}</li>`).join("")}</ol>` : `<p class="ensaio-item__empty">Nenhuma música vinculada.</p>`}
      </div>
      <div class="admin-list-actions">
        <a class="button-outline" href="./editor-ensaio.html?id=${item.id}">Editar</a>
        <button class="button-danger" type="button" data-delete-id="${item.id}">Excluir</button>
      </div>
    </div>
  `).join("") : '<div class="admin-list-card"><p>Nenhum ensaio cadastrado.</p></div>';

  box.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Deseja excluir este ensaio?")) return;
      await removeEnsaio(button.dataset.deleteId);
      await renderEnsaios();
    });
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

document.addEventListener("DOMContentLoaded", async () => {
  await renderEnsaios();
});

watchAuth(async (user) => {
  if (!user?.email) return;
  const admin = await getAdminProfileByEmail(user.email);
  if (!admin) return;
  document.getElementById('btn-novo-ensaio')?.classList.toggle('hidden', !hasPermission(admin, 'ensaios', 'create'));
  document.querySelectorAll('.admin-list-actions .button-outline').forEach((el) => {
    el.classList.toggle('hidden', !hasPermission(admin, 'ensaios', 'edit'));
  });
  document.querySelectorAll('[data-delete-id]').forEach((el) => {
    el.classList.toggle('hidden', !hasPermission(admin, 'ensaios', 'delete'));
  });
});
