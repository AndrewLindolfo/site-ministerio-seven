import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import * as pdfjs from "../assets/vendor/pdfjs/pdf.min.mjs";
import { joinTextItems, prepareChordImport } from "../assets/js/services/pdf-chord-import-service.js";

const pdfPath = process.env.SEVEN_REAL_PDF || "";
const projectId = "demo-ministerio-seven-pdf";
const admin = { uid: "pdf-test-admin", email: "pdf-test@ministerioseven.local", email_verified: true };
let testEnv;

async function extractRealPdf(path) {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("../assets/vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await readFile(path)), useWorkerFetch: false }).promise;
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      pages.push(joinTextItems((await page.getTextContent({ includeMarkedContent: false })).items));
      page.cleanup();
    }
    return { pageCount: pdf.numPages, ...prepareChordImport(pages.join("\n\n"), { title: "A Bênção", subtitle: "Gabriel Guedes" }) };
  } finally {
    await pdf.destroy();
  }
}

before(async () => {
  if (!pdfPath) return;
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8") }
  });
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "admins", "master"), {
      name: "Administrador do teste de PDF",
      email: admin.email,
      uid: admin.uid,
      active: true,
      isPrimary: true
    });
  });
});

after(async () => {
  await testEnv?.cleanup();
});

test("cadastra uma música ausente e vincula a cifra extraída do PDF real", { skip: !pdfPath && "Defina SEVEN_REAL_PDF para executar o teste real." }, async () => {
  const imported = await extractRealPdf(pdfPath);
  assert.equal(imported.pageCount, 2);
  assert.equal(imported.originalKey, "Bb");
  assert.equal(imported.bpm, "150");
  assert.match(imported.contentText, /^\[Intro\] Gm7\s+Eb7M\s+Bb\s+F4\s+F/m);
  assert.match(imported.contentText, /Amém, amém/);
  assert.doesNotMatch(imported.contentText, /^A BENÇÃO$/m);

  const db = testEnv.authenticatedContext(admin.uid, { email: admin.email, email_verified: true }).firestore();
  const musicId = "a-bencao-gabriel-guedes";
  const chordId = "a-bencao-gabriel-guedes-violao";

  await assertSucceeds(setDoc(doc(db, "musicas", musicId), {
    title: "A Bênção",
    slug: "a-bencao",
    normalizedTitle: "a bencao",
    subtitle: "Gabriel Guedes",
    author: "",
    originalKey: imported.originalKey,
    category: "",
    youtubeUrl: "",
    internalNotes: "Cadastro criado no teste real de importação de PDF.",
    lyricHtml: "",
    views: 0,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));

  await assertSucceeds(setDoc(doc(db, "cifras", chordId), {
    musicaId: musicId,
    title: "A Bênção",
    slug: "a-bencao",
    normalizedTitle: "a bencao",
    subtitle: "Gabriel Guedes",
    cifraText: imported.contentText,
    cifraHtml: imported.contentText.split("\n").map((line) => line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll(" ", "&nbsp;")).join("<br>"),
    originalKey: imported.originalKey,
    capo: imported.capo,
    bpm: imported.bpm,
    compasso: "",
    instrumento: "violao",
    chordColor: "#f90101",
    views: 0,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));

  const storedMusic = await assertSucceeds(getDoc(doc(db, "musicas", musicId)));
  const storedChord = await assertSucceeds(getDoc(doc(db, "cifras", chordId)));
  assert.equal(storedMusic.data().title, "A Bênção");
  assert.equal(storedChord.data().musicaId, storedMusic.id);
  assert.equal(storedChord.data().originalKey, "Bb");
  assert.equal(storedChord.data().bpm, "150");
  assert.equal(storedChord.data().cifraText, imported.contentText);

  const publicDb = testEnv.unauthenticatedContext().firestore();
  const publicMusic = await assertSucceeds(getDocs(query(collection(publicDb, "musicas"), where("active", "==", true))));
  const publicChord = await assertSucceeds(getDocs(query(collection(publicDb, "cifras"), where("active", "==", true))));
  assert.equal(publicMusic.docs.some((item) => item.id === musicId), true);
  assert.equal(publicChord.docs.some((item) => item.data().musicaId === musicId), true);
});
