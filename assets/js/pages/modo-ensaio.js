import { getModoEnsaio, listModoEnsaioSongs } from "../services/modo-ensaio-service.js";
import { getMusica } from "../services/musicas-service.js";
import { getCifra, getInstrumentLabel } from "../services/cifras-service.js";
import { sanitizeRichHtml } from "../lib/sanitize-html.js";
import { watchCollection, watchDocument } from "../db.js";
import { transposeText, transposeKeyLabel } from "../modules/cifra-formatter.js";
import { analyzeChordText, cleanChordToken, shouldFormatChordToken } from "../modules/chord-symbol.js";
import { initTheme } from "../theme.js";
import { initThemeBranding } from "../modules/theme-branding.js";

const sessionId = new URLSearchParams(location.search).get("id") || "";
const state = { session: null, songs: [], index: 0, view: "chord", transpose: 0, fontSize: 22, scrollTimer: 0, metronomeTimer: 0, audio: null, beat: 0, wakeLock: null, liveUnsubscribers: [] };
const $ = (selector) => document.querySelector(selector);

function showError(message) { $(".modo-palco-header").classList.add("hidden"); $(".modo-palco-shell").classList.add("hidden"); $("#modo-error-message").textContent = message; $("#modo-error").classList.remove("hidden"); }
function stripHtml(html = "") { const box = document.createElement("div"); box.innerHTML = sanitizeRichHtml(html); return (box.innerText || box.textContent || "").replace(/\r\n?/g, "\n"); }
function formatDate(value = "") { if (!value) return ""; return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR"); }
function timestampKey(value) { return value ? `${value.seconds ?? ""}:${value.nanoseconds ?? ""}` : ""; }
function songVersion(rows = []) { return [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id))).map((item) => `${item.id}:${item.order}:${timestampKey(item.updatedAt)}`).join("|"); }
function showUpdateNotice() { $("#update-notice").classList.remove("hidden"); }
function openSetlist() { $("#setlist-panel").classList.add("is-open"); $("#setlist-backdrop").classList.remove("hidden"); $("#setlist-toggle").setAttribute("aria-expanded", "true"); }
function closeSetlist() { $("#setlist-panel").classList.remove("is-open"); $("#setlist-backdrop").classList.add("hidden"); $("#setlist-toggle").setAttribute("aria-expanded", "false"); }

function startLiveUpdates() {
  const initialSessionVersion = timestampKey(state.session?.updatedAt);
  const initialSongsVersion = songVersion(state.songs);
  state.liveUnsubscribers.push(watchDocument("modoEnsaios", sessionId, (item) => {
    if (!item || timestampKey(item.updatedAt) !== initialSessionVersion) showUpdateNotice();
  }, showUpdateNotice));
  state.liveUnsubscribers.push(watchCollection("modoEnsaioMusicas", (rows) => {
    if (songVersion(rows) !== initialSongsVersion) showUpdateNotice();
  }, { where: [["sessionId", "==", sessionId]] }, showUpdateNotice));
}

function appendChordLine(container, line) {
  const row = document.createElement("div"); row.className = "modo-line"; const analysis = analyzeChordText(line);
  String(line).split(/(\s+)/).forEach((token) => { if (!token) return; if (shouldFormatChordToken(token, analysis)) { const span = document.createElement("span"); span.className = "modo-chord"; span.textContent = token; span.dataset.chordSymbol = cleanChordToken(token).token; row.append(span); } else row.append(document.createTextNode(token)); });
  container.append(row);
}

function renderTextContent(text = "") { const content = $("#stage-content"); content.replaceChildren(); text.split("\n").forEach((line) => appendChordLine(content, line)); }

async function resolveCurrent() {
  const row = state.songs[state.index];
  if (!row) return null;
  const [music, cifra] = await Promise.all([getMusica(row.musicaId), row.cifraId ? getCifra(row.cifraId) : Promise.resolve(null)]);
  return { row, music, cifra };
}

