import { listAdminActivities } from "../services/admin-activity-service.js";
import { listAdmins } from "../services/admin-permissions-service.js";

let allLogs = [];
let activeAdminsCount = 0;

function normalizeValue(value = "") {
  return String(value || "").trim().toLowerCase();
}

function toMillis(itemOrValue) {
  const value = itemOrValue?.timestamp || itemOrValue?.createdAt || itemOrValue;
  if (typeof itemOrValue?.fallbackCreatedAtMs === "number") return itemOrValue.fallbackCreatedAtMs;
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getLocalDayRange(baseDate = new Date()) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

function matchesPeriod(item, periodValue) {
  if (!periodValue || periodValue === "0") return true;
  const time = toMillis(item);
  if (!time) return false;

  const now = new Date();
  if (periodValue === "1") {
    const range = getLocalDayRange(now);
    return time >= range.start && time < range.end;
  }

  const days = Number(periodValue);
  if (!Number.isFinite(days) || days <= 0) return true;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return time >= start.getTime();
}

function formatDateTime(item) {
  const millis = toMillis(item);
  if (!millis) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(millis));
}

function actionLabel(value = "") {
  return ({ create: "Criou", update: "Editou", delete: "Excluiu", export: "Exportou", import: "Restaurou" })[value] || "Atualizou";
}

function moduleLabel(value = "") {
  return ({
    musicas: "Músicas",
    cifras: "Cifras",
    programacoes: "Programações",
    fotos: "Fotos",
    downloads: "Downloads",
    downloads_geral: "Downloads gerais",
    downloads_por_musica: "Downloads por música",
    links: "Links",
    contatos: "Contatos",
    notificacoes: "Notificações",
    backup: "Backup",
    admins: "Administradores",
    ensaios: "Ensaio",
    logs: "Log"
  })[value] || value || "Geral";
}

function populateSelect(select, values, formatter = (v) => v) {
  if (!select) return;
  const current = select.value;
  values.forEach((value) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = formatter(value);
    select.appendChild(opt);
  });
  select.value = current || select.value;
}

function renderSummary(logs) {
  const today = logs.filter((item) => matchesPeriod(item, "1")).length;
  const week = logs.filter((item) => matchesPeriod(item, "7")).length;
  const admins = activeAdminsCount || new Set(logs.map((item) => normalizeValue(item.userUid || item.userEmail)).filter(Boolean)).size;

  document.getElementById("summary-today").textContent = String(today);
  document.getElementById("summary-week").textContent = String(week);
  document.getElementById("summary-admins").textContent = String(admins);
}

function renderList(items) {
  const box = document.getElementById("admin-logs-list");
  if (!box) return;

  if (!items.length) {
    box.innerHTML = "<p>Nenhuma atividade encontrada para os filtros selecionados.</p>";
    return;
  }

  box.innerHTML = items.map((item) => `
    <article class="admin-log-card">
      <div class="admin-log-top">
        <div>
          <div class="admin-log-item">${item.itemName || "Sem item"}</div>
          <div class="admin-log-meta"><span>${formatDateTime(item)}</span><span>${item.userName || item.userEmail || "Administrador"}</span></div>
        </div>
        <div class="admin-log-tags">
          <span class="admin-log-badge badge-action-${item.action}">${actionLabel(item.action)}</span>
          <span class="admin-log-badge badge-module">${moduleLabel(item.module)}</span>
        </div>
      </div>
      ${item.details ? `<p class="admin-log-details">${item.details}</p>` : ""}
    </article>
  `).join("");
}

function applyFilters() {
  const moduleValue = document.getElementById("filter-module")?.value || "";
  const actionValue = document.getElementById("filter-action")?.value || "";
  const userValue = normalizeValue(document.getElementById("filter-user")?.value || "");
  const periodValue = document.getElementById("filter-period")?.value || "7";

  const filtered = allLogs.filter((item) => {
    if (moduleValue && item.module !== moduleValue) return false;
    if (actionValue && item.action !== actionValue) return false;

    const itemUid = normalizeValue(item.userUid);
    const itemEmail = normalizeValue(item.userEmail);
    if (userValue && itemUid !== userValue && itemEmail !== userValue) return false;
    if (!matchesPeriod(item, periodValue)) return false;
    return true;
  });

  renderSummary(allLogs);
  renderList(filtered);
}

document.addEventListener("DOMContentLoaded", async () => {
  allLogs = await listAdminActivities();
  allLogs.sort((a, b) => toMillis(b) - toMillis(a));

  const admins = await listAdmins();
  activeAdminsCount = admins.length;

  populateSelect(document.getElementById("filter-module"), [...new Set(allLogs.map((item) => item.module).filter(Boolean))], moduleLabel);

  const userOptions = admins
    .map((item) => ({
      value: normalizeValue(item.uid || item.email || ""),
      label: item.name || item.nome || item.email || item.uid || "Administrador"
    }))
    .filter((item) => item.value);
  const uniqueUserOptions = Array.from(new Map(userOptions.map((item) => [item.value, item])).values());
  populateSelect(
    document.getElementById("filter-user"),
    uniqueUserOptions.map((item) => item.value),
    (value) => uniqueUserOptions.find((item) => item.value === value)?.label || value
  );

  document.getElementById("filter-apply")?.addEventListener("click", applyFilters);
  document.getElementById("filter-clear")?.addEventListener("click", () => {
    document.getElementById("filter-module").value = "";
    document.getElementById("filter-action").value = "";
    document.getElementById("filter-user").value = "";
    document.getElementById("filter-period").value = "7";
    applyFilters();
  });

  applyFilters();
});
