import { listPublicNotificacoes } from "../services/notificacoes-service.js";
import { normalizeHttpsOrLocalUrl } from "../lib/url-safety.js";

const VALID_TYPES = new Set(["aviso", "novidade", "evento", "destaque"]);

function normalizeType(value = "") {
  const type = String(value || "aviso").trim().toLowerCase();
  return VALID_TYPES.has(type) ? type : "aviso";
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value = "") {
  const date = toDate(value);
  if (!date) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(date);
}


function getStatus(item = {}) {
  const now = Date.now();
  const startMs = toDate(item.startsAt)?.getTime() || 0;
  const endMs = toDate(item.expiresAt)?.getTime() || 0;
  if (startMs && now < startMs) return { label: "Em breve", className: "status-upcoming" };
  if (endMs && now > endMs) return { label: "Encerrado", className: "status-ended" };
  return { label: "Ativo", className: "status-active" };
}

function groupByDay(items = []) {
  const groups = new Map();
  items.forEach((item) => {
    const date = toDate(item.startsAt);
    const key = date
      ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(date)
      : "Sem data definida";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return [...groups.entries()];
}

function createMessageCard(item = {}) {
  const article = document.createElement("article");
  const type = normalizeType(item.type || item.tipo);
  const status = getStatus(item);
  article.className = `notificacao-publica-card tipo-${type}`;

  const top = document.createElement("div");
  top.className = "notificacao-publica-top";
  const tags = document.createElement("div");
  tags.className = "notificacao-publica-tags";
  const typeChip = document.createElement("span");
  typeChip.className = `notificacao-chip tipo-${type}`;
  typeChip.textContent = type;
  const statusChip = document.createElement("span");
  statusChip.className = `notificacao-status ${status.className}`;
  statusChip.textContent = status.label;
  tags.append(typeChip, statusChip);

  const time = document.createElement("time");
  const dateValue = item.startsAt || item.createdAt || "";
  const date = toDate(dateValue);
  time.textContent = formatDateTime(dateValue);
  if (date) time.dateTime = date.toISOString();
  top.append(tags, time);

  const title = document.createElement("h3");
  title.textContent = item.title || "Sem título";
  const message = document.createElement("p");
  message.textContent = item.message || "";
  article.append(top, title, message);

  const buttonUrl = normalizeHttpsOrLocalUrl(item.buttonLink);
  if (buttonUrl && item.buttonText) {
    const link = document.createElement("a");
    link.className = "button-outline notificacao-link";
    link.href = buttonUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.buttonText;
    article.appendChild(link);
  }
  return article;
}

function createMessage(text) {
  const card = document.createElement("div");
  card.className = "notificacao-publica-card";
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  card.appendChild(paragraph);
  return card;
}

async function renderPublicNotificacoesPage() {
  const box = document.getElementById("notificacoes-lista");
  if (!box) return;

  try {
    const items = await listPublicNotificacoes();
    box.replaceChildren();
    if (!items.length) {
      box.appendChild(createMessage("Nenhuma notificação disponível no momento."));
      return;
    }

    const groups = groupByDay(items);
    groups.forEach(([label, entries]) => {
      const section = document.createElement("section");
      section.className = "notificacoes-group";
      const heading = document.createElement("h2");
      heading.textContent = label;
      const list = document.createElement("div");
      list.className = "notificacoes-group-list";
      entries.forEach((item) => list.appendChild(createMessageCard(item)));
      section.append(heading, list);
      box.appendChild(section);
    });
  } catch (error) {
    console.error("Erro ao carregar notificações públicas:", error);
    box.replaceChildren(createMessage("Não foi possível carregar as notificações agora."));
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await renderPublicNotificacoesPage();
});