async function renderCurrent(resetTranspose = true) {
  stopAutoScroll(); stopMetronome(); if (resetTranspose) state.transpose = 0;
  const data = await resolveCurrent(); if (!data) return;
  const { row, music, cifra } = data; const title = music?.title || row.title; const hasCifra = Boolean(cifra);
  $("#song-title").textContent = title; $("#song-position").textContent = `Música ${state.index + 1} de ${state.songs.length}`; $("#song-progress").textContent = `${state.index + 1}/${state.songs.length}`;
  const key = hasCifra ? (cifra.originalKey || row.originalKey) : ""; const details = [key ? `Tom ${transposeKeyLabel(key, state.transpose)}` : "", hasCifra ? getInstrumentLabel(cifra.instrumento || row.instrumento) : "Somente letra", (cifra?.bpm || row.bpm) ? `${cifra?.bpm || row.bpm} BPM` : "", cifra?.compasso || row.compasso].filter(Boolean); $("#song-details").textContent = details.join(" • ");
  $("#song-note").textContent = row.notes || ""; $("#song-note").classList.toggle("hidden", !row.notes);
  $("#view-toggle").classList.toggle("hidden", !hasCifra); $("#view-toggle").textContent = state.view === "chord" ? "Cifra" : "Letra"; $("#view-toggle").setAttribute("aria-label", state.view === "chord" ? "Exibindo cifra; mudar para letra" : "Exibindo letra; mudar para cifra"); $("#transpose-controls").classList.toggle("hidden", !hasCifra || state.view !== "chord"); $("#metronome-controls").classList.toggle("hidden", !(cifra?.bpm || row.bpm)); $("#metronome-label").textContent = (cifra?.bpm || row.bpm) ? `${cifra?.bpm || row.bpm} BPM • ${cifra?.compasso || row.compasso || "4/4"}` : "";
  const lyricHtml = music?.lyricHtml || ""; const chordText = cifra?.cifraText || stripHtml(cifra?.cifraHtml || "");
  if (state.view === "chord" && chordText) renderTextContent(transposeText(chordText, state.transpose)); else { $("#stage-content").innerHTML = sanitizeRichHtml(lyricHtml) || `<p>Letra não disponível.</p>`; }
  $("#stage-content").style.fontSize = `${state.fontSize}px`; $("#transpose-reset").textContent = state.transpose ? `Original (${state.transpose > 0 ? "+" : ""}${state.transpose})` : "Original"; $("#transpose-reset").classList.toggle("is-active", state.transpose !== 0); $("#previous-song").disabled = state.index === 0; $("#next-song").disabled = state.index === state.songs.length - 1;
  document.querySelectorAll("#setlist li").forEach((li, index) => li.classList.toggle("is-current", index === state.index));
  $("#stage-content").scrollTop = 0;
}

function renderSetlist() { const list = $("#setlist"); list.replaceChildren(); state.songs.forEach((song, index) => { const li = document.createElement("li"); const button = document.createElement("button"); button.type = "button"; button.innerHTML = `<span>${index + 1}</span><strong></strong>`; button.querySelector("strong").textContent = song.title; button.onclick = () => { state.index = index; closeSetlist(); renderCurrent(); }; li.append(button); list.append(li); }); }
function updateAutoScrollButton(running) { const button = $("#scroll-toggle"); if (!button) return; button.classList.toggle("is-active", running); button.textContent = running ? "Pausar rolagem" : "Auto-rolagem"; }
function stopAutoScroll() { if (state.scrollTimer) cancelAnimationFrame(state.scrollTimer); state.scrollTimer = 0; updateAutoScrollButton(false); }
function toggleAutoScroll() { if (state.scrollTimer) return stopAutoScroll(); const content = $("#stage-content"); if (content.scrollHeight <= content.clientHeight + 2) return; let last = performance.now(); let remainder = 0; const tick = (now) => { const elapsed = Math.min(100, now - last); last = now; const pixelsPerSecond = 8 + Number($("#scroll-speed").value) * 8; remainder += pixelsPerSecond * elapsed / 1000; const pixels = Math.floor(remainder); if (pixels > 0) { content.scrollTop += pixels; remainder -= pixels; } if (content.scrollTop + content.clientHeight >= content.scrollHeight - 2) return stopAutoScroll(); state.scrollTimer = requestAnimationFrame(tick); }; updateAutoScrollButton(true); state.scrollTimer = requestAnimationFrame(tick); }
function stopMetronome() { if (state.metronomeTimer) clearInterval(state.metronomeTimer); state.metronomeTimer = 0; state.beat = 0; $("#metronome-toggle")?.classList.remove("is-active"); }
function clickBeat(accent) { const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (!AudioContextClass) return; state.audio ||= new AudioContextClass(); const oscillator = state.audio.createOscillator(); const gain = state.audio.createGain(); oscillator.frequency.value = accent ? 1200 : 850; gain.gain.setValueAtTime(.12, state.audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, state.audio.currentTime + .05); oscillator.connect(gain).connect(state.audio.destination); oscillator.start(); oscillator.stop(state.audio.currentTime + .055); const dot = $("#beat-indicator"); dot.classList.remove("pulse"); requestAnimationFrame(() => dot.classList.add("pulse")); }
async function toggleMetronome() { if (state.metronomeTimer) return stopMetronome(); const row = state.songs[state.index]; const cifra = row.cifraId ? await getCifra(row.cifraId) : null; const bpm = Number(cifra?.bpm || row.bpm); if (!bpm) return; const beats = Number((cifra?.compasso || row.compasso || "4/4").split("/")[0]) || 4; state.beat = 0; clickBeat(true); state.metronomeTimer = setInterval(() => { state.beat = (state.beat + 1) % beats; clickBeat(state.beat === 0); }, 60000 / bpm); $("#metronome-toggle").classList.add("is-active"); }
async function toggleWakeLock() { try { if (state.wakeLock) { await state.wakeLock.release(); state.wakeLock = null; $("#wake-lock").classList.remove("is-active"); return; } if (!("wakeLock" in navigator)) throw new Error(); state.wakeLock = await navigator.wakeLock.request("screen"); $("#wake-lock").classList.add("is-active"); state.wakeLock.addEventListener("release", () => { state.wakeLock = null; $("#wake-lock").classList.remove("is-active"); }); } catch { alert("Este navegador não permite manter a tela ligada automaticamente."); } }
async function share() { const data = { title: state.session.title, text: `Modo Ensaio — ${state.session.title}`, url: location.href }; if (navigator.share) await navigator.share(data).catch(() => {}); else { await navigator.clipboard.writeText(location.href); alert("Link copiado."); } }

