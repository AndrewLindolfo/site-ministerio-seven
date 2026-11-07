import { listMusicas } from "../services/musicas-service.js";
import { getSiteConfig } from "../services/config-service.js";
import { renderProgramacaoCard } from "../modules/programacao-card.js";
import { listHomeNotificacoes, getTopNotificacao } from "../services/notificacoes-service.js";
import { listEnsaios } from "../services/ensaios-service.js";
import { normalizeHttpsOrLocalUrl } from "../lib/url-safety.js";

const VALID_NOTIFICATION_TYPES = new Set(["aviso", "novidade", "evento", "destaque"]);

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

function normalizeNotificationType(value = "") {
  const type = String(value || "aviso").trim().toLowerCase();
  return VALID_NOTIFICATION_TYPES.has(type) ? type : "aviso";
}

function getLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function getTopStorageKey(item = {}) {
  return `seven_top_notificacao_${item.id || "global"}`;
}

function shouldShowTopBanner(item) {
  if (!item?.id) return false;
  const key = getTopStorageKey(item);
  const mode = item.topMode || "device_once";
  const saved = readLocalStorage(key);
  if (!saved) return true;
  if (mode === "always") {
    const until = Number(saved || 0);
    return !until || Date.now() >= until;
  }
  if (mode === "daily") {
    return saved !== getLocalDateKey();
  }
  return false;
}

function persistTopBannerDismiss(item) {
  const key = getTopStorageKey(item);
  const mode = item.topMode || "device_once";
  if (mode === "always") {
    writeLocalStorage(key, String(Date.now() + 15 * 60 * 1000));
    return;
  }
  if (mode === "daily") {
    writeLocalStorage(key, getLocalDateKey());
    return;
  }
  writeLocalStorage(key, "dismissed");
}

async function renderTopNotificacao() {
  const wrapper = document.getElementById("top-notificacao-wrapper");
  const box = document.getElementById("top-notificacao-content");
  if (!wrapper || !box) return;

  try {
    const item = await getTopNotificacao();
    if (!item || !shouldShowTopBanner(item)) {
      wrapper.hidden = true;
      return;
    }

    const type = normalizeNotificationType(item.type || item.tipo);
    const buttonUrl = normalizeHttpsOrLocalUrl(item.buttonLink);
    wrapper.hidden = false;
    box.innerHTML = `
      <div class="top-notificacao-inner tipo-${type}">
        <div class="top-notificacao-texts">
          <span class="notificacao-chip tipo-${type}">${escapeHtml(type)}</span>
          <strong>${escapeHtml(item.title || "Comunicado")}</strong>
          <p>${formatMultilineHtml(item.message || "")}</p>
        </div>
        <div class="top-notificacao-actions">
          ${buttonUrl && item.buttonText ? `<a class="button-outline top-notificacao-link" href="${escapeHtml(buttonUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.buttonText)}</a>` : ""}
          <button type="button" class="top-notificacao-close" aria-label="Fechar comunicado">✕</button>
        </div>
      </div>
    `;

    box.querySelector(".top-notificacao-close")?.addEventListener("click", () => {
      persistTopBannerDismiss(item);
      wrapper.hidden = true;
    });
  } catch (error) {
    console.error("Erro ao carregar faixa de notificação do topo:", error);
    wrapper.hidden = true;
  }
}
async function renderSevenPhoto() {
  try {
    const config = await getSiteConfig();
    const sevenPhotoSection = document.getElementById("seven-photo-section");
    const sevenPhotoCard = document.getElementById("seven-photo-card");

    const photoUrl = normalizeHttpsOrLocalUrl(config?.sevenPhotoUrl);
    if (photoUrl && sevenPhotoSection && sevenPhotoCard) {
      const image = document.createElement("img");
      image.src = photoUrl;
      image.alt = "Ministério Seven";
      image.loading = "lazy";
      image.decoding = "async";
      sevenPhotoCard.replaceChildren(image);
      sevenPhotoSection.hidden = false;
    } else if (sevenPhotoSection && sevenPhotoCard) {
      sevenPhotoCard.replaceChildren();
      sevenPhotoSection.hidden = true;
    }
  } catch (error) {
    console.error("Erro ao carregar foto principal:", error);
  }
}


async function loadEnsaio() {
  const section = document.getElementById("ensaio-home-section");
  const card = document.getElementById("ensaio-home-card");
  if (!section || !card) return;

  try {
    const ensaios = (await listEnsaios())
      .filter((item) => item && item.titulo)
      .sort((a, b) => {
        const aTime = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
        const bTime = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

    if (!ensaios.length) {
      section.hidden = true;
      card.innerHTML = "";
      return;
    }

    section.hidden = false;
    card.innerHTML = ensaios.map((ensaio) => {
      const songs = Array.isArray(ensaio.musicas) ? ensaio.musicas : [];
      const songsHtml = songs.length
        ? `<ol class="programacao-list">${songs.map((song) => `<li>${escapeHtml(song.titulo || "")}</li>`).join("")}</ol>`
        : '<p class="muted">Nenhuma música vinculada.</p>';

      return `
        <article class="programacao-box">
          <h3>${escapeHtml(ensaio.titulo)}</h3>
          ${ensaio.descricao ? `<p>${formatMultilineHtml(ensaio.descricao)}</p>` : ""}
          ${songsHtml}
        </article>
      `;
    }).join("");
  } catch (error) {
    console.error("Erro ao carregar ensaio da home:", error);
    section.hidden = true;
    card.innerHTML = "";
  }
}

async function renderHomeNotificacoes() {
  const section = document.getElementById("notificacoes-home-section");
  const grid = document.getElementById("notificacoes-home-grid");
  if (!section || !grid) return;

  try {
    const items = await listHomeNotificacoes();
    if (!items.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    grid.innerHTML = items.map((item) => {
      const type = normalizeNotificationType(item.type || item.tipo);
      const buttonUrl = normalizeHttpsOrLocalUrl(item.buttonLink);
      return `
      <article class="home-notificacao-card tipo-${type}">
        <span class="notificacao-chip tipo-${type}">${escapeHtml(type)}</span>
        <h3>${escapeHtml(item.title || "Sem título")}</h3>
        <p>${formatMultilineHtml(item.message || "")}</p>
        ${buttonUrl && item.buttonText ? `<a class="button-outline" href="${escapeHtml(buttonUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.buttonText)}</a>` : ""}
      </article>
    `;
    }).join("");
  } catch (error) {
    console.error("Erro ao carregar notificações da home:", error);
    section.hidden = true;
  }
}

async function renderDestaques() {
  const destaquesGrid = document.getElementById("destaques-grid");
  if (!destaquesGrid) return;

  try {
    const musicas = await listMusicas(true);
    const top = [...musicas]
      .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
      .slice(0, 5);

    destaquesGrid.innerHTML = top.length
      ? top.map((item, idx) => `
        <div class="destaque-box">
          <strong>#${idx + 1}</strong>
          <p>${escapeHtml(item.title || item.titulo || "")}</p>
        </div>
      `).join("")
      : '<div class="destaque-box"><p>Nenhum destaque disponível.</p></div>';
  } catch (error) {
    console.error("Erro ao carregar destaques:", error);
    destaquesGrid.innerHTML = '<div class="destaque-box"><p>Nenhum destaque disponível.</p></div>';
  }
}


document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([
    renderTopNotificacao(),
    renderSevenPhoto(),
    renderProgramacaoCard(),
    loadEnsaio(),
    renderHomeNotificacoes(),
    renderDestaques()
  ]);
});
