import { watchAuth, getAdminProfileByEmail } from "../auth.js";
import { hasPermission, getAllowedCifraInstruments, canManageCifraInstrument } from "../services/admin-permissions-service.js";
import "../editor.js";
import { setCifraEditorHtml, getCifraEditorPlainText, getCifraEditorHtml } from "../editor.js";
import { listMusicas, getMusica } from "../services/musicas-service.js";
import { getCifra, saveCifra, findDuplicateCifraInstrument, removeCifra } from "../services/cifras-service.js";
import { explainFirebaseError } from "../db.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

const params = new URLSearchParams(window.location.search);
const cifraId = params.get("id") || "";
let selectedMusicaId = "";
let currentAdmin = null;

const INSTRUMENT_LABELS = {
  violao: "Violão",
  guitarra: "Guitarra",
  baixo: "Baixo",
  teclado: "Teclado"
};

const CHORD_COLOR_HEX = {
  padrao: "#FF5C00",
  preto: "#0d0d0d",
  azul: "#3b82f6",
  vermelho: "#ef4444",
  verde: "#22c55e",
  amarelo: "#eab308",
  roxo: "#a855f7",
  laranja: "#FF5C00"
};

function normalizeChordColor(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return CHORD_COLOR_HEX.padrao;
  const lowered = raw.toLowerCase();
  if (CHORD_COLOR_HEX[lowered]) return CHORD_COLOR_HEX[lowered];
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  return CHORD_COLOR_HEX.padrao;
}

async function renderMusicaSearch(term = "") {
  const box = document.getElementById("cifra-musica-resultados");
  if (!box) return;

  const all = await listMusicas(true);
  const filtered = all
    .filter((item) => String(item.title || "").toLowerCase().includes(String(term || "").trim().toLowerCase()))
    .slice(0, 8);

  box.innerHTML = filtered.map((item) => `
    <button type="button" class="button-outline" data-musica-id="${item.id}" data-musica-title="${item.title}">
      ${item.title}
    </button>
  `).join("");

  box.querySelectorAll("[data-musica-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedMusicaId = button.dataset.musicaId;
      document.getElementById("cifra-musica-search").value = button.dataset.musicaTitle;
      box.innerHTML = `<p>Música vinculada: <strong>${button.dataset.musicaTitle}</strong></p>`;
    });
  });
}


function setInstrumentOptionsForAdmin(admin, preferredInstrument = "") {
  const select = document.getElementById("cifra-instrumento");
  if (!select) return;

  const allowed = getAllowedCifraInstruments(admin);
  const options = Array.from(select.options);

  options.forEach((option) => {
    option.hidden = !allowed.includes(option.value);
    option.disabled = !allowed.includes(option.value);
  });

  if (preferredInstrument && allowed.includes(preferredInstrument)) {
    select.value = preferredInstrument;
    return;
  }

  if (!allowed.includes(select.value)) {
    select.value = allowed[0] || "";
  }
}

function ensureInstrumentAccess(admin, instrument = "") {
  if (canManageCifraInstrument(admin, instrument || "violao")) return true;
  alert("Você não tem permissão para gerenciar cifras deste instrumento.");
  window.location.href = "./cifras.html";
  return false;
}

function waitForCifraEditor(timeout = 5000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (window.tinymce?.get("cifra-conteudo")) {
        resolve(true);
        return;
      }
      if (Date.now() - started > timeout) {
        resolve(false);
        return;
      }
      setTimeout(tick, 120);
    };
    tick();
  });
}

