import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";

const projectId = "ministerio-seven-rules-test";
const primaryAuth = {
  uid: "primary-uid",
  email: "primary@example.com",
  email_verified: true
};
const editorAuth = {
  uid: "editor-uid",
  email: "editor@example.com",
  email_verified: true
};
let testEnv;

function token(auth) {
  return { email: auth.email, email_verified: auth.email_verified };
}

function musica(overrides = {}) {
  return {
    title: "Música teste",
    slug: "musica-teste",
    normalizedTitle: "musica teste",
    subtitle: "",
    author: "",
    originalKey: "C",
    category: "",
    youtubeUrl: "",
    internalNotes: "",
    lyricHtml: "",
    views: 0,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides
  };
}

async function seedBaseData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "admins", "master"), {
      name: "Principal",
      email: primaryAuth.email,
      uid: primaryAuth.uid,
      active: true,
      isPrimary: true
    });
    await setDoc(doc(db, "admins", `email_${editorAuth.email}`), {
      name: "Editor",
      email: editorAuth.email,
      uid: editorAuth.uid,
      active: true,
      pendingUid: false,
      permissions: {
        musicas: { create: true, edit: true, delete: false },
        cifras: { create: false, edit: false, delete: false },
        contatos: { view: true, delete: false },
        notificacoes: {
          create: true, edit: true, delete: false,
          popup: false, top: false, buttonLink: false, beforeStart: false
        },
        logs: { view: false }
      }
    });
    await setDoc(doc(db, "musicas", "active-song"), musica());
    await setDoc(doc(db, "musicas", "hidden-song"), musica({ active: false, title: "Oculta", slug: "oculta" }));
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8") }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedBaseData();
});

after(async () => {
  await testEnv?.cleanup();
});

describe("public content", () => {
  test("visitors read active content but cannot read hidden content or write", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "musicas", "active-song")));
    await assertFails(getDoc(doc(db, "musicas", "hidden-song")));
    await assertFails(setDoc(doc(db, "musicas", "attack"), musica()));
  });

  test("public queries must constrain active content", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDocs(query(collection(db, "musicas"), where("active", "==", true))));
    await assertFails(getDocs(collection(db, "musicas")));
  });

  test("contact form accepts only the bounded public schema", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const valid = {
      nome: "Pessoa Teste",
      email: "pessoa@example.com",
      assunto: "Assunto",
      mensagem: "Mensagem de teste válida.",
      createdAt: serverTimestamp(),
      lido: false
    };
    await assertSucceeds(addDoc(collection(db, "contatos"), valid));
    await assertFails(addDoc(collection(db, "contatos"), { ...valid, role: "admin" }));
  });
});

describe("user-owned data", () => {
  test("users can access only their own bounded profile", async () => {
    const auth = { uid: "user-a", email: "user@example.com", email_verified: true };
    const db = testEnv.authenticatedContext(auth.uid, token(auth)).firestore();
    const profile = {
      firstName: "User",
      lastName: "Test",
      displayName: "User Test",
      email: auth.email,
      phone: "",
      photoURL: "",
      updatedAt: serverTimestamp()
    };
    await assertSucceeds(setDoc(doc(db, "usuariosPublicos", auth.uid), profile));
    await assertFails(setDoc(doc(db, "usuariosPublicos", "user-b"), profile));
    await assertFails(setDoc(doc(db, "usuariosPublicos", auth.uid), { ...profile, email: "other@example.com" }));
  });

  test("users cannot exceed top-level library limits", async () => {
    const db = testEnv.authenticatedContext("user-a", { email: "user@example.com", email_verified: true }).firestore();
    await assertSucceeds(setDoc(doc(db, "bibliotecasUsuarios", "user-a"), { favorites: [], playlists: [] }));
    await assertFails(setDoc(doc(db, "bibliotecasUsuarios", "user-a"), {
      favorites: Array.from({ length: 101 }, (_, index) => ({ key: String(index) })),
      playlists: []
    }));
  });
});

