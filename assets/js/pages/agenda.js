import { getSiteConfig } from "../services/config-service.js";

const CACHE_KEY = "seven_cache_agenda_embed_v1";

function extractSrc(value = "") {
  const t = String(value || "").trim();
  if (!t) return "";
  const m = t.match(/src=["']([^"']+)["']/i);
  if (m) return m[1];
  return t;
}

function setAgendaState(url = "") {
  const iframe = document.getElementById("agenda-iframe");
  const empty = document.getElementById("agenda-empty");

  if (!url) {
    iframe?.classList.add("hidden");
    empty?.classList.remove("hidden");
    return;
  }

  if (iframe && iframe.src !== url) iframe.src = url;
  iframe?.classList.remove("hidden");
  empty?.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const cachedUrl = localStorage.getItem(CACHE_KEY) || "";
    if (cachedUrl) {
      setAgendaState(cachedUrl);
    }

    const config = await getSiteConfig();
    const raw = config?.agendaEmbed || "";
    const url = extractSrc(raw);

    if (url) {
      localStorage.setItem(CACHE_KEY, url);
    }

    setAgendaState(url);
  } catch (e) {
    console.error("Agenda erro:", e);
    const cachedUrl = localStorage.getItem(CACHE_KEY) || "";
    setAgendaState(cachedUrl);
  }
});
