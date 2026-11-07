import { getSiteConfig } from "../services/config-service.js";

const CACHE_KEY = "seven_cache_agenda_embed_v1";

function normalizeAgendaUrl(value = "") {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const document = new DOMParser().parseFromString(text, "text/html");
  const candidate = document.querySelector("iframe")?.getAttribute("src") || text;

  try {
    const url = new URL(candidate, window.location.origin);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function readCachedUrl() {
  try {
    return normalizeAgendaUrl(localStorage.getItem(CACHE_KEY));
  } catch {
    return "";
  }
}

function writeCachedUrl(url = "") {
  try {
    if (url) {
      localStorage.setItem(CACHE_KEY, url);
    } else {
      localStorage.removeItem(CACHE_KEY);
    }
  } catch {
    return;
  }
}

function setAgendaState(url = "", message = "Nenhuma agenda configurada ainda.") {
  const iframe = document.getElementById("agenda-iframe");
  const empty = document.getElementById("agenda-empty");
  const status = document.getElementById("agenda-status");

  if (!url) {
    iframe?.removeAttribute("src");
    iframe?.classList.add("hidden");
    empty?.classList.remove("hidden");
    if (status) status.textContent = message;
    return;
  }

  if (iframe?.getAttribute("src") !== url) iframe?.setAttribute("src", url);
  iframe?.classList.remove("hidden");
  empty?.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", async () => {
  const cachedUrl = readCachedUrl();
  if (cachedUrl) setAgendaState(cachedUrl);

  try {
    const config = await getSiteConfig();
    const url = normalizeAgendaUrl(config?.agendaEmbed);

    writeCachedUrl(url);
    setAgendaState(url);
  } catch (error) {
    console.error("Não foi possível carregar a agenda.", error);
    setAgendaState(cachedUrl, "A agenda está indisponível no momento. Tente novamente mais tarde.");
  }
});
