import { applicationDefault, deleteApp, initializeApp } from "../functions/node_modules/firebase-admin/lib/app/index.js";
import { getFirestore } from "../functions/node_modules/firebase-admin/lib/firestore/index.js";

const projectId = String(process.env.FIREBASE_PROJECT_ID || "ministerio-seven-site").trim();
const app = initializeApp({ credential: applicationDefault(), projectId }, "modo-ensaio-integrity-audit");
const db = getFirestore(app);

try {
  const [sessionsSnapshot, songsSnapshot, musicSnapshot, chordsSnapshot] = await Promise.all([
    db.collection("modoEnsaios").get(),
    db.collection("modoEnsaioMusicas").get(),
    db.collection("musicas").get(),
    db.collection("cifras").get()
  ]);
  const sessions = new Map(sessionsSnapshot.docs.map((item) => [item.id, item.data()]));
  const music = new Map(musicSnapshot.docs.map((item) => [item.id, item.data()]));
  const chords = new Map(chordsSnapshot.docs.map((item) => [item.id, item.data()]));
  const errors = [];
  const warnings = [];
  const countsBySession = new Map();

  for (const item of songsSnapshot.docs) {
    const song = item.data();
    const sessionId = String(song.sessionId || "").trim();
    const musicaId = String(song.musicaId || "").trim();
    const cifraId = String(song.cifraId || "").trim();
    countsBySession.set(sessionId, (countsBySession.get(sessionId) || 0) + 1);
    if (!sessions.has(sessionId)) errors.push({ type: "orphan-session-song", id: item.id, sessionId });
    if (!music.has(musicaId)) errors.push({ type: "orphan-music", id: item.id, sessionId, musicaId });
    if (cifraId) {
      const chord = chords.get(cifraId);
      if (!chord) errors.push({ type: "orphan-chord", id: item.id, sessionId, cifraId });
      else if (String(chord.musicaId || "").trim() !== musicaId) {
        errors.push({ type: "mismatched-chord", id: item.id, sessionId, musicaId, cifraId });
      }
    }
  }

  for (const [id, session] of sessions) {
    if (session.active === true && !countsBySession.get(id)) {
      warnings.push({ type: "empty-active-session", id, title: session.title || "" });
    }
  }

  const report = {
    projectId,
    checkedAt: new Date().toISOString(),
    counts: {
      sessions: sessions.size,
      sessionSongs: songsSnapshot.size,
      music: music.size,
      chords: chords.size
    },
    status: errors.length ? "failed" : "ok",
    errors,
    warnings
  };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = errors.length ? 1 : 0;
} catch (error) {
  console.error(JSON.stringify({ projectId, status: "error", message: error?.message || String(error) }, null, 2));
  process.exitCode = 2;
} finally {
  await deleteApp(app).catch(() => {});
}
