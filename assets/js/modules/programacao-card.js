import { listUpcomingProgramacoes } from "../services/programacoes-service.js";
import { listCifras } from "../services/cifras-service.js";

function escapeHtml(text = "") {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalize(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function fmtDate(value = "") {
  if (!value) return "Sem data";
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function buildCountdown(date = "", time = "") {
  if (!date) return "";
  const parts = String(date).split("-");
  if (parts.length !== 3) return "";
  const timeParts = String(time || "00:00").split(":");

  const dt = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]),
    Number(timeParts[0] || 0),
    Number(timeParts[1] || 0),
    0,
    0
  );

  const now = new Date();
  const diff = dt.getTime() - now.getTime();

  if (diff <= 0) return "Acontece hoje";

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const chunks = [];
  if (days > 0) chunks.push(`${days}d`);
  if (hours > 0) chunks.push(`${hours}h`);
  if (minutes > 0 && days === 0) chunks.push(`${minutes}min`);

  return chunks.length ? `Começa em ${chunks.join(" ")}` : "Começa em instantes";
}

function resolveExistingCifra(song = {}, cifraIndex = []) {
  const songTitle = normalize(song.title || song.name || "");
  const songSlug = String(song.slug || "").trim();
  const songCifraSlug = String(song.cifraSlug || "").trim();
  const songMusicaId = String(song.musicaId || "").trim();

  return cifraIndex.find((cifra) => {
    const cifraSlug = String(cifra.slug || "").trim();
    const cifraTitle = normalize(cifra.title || "");
    const cifraMusicaId = String(cifra.musicaId || "").trim();

    if (songCifraSlug && cifraSlug === songCifraSlug) return true;
    if (songMusicaId && cifraMusicaId && songMusicaId === cifraMusicaId) return true;
    if (songSlug && cifraSlug === songSlug) return true;
    if (songTitle && cifraTitle === songTitle) return true;

    return false;
  }) || null;
}

function renderVocalLink(song = {}) {
  if (song.slug) {
    return `
      <a class="programacao-link-chip programacao-link-chip--vocal" href="./musica.html?slug=${song.slug}">
        <span class="programacao-link-icon" aria-hidden="true">🎤</span>
        <span>Vocal</span>
      </a>
    `;
  }

  return `
    <span class="programacao-link-chip programacao-link-chip--muted">
      <span class="programacao-link-icon" aria-hidden="true">🎤</span>
      <span>Vocal</span>
    </span>
  `;
}

function renderBandaLink(song = {}, cifraIndex = []) {
  const existingCifra = resolveExistingCifra(song, cifraIndex);
  if (existingCifra?.slug) {
    return `
      <a class="programacao-link-chip programacao-link-chip--banda" href="./cifra.html?slug=${existingCifra.slug}">
        <span class="programacao-link-icon" aria-hidden="true">🎸</span>
        <span>Banda</span>
      </a>
    `;
  }

  return `
    <span class="programacao-link-chip programacao-link-chip--muted">
      <span class="programacao-link-icon" aria-hidden="true">🎸</span>
      <span>Em breve</span>
    </span>
  `;
}

function renderSongLine(song = {}, index = 0, cifraIndex = []) {
  return `
    <div class="programacao-item">
      <div class="programacao-item-main">
        <span class="programacao-item-number">${index + 1}</span>
        <span class="programacao-item-title">${escapeHtml(song.title || "")}</span>
      </div>
      <div class="programacao-links">
        ${renderVocalLink(song)}
        ${renderBandaLink(song, cifraIndex)}
      </div>
    </div>
  `;
}

function renderProgramacaoBox(item = {}, isFirst = false, cifraIndex = []) {
  const countdown = buildCountdown(item.date, item.time);
  const songs = Array.isArray(item.songs) ? item.songs : [];
  const metaParts = [
    { icon: '📅', text: fmtDate(item.date) },
    { icon: '🕘', text: item.time || '--:--' },
    item.location ? { icon: '📍', text: item.location } : null
  ].filter(Boolean);

  return `
    <div class="programacao-box${isFirst ? " programacao-box--primary" : ""}">
      <div class="programacao-box-topline"></div>
      <div class="programacao-header">
        <div class="programacao-header-main">
          <h3>${escapeHtml(item.title || "Programação")}</h3>
          <div class="programacao-meta">
            ${metaParts.map((part) => `
              <span class="programacao-meta-chip">
                <span class="programacao-meta-icon" aria-hidden="true">${part.icon}</span>
                <span>${escapeHtml(part.text)}</span>
              </span>
            `).join('')}
          </div>
        </div>
        ${countdown ? `<span class="programacao-countdown">${escapeHtml(countdown)}</span>` : ''}
      </div>
      <div class="programacao-lista">
        ${songs.map((song, index) => renderSongLine(song, index, cifraIndex)).join("")}
      </div>
    </div>
  `;
}

export async function renderProgramacaoCard() {
  const box = document.getElementById("programacao-card");
  if (!box) return;

  try {
    const [upcoming, cifras] = await Promise.all([
      listUpcomingProgramacoes(),
      listCifras(true)
    ]);

    if (!upcoming.length) {
      box.innerHTML = `
        <div class="programacao-box">
          <p>Nenhuma programação futura cadastrada.</p>
        </div>
      `;
      return;
    }

    box.innerHTML = upcoming
      .map((item, index) => renderProgramacaoBox(item, index === 0, cifras || []))
      .join("");
  } catch (error) {
    console.error("Erro ao renderizar programação da home:", error);
    box.innerHTML = `
      <div class="programacao-box">
        <p>Não foi possível carregar as programações.</p>
      </div>
    `;
  }
}
