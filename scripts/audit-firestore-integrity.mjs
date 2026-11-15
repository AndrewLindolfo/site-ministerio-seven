import { deleteApp, initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore, query, where } from "firebase/firestore";

const projectId = String(process.env.FIREBASE_PROJECT_ID || "ministerio-seven-site").trim();
const apiKey = String(process.env.FIREBASE_API_KEY || "AIzaSyD4PbLKQIUjrU3rY4aaQ1hW7xNpLmR3F4s").trim();

if (!projectId || !apiKey) throw new Error("Informe FIREBASE_PROJECT_ID e FIREBASE_API_KEY.");

const app = initializeApp({
  apiKey,
  authDomain: `${projectId}.firebaseapp.com`,
  projectId
}, "firestore-integrity-audit");
const db = getFirestore(app);

function normalize(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function listActive(collectionName) {
  const snapshot = await getDocs(query(
    collection(db, collectionName),
    where("active", "==", true)
  ));
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

function duplicateGroups(items, keyBuilder) {
  const groups = new Map();
  for (const item of items) {
    const key = keyBuilder(item);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([key, values]) => ({
      key,
      records: values.map(({ id, title, musicaId, instrumento, slug }) => ({
        id, title, musicaId, instrumento, slug
      }))
    }));
}

try {
  const [musicas, cifras, downloads, programacoes] = await Promise.all([
    listActive("musicas"),
    listActive("cifras"),
    listActive("downloadsPorMusica"),
    listActive("programacoes")
  ]);

  const musicById = new Map(musicas.map((music) => [music.id, music]));
  const errors = [];
  const warnings = [];

  for (const cifra of cifras) {
    const musicaId = String(cifra.musicaId || "").trim();
    const music = musicById.get(musicaId);
    if (!music) {
      errors.push({ type: "orphan-chord", id: cifra.id, title: cifra.title, musicaId });
    } else if (normalize(cifra.title) !== normalize(music.title)) {
      warnings.push({
        type: "chord-title-mismatch",
        id: cifra.id,
        chordTitle: cifra.title,
        musicTitle: music.title,
        musicaId
      });
    }
  }

  for (const download of downloads) {
    const musicaId = String(download.musicaId || "").trim();
    if (!musicById.has(musicaId)) {
      errors.push({ type: "orphan-music-download", id: download.id, title: download.title, musicaId });
    }
  }

  for (const programacao of programacoes) {
    const songs = Array.isArray(programacao.songs) ? programacao.songs : [];
    for (const [position, song] of songs.entries()) {
      const musicaId = String(song?.musicaId || song?.id || "").trim();
      if (!musicaId || !musicById.has(musicaId)) {
        errors.push({
          type: "orphan-program-song",
          programId: programacao.id,
          programTitle: programacao.title,
          position,
          title: song?.title || song?.name || "",
          musicaId
        });
      }
    }
  }

  const duplicateMusicTitles = duplicateGroups(musicas, (item) => normalize(item.title));
  const duplicateMusicSlugs = duplicateGroups(musicas, (item) => String(item.slug || "").trim());
  const duplicateChords = duplicateGroups(
    cifras,
    (item) => `${String(item.musicaId || "").trim()}::${String(item.instrumento || "violao").trim()}`
  );

  for (const duplicate of duplicateMusicTitles) errors.push({ type: "duplicate-music-title", ...duplicate });
  for (const duplicate of duplicateMusicSlugs) errors.push({ type: "duplicate-music-slug", ...duplicate });
  for (const duplicate of duplicateChords) errors.push({ type: "duplicate-chord-instrument", ...duplicate });

  const report = {
    projectId,
    checkedAt: new Date().toISOString(),
    counts: {
      activeMusic: musicas.length,
      activeChords: cifras.length,
      activeMusicDownloads: downloads.length,
      activePrograms: programacoes.length,
      programSongReferences: programacoes.reduce(
        (total, programacao) => total + (Array.isArray(programacao.songs) ? programacao.songs.length : 0),
        0
      )
    },
    status: errors.length ? "failed" : "ok",
    errors,
    warnings
  };

  console.log(JSON.stringify(report, null, 2));
  await deleteApp(app);
  process.exit(errors.length ? 1 : 0);
} catch (error) {
  console.error(JSON.stringify({
    projectId,
    checkedAt: new Date().toISOString(),
    status: "error",
    message: error?.message || String(error)
  }, null, 2));
  await deleteApp(app).catch(() => {});
  process.exit(2);
}
