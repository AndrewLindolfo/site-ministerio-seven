import { listPublicNotificacoes } from "../services/notificacoes-service.js";
import { watchCollection } from "../db.js";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMultilineHtml(value = "") {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function formatDateTime(value = "") {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(date);
}


function getStatus(item = {}) {
  const now = Date.now();
  const startMs = item.startsAt ? Date.parse(item.startsAt) : 0;
  const endMs = item.expiresAt ? Date.parse(item.expiresAt) : 0;
  if (startMs && now < startMs) return { label: "Em breve", className: "status-upcoming" };
  if (endMs && now > endMs) return { label: "Encerrado", className: "status-ended" };
  return { label: "Ativo", className: "status-active" };
}

function groupByDay(items = []) {
  const groups = new Map();
  items.forEach((item) => {
    const date = item.startsAt ? new Date(item.startsAt) : null;
    const key = date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(date)
      : "Sem data definida";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return [...groups.entries()];
}

async function renderPublicNotificacoesPage() {
  const box = document.getElementById("notificacoes-lista");
  if (!box) return;

  try {
    const items = await listPublicNotificacoes();
    if (!items.length) {
      box.innerHTML = '<div class="notificacao-publica-card"><p>Nenhuma notificação disponível no momento.</p></div>';
      return;
    }

    const groups = groupByDay(items);
    box.innerHTML = groups.map(([label, entries]) => `
      <section class="notificacoes-group">
        <h2>${escapeHtml(label)}</h2>
        <div class="notificacoes-group-list">
          ${entries.map((item) => `
            <article class="notificacao-publica-card tipo-${escapeHtml(item.type || item.tipo || "aviso")}">
              <div class="notificacao-publica-top">
                <div class="notificacao-publica-tags">
                  <span class="notificacao-chip tipo-${escapeHtml(item.type || item.tipo || "aviso")}">${escapeHtml(item.type || item.tipo || "aviso")}</span>
                  <span class="notificacao-status ${escapeHtml(getStatus(item).className)}">${escapeHtml(getStatus(item).label)}</span>
                </div>
                <time>${escapeHtml(formatDateTime(item.startsAt || item.createdAt || ""))}</time>
              </div>
              <h3>${escapeHtml(item.title || "Sem título")}</h3>
              <p>${formatMultilineHtml(item.message || "")}</p>
              ${item.buttonLink && item.buttonText ? `<a class="button-outline notificacao-link" href="${escapeHtml(item.buttonLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.buttonText)}</a>` : ""}
            </article>
          `).join("")}
        </div>
      </section>
    `).join("");
  } catch (error) {
    console.error("Erro ao carregar notificações públicas:", error);
    box.innerHTML = '<div class="notificacao-publica-card"><p>Não foi possível carregar as notificações agora.</p></div>';
  }
}

let notificacoesLiveUnsubscribe = null;

document.addEventListener("DOMContentLoaded", async () => {
  await renderPublicNotificacoesPage();
  notificacoesLiveUnsubscribe = watchCollection("notificacoes", async () => {
    await renderPublicNotificacoesPage();
  });
});

window.addEventListener("beforeunload", () => {
  if (notificacoesLiveUnsubscribe) {
    try { notificacoesLiveUnsubscribe(); } catch {}
    notificacoesLiveUnsubscribe = null;
  }
});