async function loadCifraIfEditing() {
  if (!cifraId) {
    await renderMusicaSearch("");
    setInstrumentOptionsForAdmin(currentAdmin);
    return;
  }

  const cifra = await getCifra(cifraId);
  if (!cifra) {
    await renderMusicaSearch("");
    setInstrumentOptionsForAdmin(currentAdmin);
    return;
  }

  if (!ensureInstrumentAccess(currentAdmin, cifra.instrumento || "violao")) return;

  selectedMusicaId = cifra.musicaId || "";
  document.getElementById("cifra-musica-search").value = cifra.title || "";
  document.getElementById("cifra-tom").value = cifra.originalKey || cifra.tonality || cifra.tom || "";
  document.getElementById("cifra-capo").value = cifra.capo || "";
  document.getElementById("cifra-bpm").value = cifra.bpm || "";
  document.getElementById("cifra-compasso").value = cifra.compasso || "";
  document.getElementById("cifra-instrumento").value = String(cifra.instrumento || "violao").toLowerCase();
  setInstrumentOptionsForAdmin(currentAdmin, String(cifra.instrumento || "violao").toLowerCase());
  document.getElementById("cifra-chord-color").value = normalizeChordColor(cifra.chordColor || "#FF5C00");

  await waitForCifraEditor();
  setCifraEditorHtml(String(cifra.cifraHtml || cifra.cifraText || "").replace(/\r\n?/g, "\n"));

  const box = document.getElementById("cifra-musica-resultados");
  if (box && cifra.title) {
    box.innerHTML = `<p>Música vinculada: <strong>${cifra.title}</strong></p>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("cifra-musica-search")?.addEventListener("input", async (event) => {
    selectedMusicaId = "";
    await renderMusicaSearch(event.target.value);
  });

  document.getElementById("admin-editor-cifra-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = event.target.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      if (!selectedMusicaId) {
        alert("Selecione uma música vinculada.");
        return;
      }

      const instrumento = String(document.getElementById("cifra-instrumento")?.value || "violao").trim().toLowerCase();
      if (!canManageCifraInstrument(currentAdmin, instrumento)) {
        alert("Você não tem permissão para salvar cifras deste instrumento.");
        return;
      }
      const musica = await getMusica(selectedMusicaId);
      const title = musica?.title || document.getElementById("cifra-musica-search")?.value?.trim() || "";

      const duplicate = await findDuplicateCifraInstrument(selectedMusicaId, instrumento, cifraId);
      if (duplicate) {
        const instrumentoNome = INSTRUMENT_LABELS[instrumento] || instrumento;
        const editExisting = confirm(`Já existe uma cifra de ${instrumentoNome} para esta música. Deseja editar a existente?`);
        if (editExisting) {
          window.location.href = `./editor-cifra.html?id=${duplicate.id}`;
        }
        return;
      }

      const cifraText = getCifraEditorPlainText().replace(/\r\n?/g, "\n");
      const cifraHtml = getCifraEditorHtml();
      const bpm = document.getElementById("cifra-bpm")?.value?.trim() || "";
      const compasso = document.getElementById("cifra-compasso")?.value?.trim() || "";

      if ((bpm && !compasso) || (!bpm && compasso)) {
        alert("Se preencher BPM, o compasso também é obrigatório. Se selecionar um compasso, o BPM também é obrigatório.");
        return;
      }

      const payload = {
        musicaId: selectedMusicaId,
        title,
        subtitle: musica?.subtitle || "",
        cifraText,
        cifraHtml,
        originalKey: document.getElementById("cifra-tom")?.value?.trim() || "",
        capo: document.getElementById("cifra-capo")?.value?.trim() || "",
        bpm,
        compasso,
        instrumento,
        chordColor: normalizeChordColor(document.getElementById("cifra-chord-color")?.value || "#0d0d0d"),
        active: true
      };

      const savedId = await saveCifra(payload, cifraId);
      await recordAdminActivity({
        action: cifraId ? "update" : "create",
        module: "cifras",
        itemId: savedId,
        itemName: `${title}${instrumento ? ` (${INSTRUMENT_LABELS[instrumento] || instrumento})` : ""}`
      });
      alert(cifraId ? "✅ Cifra atualizada com sucesso!" : "✅ Cifra cadastrada com sucesso!");
      window.location.href = "./cifras.html";
    } catch (error) {
      console.error("Erro ao salvar cifra:", error);
      alert("Erro ao salvar cifra no Firebase.\n\n" + explainFirebaseError(error));
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.getElementById("delete-cifra-button")?.addEventListener("click", async () => {
    if (!cifraId) {
      alert("Esta cifra ainda não foi salva.");
      return;
    }

    try {
      const currentInstrument = String(document.getElementById("cifra-instrumento")?.value || "violao").trim().toLowerCase();
      if (!canManageCifraInstrument(currentAdmin, currentInstrument)) {
        alert("Você não tem permissão para excluir cifras deste instrumento.");
        return;
      }
      if (!confirm("Deseja excluir esta cifra?")) return;
      const cifraName = document.getElementById("cifra-musica-search")?.value?.trim() || "Cifra";
      await removeCifra(cifraId);
      await recordAdminActivity({ action: "delete", module: "cifras", itemId: cifraId, itemName: cifraName });
      alert("🗑️ Cifra excluída com sucesso!");
      window.location.href = "./cifras.html";
    } catch (error) {
      console.error(error);
      alert("Erro ao excluir cifra no Firebase.\n\n" + explainFirebaseError(error));
    }
  });
});

function hideField(el) {
  if (!el) return;
  const label = el.closest('label');
  const block = el.closest('.admin-field-block');
  (label || block || el).classList.add('hidden');
}

watchAuth(async (user) => {
  if (!user?.email) return;
  const admin = await getAdminProfileByEmail(user.email);
  if (!admin) return;
  currentAdmin = admin;
  await loadCifraIfEditing();
  const allowedInstruments = getAllowedCifraInstruments(admin);
  const isEdit = !!cifraId;
  const canSave = isEdit ? hasPermission(admin, 'cifras', 'edit') : hasPermission(admin, 'cifras', 'create');
  const canDelete = isEdit && hasPermission(admin, 'cifras', 'delete');
  document.querySelector('#admin-editor-cifra-form button[type="submit"]')?.classList.toggle('hidden', !canSave || !allowedInstruments.length);
  document.getElementById('delete-cifra-button')?.classList.toggle('hidden', !canDelete || !allowedInstruments.length);
  if (!hasPermission(admin, 'cifras', 'capo')) hideField(document.getElementById('cifra-capo'));
  if (!hasPermission(admin, 'cifras', 'bpm')) hideField(document.getElementById('cifra-bpm'));
  if (!hasPermission(admin, 'cifras', 'compasso')) hideField(document.getElementById('cifra-compasso'));
  if (!allowedInstruments.length) {
    hideField(document.getElementById('cifra-instrumento'));
  } else {
    setInstrumentOptionsForAdmin(admin, document.getElementById('cifra-instrumento')?.value || '');
  }
});
