import { watchAuth, getAdminProfileByEmail } from "../auth.js";
import { hasPermission, isPrimaryAdmin, getAllowedCifraInstruments, canManageCifraInstrument } from "../services/admin-permissions-service.js";
import { listCifras, removeCifra, getInstrumentLabel } from "../services/cifras-service.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

let currentAdmin = null;

function normalizeKey(value = "") {
  return String(value || "").trim().toLowerCase();
}

function groupCifras(items = []) {
  const map = new Map();

  items.forEach((item) => {
    const key = String(item.musicaId || "") || `${normalizeKey(item.slug)}::${normalizeKey(item.title)}`;
    const current = map.get(key);
    if (current) {
      current.variants.push(item);
      if (!current.subtitle && item.subtitle) current.subtitle = item.subtitle;
      return;
    }

    map.set(key, {
      key,
      musicaId: item.musicaId || "",
      title: item.title || "",
      subtitle: item.subtitle || "",
      slug: item.slug || "",
      variants: [item]
    });
  });

  return Array.from(map.values()).sort((a, b) =>
    String(a.title || "").localeCompare(String(b.title || ""), "pt-BR")
  );
}

function createChooser() {
  let overlay = document.getElementById("admin-cifra-chooser-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "admin-cifra-chooser-overlay";
  overlay.className = "admin-cifra-chooser-overlay hidden";
  overlay.innerHTML = `
    <div class="admin-cifra-chooser-backdrop" data-close="true"></div>
    <div class="admin-cifra-chooser-card" role="dialog" aria-modal="true" aria-labelledby="admin-cifra-chooser-title">
      <button type="button" class="admin-cifra-chooser-close" data-close="true" aria-label="Fechar">✕</button>
      <h3 id="admin-cifra-chooser-title">Escolha o instrumento</h3>
      <p id="admin-cifra-chooser-subtitle"></p>
      <div id="admin-cifra-chooser-options" class="admin-cifra-chooser-options"></div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    .admin-cifra-chooser-overlay.hidden { display:none; }
    .admin-cifra-chooser-overlay { position:fixed; inset:0; z-index:9999; }
    .admin-cifra-chooser-backdrop { position:absolute; inset:0; background:rgba(0,0,0,.55); }
    .admin-cifra-chooser-card { position:relative; max-width:420px; margin:10vh auto 0; background:var(--card-bg, #1e1e1e); color:inherit; border:1px solid rgba(255,255,255,.1); border-radius:16px; padding:18px; box-shadow:0 20px 50px rgba(0,0,0,.35); }
    .admin-cifra-chooser-card h3 { margin:0 0 6px; }
    .admin-cifra-chooser-card p { margin:0 0 14px; opacity:.8; }
    .admin-cifra-chooser-options { display:grid; gap:10px; }
    .admin-cifra-chooser-option { width:100%; text-align:left; border:1px solid rgba(255,255,255,.12); background:transparent; color:inherit; border-radius:12px; padding:12px 14px; cursor:pointer; }
    .admin-cifra-chooser-option:hover { background:rgba(255,255,255,.06); }
    .admin-cifra-chooser-close { position:absolute; right:10px; top:10px; border:0; background:transparent; color:inherit; cursor:pointer; font-size:18px; }
  `;
  document.head.appendChild(style);
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (event) => {
    if (event.target.closest("[data-close='true']")) {
      overlay.classList.add("hidden");
    }
  });

  return overlay;
}

