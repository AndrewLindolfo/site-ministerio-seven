import { watchAuth, getAdminProfileByEmail } from "../auth.js";
import { hasPermission } from "../services/admin-permissions-service.js";
import { listMusicas } from "../services/musicas-service.js";
import { createEnsaio, updateEnsaio, removeEnsaio, getEnsaio } from "../services/ensaios-service.js";
import { explainFirebaseError } from "../db.js";

const params = new URLSearchParams(window.location.search);
const ensaioId = params.get("id") || "";
const state = { musicas: [], selectedSongs: [] };

const els = {};

document.addEventListener('DOMContentLoaded', async () => {
  mapElements();
  bindEvents();
  await loadPage();
});

function mapElements() {
  els.pageTitle = document.getElementById('editor-ensaio-title');
  els.form = document.getElementById('editor-ensaio-form');
  els.titulo = document.getElementById('ensaio-titulo');
  els.descricao = document.getElementById('ensaio-descricao');
  els.busca = document.getElementById('ensaio-busca-musica');
  els.searchResults = document.getElementById('ensaio-resultado-busca');
  els.selectedList = document.getElementById('ensaio-musicas-selecionadas');
  els.deleteButton = document.getElementById('delete-ensaio-button');
  els.saveButton = document.getElementById('salvar-ensaio-button');
}

function bindEvents() {
  els.busca?.addEventListener('input', renderMusicSearch);
  els.form?.addEventListener('submit', handleSubmit);
  els.deleteButton?.addEventListener('click', handleDelete);
}

async function loadPage() {
  state.musicas = await listMusicas(false);
  if (ensaioId) {
    const ensaio = await getEnsaio(ensaioId);
    if (ensaio) {
      if (els.pageTitle) els.pageTitle.textContent = 'Editar ensaio';
      if (els.saveButton) els.saveButton.textContent = 'Salvar alterações';
      if (els.titulo) els.titulo.value = ensaio.titulo || '';
      if (els.descricao) els.descricao.value = ensaio.descricao || '';
      state.selectedSongs = Array.isArray(ensaio.musicas) ? [...ensaio.musicas] : [];
    }
  } else {
    els.deleteButton?.classList.add('hidden');
  }
  renderMusicSearch();
  renderSelectedSongs();
}

function normalizeText(value = '') {
  return String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function renderMusicSearch() {
  if (!els.searchResults) return;
  const term = normalizeText(els.busca?.value || '');
  const selectedIds = new Set(state.selectedSongs.map((song) => song.id));
  const filtered = state.musicas.filter((song) => !selectedIds.has(song.id)).filter((song) => {
    const title = song.title || song.titulo || song.nome || '';
    return !term || normalizeText(title).includes(term);
  }).slice(0, 40);

  els.searchResults.innerHTML = '';
  if (!filtered.length) {
    els.searchResults.innerHTML = `<li class="ensaio-search-empty">${term ? 'Nenhuma música encontrada.' : 'Nenhuma música disponível para adicionar.'}</li>`;
    return;
  }

  filtered.forEach((song) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ensaio-search-item';
    button.textContent = song.title || song.titulo || song.nome || 'Música sem título';
    button.addEventListener('click', () => addSong(song));
    li.appendChild(button);
    els.searchResults.appendChild(li);
  });
}

function addSong(song) {
  state.selectedSongs.push({ id: song.id, titulo: song.title || song.titulo || song.nome || 'Música sem título', slug: song.slug || '' });
  if (els.busca) els.busca.value = '';
  renderMusicSearch();
  renderSelectedSongs();
}

function renderSelectedSongs() {
  if (!els.selectedList) return;
  els.selectedList.innerHTML = '';
  if (!state.selectedSongs.length) {
    els.selectedList.innerHTML = '<li class="ensaio-selected-empty">Nenhuma música adicionada ainda.</li>';
    return;
  }
  state.selectedSongs.forEach((song, index) => {
    const li = document.createElement('li');
    li.className = 'ensaio-selected-item';
    li.innerHTML = `<span>${index + 1}. ${escapeHtml(song.titulo || '')}</span><div class="ensaio-selected-item__actions"><button type="button" class="btn-chip" data-up="${index}">↑</button><button type="button" class="btn-chip" data-down="${index}">↓</button><button type="button" class="btn-chip btn-chip--danger" data-remove="${index}">Remover</button></div>`;
    li.querySelector('[data-up]')?.addEventListener('click', () => moveSong(index, -1));
    li.querySelector('[data-down]')?.addEventListener('click', () => moveSong(index, 1));
    li.querySelector('[data-remove]')?.addEventListener('click', () => removeSong(index));
    els.selectedList.appendChild(li);
  });
}

function moveSong(index, delta) {
  const next = index + delta;
  if (next < 0 || next >= state.selectedSongs.length) return;
  const copy = [...state.selectedSongs];
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  state.selectedSongs = copy;
  renderSelectedSongs();
}

function removeSong(index) {
  state.selectedSongs.splice(index, 1);
  renderSelectedSongs();
  renderMusicSearch();
}

async function handleSubmit(event) {
  event.preventDefault();
  const titulo = els.titulo?.value?.trim() || '';
  const descricao = els.descricao?.value?.trim() || '';
  if (!titulo) { alert('Preencha o título do ensaio.'); els.titulo?.focus(); return; }
  if (!state.selectedSongs.length) { alert('Adicione pelo menos uma música ao ensaio.'); return; }
  const payload = { titulo, descricao, musicas: state.selectedSongs };
  try {
    if (ensaioId) await updateEnsaio(ensaioId, payload);
    else await createEnsaio(payload);
    alert(ensaioId ? '✅ Ensaio atualizado com sucesso!' : '✅ Ensaio cadastrado com sucesso!');
    window.location.href = './ensaios.html';
  } catch (error) {
    console.error('Erro ao salvar ensaio:', error);
    PLACEHOLDER
  }
}

async function handleDelete() {
  if (!ensaioId) return;
  if (!confirm('Deseja excluir este ensaio?')) return;
  try {
    await removeEnsaio(ensaioId);
    alert('🗑️ Ensaio excluído com sucesso!');
    window.location.href = './ensaios.html';
  } catch (error) {
    console.error('Erro ao excluir ensaio:', error);
    alert('Erro ao excluir ensaio no Firebase.\n\n' + explainFirebaseError(error));
  }
}

function escapeHtml(value = '') {
  return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}

watchAuth(async (user) => {
  if (!user?.email) return;
  const admin = await getAdminProfileByEmail(user.email);
  if (!admin) return;
  const isEdit = !!ensaioId;
  const canSave = isEdit ? hasPermission(admin, 'ensaios', 'edit') : hasPermission(admin, 'ensaios', 'create');
  const canDelete = isEdit && hasPermission(admin, 'ensaios', 'delete');
  els.saveButton?.classList.toggle('hidden', !canSave);
  els.deleteButton?.classList.toggle('hidden', !canDelete);
});