describe("administrative authorization", () => {
  test("secondary admins are limited to explicit permissions", async () => {
    const db = testEnv.authenticatedContext(editorAuth.uid, token(editorAuth)).firestore();
    await assertSucceeds(setDoc(doc(db, "musicas", "editor-created"), musica()));
    await assertSucceeds(updateDoc(doc(db, "musicas", "active-song"), { title: "Editada", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, "config", "site"), { officialEmail: editorAuth.email }));
    await assertFails(setDoc(doc(db, "admins", "email_attacker@example.com"), {
      email: "attacker@example.com",
      uid: editorAuth.uid,
      active: true
    }));
  });

  test("protected notification options require their specific permissions", async () => {
    const db = testEnv.authenticatedContext(editorAuth.uid, token(editorAuth)).firestore();
    const notification = {
      title: "Aviso",
      normalizedTitle: "aviso",
      message: "Mensagem",
      type: "aviso",
      tipo: "aviso",
      active: true,
      showPopup: false,
      showHome: true,
      showPublic: true,
      showTop: false,
      showBeforeStart: false,
      popupMode: "device_once",
      topMode: "device_once",
      startsAt: "",
      expiresAt: "",
      buttonText: "",
      buttonLink: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await assertSucceeds(setDoc(doc(db, "notificacoes", "normal"), notification));
    await assertFails(setDoc(doc(db, "notificacoes", "popup"), { ...notification, showPopup: true }));
  });

  test("an invited verified email can bind only its own UID", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "admins", "email_invited@example.com"), {
        name: "Convidado",
        email: "invited@example.com",
        active: true,
        pendingUid: true,
        permissions: {}
      });
    });
    const invited = { uid: "invited-uid", email: "invited@example.com", email_verified: true };
    const db = testEnv.authenticatedContext(invited.uid, token(invited)).firestore();
    await assertSucceeds(updateDoc(doc(db, "admins", "email_invited@example.com"), {
      uid: invited.uid,
      pendingUid: false,
      uidBoundAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(doc(db, "admins", `email_${editorAuth.email}`), { uid: invited.uid }));
  });

  test("the verified primary email can safely bind an unclaimed master UID", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "admins", "master"), {
        name: "Principal",
        email: primaryAuth.email,
        active: true,
        isPrimary: true,
        pendingUid: true,
        createdAt: serverTimestamp()
      });
    });

    const primaryDb = testEnv.authenticatedContext(primaryAuth.uid, token(primaryAuth)).firestore();
    await assertSucceeds(getDoc(doc(primaryDb, "admins", "master")));
    await assertSucceeds(updateDoc(doc(primaryDb, "admins", "master"), {
      uid: primaryAuth.uid,
      pendingUid: false,
      uidBoundAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));

    const attacker = { uid: "attacker-uid", email: "attacker@example.com", email_verified: true };
    const attackerDb = testEnv.authenticatedContext(attacker.uid, token(attacker)).firestore();
    await assertFails(getDoc(doc(attackerDb, "admins", "master")));
    await assertFails(updateDoc(doc(attackerDb, "admins", "master"), { uid: attacker.uid }));
  });

  test("the primary admin can maintain protected configuration", async () => {
    const db = testEnv.authenticatedContext(primaryAuth.uid, token(primaryAuth)).firestore();
    await assertSucceeds(setDoc(doc(db, "config", "site"), {
      officialEmail: "contato@example.com",
      updatedAt: serverTimestamp()
    }));
    const snapshot = await assertSucceeds(getDocs(collection(db, "admins")));
    assert.equal(snapshot.size, 2);
  });

  test("activity logs are append-only and bound to the authenticated admin", async () => {
    const db = testEnv.authenticatedContext(primaryAuth.uid, token(primaryAuth)).firestore();
    const log = {
      clientLogId: "log-1",
      type: "activity_log",
      action: "update",
      module: "musicas",
      itemId: "active-song",
      itemName: "Música teste",
      details: "",
      userUid: primaryAuth.uid,
      userEmail: primaryAuth.email,
      userName: "Principal",
      timestamp: serverTimestamp(),
      fallbackCreatedAtIso: new Date().toISOString(),
      fallbackCreatedAtMs: Date.now(),
      fallbackCreatedAtDate: "2026-11-07"
    };
    await assertSucceeds(setDoc(doc(db, "activity_logs", "log-1"), log));
    await assertFails(updateDoc(doc(db, "activity_logs", "log-1"), { details: "alterado" }));
    await assertFails(setDoc(doc(db, "activity_logs", "spoofed"), { ...log, userUid: "other" }));
  });
});