async function init() {
  initTheme(); initThemeBranding();
  if (!sessionId) return showError("O link não contém uma sessão válida.");
  try { state.session = await getModoEnsaio(sessionId); if (!state.session?.active) throw new Error("Este link não existe ou foi desativado pelo administrador."); state.songs = await listModoEnsaioSongs(sessionId); if (!state.songs.length) throw new Error("Este repertório ainda não possui músicas."); $("#session-title").textContent = state.session.title; $("#session-meta").textContent = [formatDate(state.session.date), state.session.time, state.session.location].filter(Boolean).join(" • "); document.title = `${state.session.title} | Modo Ensaio`; renderSetlist(); await renderCurrent(); startLiveUpdates(); $(".modo-palco-header").classList.remove("hidden"); $(".modo-palco-shell").classList.remove("hidden"); } catch (error) { showError(error.message || "Não foi possível abrir este modo ensaio."); }
}

$("#previous-song").onclick = () => { if (state.index > 0) { state.index--; renderCurrent(); } }; $("#next-song").onclick = () => { if (state.index < state.songs.length - 1) { state.index++; renderCurrent(); } };
$("#view-toggle").onclick = () => { state.view = state.view === "chord" ? "lyrics" : "chord"; renderCurrent(false); };
$("#font-down").onclick = () => { state.fontSize = Math.max(14, state.fontSize - 2); $("#stage-content").style.fontSize = `${state.fontSize}px`; }; $("#font-up").onclick = () => { state.fontSize = Math.min(42, state.fontSize + 2); $("#stage-content").style.fontSize = `${state.fontSize}px`; };
$("#transpose-down").onclick = () => { state.transpose--; renderCurrent(false); }; $("#transpose-reset").onclick = () => { state.transpose = 0; renderCurrent(false); }; $("#transpose-up").onclick = () => { state.transpose++; renderCurrent(false); }; $("#scroll-toggle").onclick = toggleAutoScroll; $("#metronome-toggle").onclick = toggleMetronome; $("#wake-lock").onclick = toggleWakeLock; $("#share-session").onclick = share; $("#fullscreen").onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
document.addEventListener("keydown", (event) => { if (["ArrowLeft", "PageUp"].includes(event.key)) $("#previous-song").click(); if (["ArrowRight", "PageDown"].includes(event.key)) $("#next-song").click(); if (event.key === " ") { event.preventDefault(); toggleAutoScroll(); } });
$("#setlist-toggle").onclick = openSetlist; $("#setlist-close").onclick = closeSetlist; $("#setlist-backdrop").onclick = closeSetlist; $("#reload-session").onclick = () => location.reload();
window.addEventListener("beforeunload", () => state.liveUnsubscribers.forEach((unsubscribe) => unsubscribe?.()));
init();