async function chooseInstrument(title, variants = []) {
  if (!variants.length) return null;
  if (variants.length === 1) return variants[0];

  const overlay = createChooser();
  const subtitle = overlay.querySelector("#admin-cifra-chooser-subtitle");
  const options = overlay.querySelector("#admin-cifra-chooser-options");

  subtitle.textContent = `Selecione a variante de instrumento para “${title}”.`;
  options.innerHTML = variants
    .slice()
    .sort((a, b) => getInstrumentLabel(a.instrumento).localeCompare(getInstrumentLabel(b.instrumento), "pt-BR"))
    .map((item) => `
      <button type="button" class="admin-cifra-chooser-option" data-cifra-id="${item.id}">
        ${getInstrumentLabel(item.instrumento || "violao")}
      </button>
    `)
    .join("");

  overlay.classList.remove("hidden");

  return await new Promise((resolve) => {
    const close = (result = null) => {
      overlay.classList.add("hidden");
      options.replaceWith(options.cloneNode(false));
      resolve(result);
    };

    const freshOptions = overlay.querySelector("#admin-cifra-chooser-options");
    freshOptions.querySelectorAll("[data-cifra-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const selected = variants.find((item) => item.id === button.dataset.cifraId) || null;
        close(selected);
      }, { once: true });
    });

    const handleOutside = (event) => {
      if (event.target.closest("[data-close='true']")) {
        overlay.removeEventListener("click", handleOutside);
        close(null);
      }
    };
    overlay.addEventListener("click", handleOutside, { once: true });
  });
}

async function renderCifras() {
  const box = document.getElementById("admin-cifras-list");
  const search = document.getElementById("admin-cifras-search");
  if (!box) return;

  const all = await listCifras(false);
  const visibleItems = isPrimaryAdmin(currentAdmin)
    ? all
    : all.filter((item) => canManageCifraInstrument(currentAdmin, item.instrumento || "violao"));
  const grouped = groupCifras(visibleItems);
  const term = normalizeKey(search?.value || "");
  const filtered = grouped.filter((item) => normalizeKey(item.title).includes(term));

  box.innerHTML = filtered.length ? filtered.map((item) => `
    <div class="admin-list-card">
      <div>
        <strong>${item.title || ""}</strong>
        ${item.subtitle ? `<p>${item.subtitle}</p>` : ""}
      </div>
      <div class="admin-list-actions">
        <button class="button-outline" type="button" data-edit-key="${item.key}">Editar</button>
        <button class="button-danger" type="button" data-delete-key="${item.key}">Excluir</button>
      </div>
    </div>
  `).join("") : "<p>Nenhuma cifra cadastrada.</p>";

  box.querySelectorAll("[data-edit-key]").forEach((button) => {
    button.addEventListener("click", async () => {
      const group = filtered.find((item) => item.key === button.dataset.editKey);
      if (!group) return;
      const selected = await chooseInstrument(group.title, group.variants);
      if (!selected) return;
      window.location.href = `./editor-cifra.html?id=${selected.id}`;
    });
  });

  box.querySelectorAll("[data-delete-key]").forEach((button) => {
    button.addEventListener("click", async () => {
      const group = filtered.find((item) => item.key === button.dataset.deleteKey);
      if (!group) return;
      const selected = await chooseInstrument(group.title, group.variants);
      if (!selected) return;
      if (!confirm(`Deseja excluir a cifra de ${getInstrumentLabel(selected.instrumento || "violao")}?`)) return;
      await removeCifra(selected.id);
      await recordAdminActivity({ action: "delete", module: "cifras", itemId: selected.id, itemName: selected.title || group.title || "Cifra", details: `Instrumento: ${getInstrumentLabel(selected.instrumento || "violao")}` });
      alert("🗑️ Cifra excluída com sucesso!");
      await renderCifras();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("admin-cifras-search")?.addEventListener("input", renderCifras);
  await renderCifras();
});

async function rerenderWithPermissions(admin) {
  currentAdmin = admin;
  await renderCifras();
  const createBtn = document.querySelector('.admin-toolbar .button-primary');
  if (createBtn) createBtn.classList.toggle('hidden', !hasPermission(admin, 'cifras', 'create'));
  document.querySelectorAll('[data-edit-key]').forEach((el)=>el.classList.toggle('hidden', !hasPermission(admin, 'cifras', 'edit')));
  document.querySelectorAll('[data-delete-key]').forEach((el)=>el.classList.toggle('hidden', !hasPermission(admin, 'cifras', 'delete')));
}
watchAuth(async (user) => {
  if (!user?.email) return;
  const admin = await getAdminProfileByEmail(user.email);
  if (!admin) return;
  await rerenderWithPermissions(admin);
});
