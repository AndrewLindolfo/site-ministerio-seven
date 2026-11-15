import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
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
const creatorAuth = {
  uid: "creator-uid",
  email: "creator@example.com",
  email_verified: true
};
const memberAuth = {
  uid: "member-uid",
  email: "member@example.com",
  email_verified: true
};
const viewerAuth = {
  uid: "viewer-uid",
  email: "viewer@example.com",
  email_verified: true
};
const memberCreatorAuth = {
  uid: "member-creator-uid",
  email: "member-creator@example.com",
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

function cifra(overrides = {}) {
  return {
    musicaId: "active-song",
    title: "Música teste",
    slug: "musica-teste",
    normalizedTitle: "musica teste",
    subtitle: "",
    cifraText: "C  G\nMúsica teste",
    cifraHtml: "<p>C  G</p><p>Música teste</p>",
    originalKey: "C",
    capo: "",
    bpm: "",
    compasso: "",
    instrumento: "violao",
    chordColor: "#FF5C00",
    views: 0,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides
  };
}

function musicDownload(overrides = {}) {
  return {
    musicaId: "active-song",
    title: "Música teste",
    normalizedTitle: "musica teste",
    slug: "musica-teste",
    pdfUrl: "https://example.com/musica.pdf",
    pptUrl: "",
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
        ensaios: { create: true, edit: true, delete: false },
        logs: { view: false }
      }
    });
    await setDoc(doc(db, "admins", `email_${creatorAuth.email}`), {
      name: "Criador",
      email: creatorAuth.email,
      uid: creatorAuth.uid,
      active: true,
      pendingUid: false,
      permissions: {
        ensaios: { create: true, edit: false, delete: false }
      }
    });
    await setDoc(doc(db, "integrantes", `email_${memberAuth.email}`), {
      name: "Integrante completo", email: memberAuth.email, uid: memberAuth.uid,
      active: true, pendingUid: false,
      permissions: { ensaios: { create: true, edit: true, delete: true } },
      createdAt: new Date(), updatedAt: new Date(), uidBoundAt: new Date()
    });
    await setDoc(doc(db, "integrantes", `email_${viewerAuth.email}`), {
      name: "Integrante leitor", email: viewerAuth.email, uid: viewerAuth.uid,
      active: true, pendingUid: false,
      permissions: { ensaios: { create: false, edit: false, delete: false } },
      createdAt: new Date(), updatedAt: new Date(), uidBoundAt: new Date()
    });
    await setDoc(doc(db, "integrantes", `email_${memberCreatorAuth.email}`), {
      name: "Integrante criador", email: memberCreatorAuth.email, uid: memberCreatorAuth.uid,
      active: true, pendingUid: false,
      permissions: { ensaios: { create: true, edit: false, delete: false } },
      createdAt: new Date(), updatedAt: new Date(), uidBoundAt: new Date()
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
  test("uma página pública aberta recebe alterações do repertório em tempo real", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "modoEnsaios", "live-session"), {
        title: "Ensaio ao vivo", date: "2026-11-15", time: "19:00", location: "Igreja",
        description: "", active: true, createdBy: primaryAuth.uid,
        createdAt: new Date(), updatedAt: new Date()
      });
      await setDoc(doc(db, "modoEnsaioMusicas", "live-session_00"), {
        sessionId: "live-session", order: 0, musicaId: "active-song", title: "Música teste",
        slug: "musica-teste", cifraId: "", cifraTitle: "", instrumento: "violao",
        bpm: "", compasso: "", originalKey: "C", notes: "Inicial",
        createdAt: new Date(), updatedAt: new Date()
      });
    });

    const publicDb = testEnv.unauthenticatedContext().firestore();
    const publicQuery = query(collection(publicDb, "modoEnsaioMusicas"), where("sessionId", "==", "live-session"));
    let resolveInitial;
    let resolveChanged;
    const initialSnapshot = new Promise((resolve) => { resolveInitial = resolve; });
    const changedSnapshot = new Promise((resolve) => { resolveChanged = resolve; });
    const unsubscribe = onSnapshot(publicQuery, (snapshot) => {
      const notes = snapshot.docs[0]?.data()?.notes;
      if (notes === "Inicial") resolveInitial();
      if (notes === "Atualizada") resolveChanged(notes);
    });

    await initialSnapshot;
    const primaryDb = testEnv.authenticatedContext(primaryAuth.uid, token(primaryAuth)).firestore();
    await assertSucceeds(updateDoc(doc(primaryDb, "modoEnsaioMusicas", "live-session_00"), {
      notes: "Atualizada",
      updatedAt: serverTimestamp()
    }));
    const received = await Promise.race([
      changedSnapshot,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Atualização em tempo real não recebida.")), 3000))
    ]);
    unsubscribe();
    assert.equal(received, "Atualizada");
  });

  test("public mode rehearsal links expose only active sessions and their songs", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "modoEnsaios", "active-session"), {
        title: "Ensaio", date: "2026-11-15", time: "19:00", location: "Igreja",
        description: "", active: true, createdBy: primaryAuth.uid,
        createdAt: new Date(), updatedAt: new Date()
      });
      await setDoc(doc(db, "modoEnsaios", "hidden-session"), {
        title: "Rascunho", date: "", time: "", location: "",
        description: "", active: false, createdBy: primaryAuth.uid,
        createdAt: new Date(), updatedAt: new Date()
      });
      await setDoc(doc(db, "modoEnsaioMusicas", "active-session_00"), {
        sessionId: "active-session", order: 0, musicaId: "active-song", title: "Música teste",
        slug: "musica-teste", cifraId: "", cifraTitle: "", instrumento: "violao",
        bpm: "", compasso: "", originalKey: "C", notes: "",
        createdAt: new Date(), updatedAt: new Date()
      });
    });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "modoEnsaios", "active-session")));
    await assertFails(getDoc(doc(db, "modoEnsaios", "hidden-session")));
    await assertFails(getDocs(collection(db, "modoEnsaios")));
    await assertSucceeds(getDocs(query(collection(db, "modoEnsaioMusicas"), where("sessionId", "==", "active-session"))));
  });
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

describe("member rehearsal authorization", () => {
  test("the primary admin manages members while identities remain private", async () => {
    const primaryDb = testEnv.authenticatedContext(primaryAuth.uid, token(primaryAuth)).firestore();
    const editorDb = testEnv.authenticatedContext(editorAuth.uid, token(editorAuth)).firestore();
    const memberDb = testEnv.authenticatedContext(memberAuth.uid, token(memberAuth)).firestore();
    const data = {
      name: "Novo integrante", email: "new-member@example.com",
      permissions: { ensaios: { create: true, edit: false, delete: false } },
      active: true, pendingUid: true,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    };
    await assertSucceeds(setDoc(doc(primaryDb, "integrantes", "email_new-member@example.com"), data));
    await assertSucceeds(getDocs(collection(primaryDb, "integrantes")));
    await assertFails(getDocs(collection(memberDb, "integrantes")));
    await assertSucceeds(getDoc(doc(memberDb, "integrantes", `email_${memberAuth.email}`)));
    await assertFails(getDoc(doc(memberDb, "integrantes", `email_${viewerAuth.email}`)));
    await assertFails(setDoc(doc(editorDb, "integrantes", "email_attacker@example.com"), { ...data, email: "attacker@example.com" }));
  });

  test("an invited member can bind only the matching verified Google account", async () => {
    const invited = { uid: "invited-member-uid", email: "invited-member@example.com", email_verified: true };
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "integrantes", `email_${invited.email}`), {
        name: "Convidado", email: invited.email, active: true, pendingUid: true,
        permissions: { ensaios: { create: false, edit: true, delete: false } },
        createdAt: new Date(), updatedAt: new Date()
      });
    });
    const invitedDb = testEnv.authenticatedContext(invited.uid, token(invited)).firestore();
    await assertSucceeds(updateDoc(doc(invitedDb, "integrantes", `email_${invited.email}`), {
      uid: invited.uid, pendingUid: false, uidBoundAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(doc(invitedDb, "integrantes", `email_${memberAuth.email}`), { uid: invited.uid }));
    await assertFails(updateDoc(doc(invitedDb, "integrantes", `email_${invited.email}`), {
      permissions: { ensaios: { create: true, edit: true, delete: true } }
    }));
  });

  test("unverified, inactive and mismatched identities cannot become members", async () => {
    const unverifiedDb = testEnv.authenticatedContext("unverified-uid", {
      email: memberAuth.email,
      email_verified: false
    }).firestore();
    await assertFails(getDoc(doc(unverifiedDb, "integrantes", `email_${memberAuth.email}`)));

    const wrongUidDb = testEnv.authenticatedContext("wrong-member-uid", token(memberAuth)).firestore();
    await assertSucceeds(getDoc(doc(wrongUidDb, "integrantes", `email_${memberAuth.email}`)));
    await assertFails(getDocs(collection(wrongUidDb, "modoEnsaios")));

    const inactive = { uid: "inactive-uid", email: "inactive@example.com", email_verified: true };
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "integrantes", `email_${inactive.email}`), {
        name: "Integrante inativo", email: inactive.email, uid: inactive.uid,
        active: false, pendingUid: false,
        permissions: { ensaios: { create: true, edit: true, delete: true } },
        createdAt: new Date(), updatedAt: new Date(), uidBoundAt: new Date()
      });
    });
    const inactiveDb = testEnv.authenticatedContext(inactive.uid, token(inactive)).firestore();
    await assertFails(getDocs(collection(inactiveDb, "modoEnsaios")));
  });

  test("member records reject schema pollution, oversized data and UID changes", async () => {
    const primaryDb = testEnv.authenticatedContext(primaryAuth.uid, token(primaryAuth)).firestore();
    const memberRef = doc(primaryDb, "integrantes", `email_${memberAuth.email}`);
    await assertFails(updateDoc(memberRef, { uid: "reassigned-uid", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(memberRef, { unexpectedAdmin: true, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(primaryDb, "integrantes", "email_huge@example.com"), {
      name: "x".repeat(151), email: "huge@example.com", active: true, pendingUid: true,
      permissions: { ensaios: { create: false, edit: false, delete: false } },
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
  });

  test("a fully authorized member can create, edit and delete a rehearsal", async () => {
    const db = testEnv.authenticatedContext(memberAuth.uid, token(memberAuth)).firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, "modoEnsaios", "member-session"), {
      title: "Ensaio do grupo", date: "2026-11-16", time: "20:00", location: "Igreja",
      description: "", active: false, createdBy: memberAuth.uid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    batch.set(doc(db, "modoEnsaioMusicas", "member-session_00"), {
      sessionId: "member-session", order: 0, musicaId: "active-song", title: "Música teste",
      slug: "musica-teste", cifraId: "", cifraTitle: "", instrumento: "violao",
      bpm: "", compasso: "", originalKey: "C", notes: "",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    await assertSucceeds(batch.commit());
    await assertSucceeds(updateDoc(doc(db, "modoEnsaios", "member-session"), { title: "Ensaio atualizado", updatedAt: serverTimestamp() }));
    const deleteBatch = writeBatch(db);
    deleteBatch.delete(doc(db, "modoEnsaioMusicas", "member-session_00"));
    deleteBatch.delete(doc(db, "modoEnsaios", "member-session"));
    await assertSucceeds(deleteBatch.commit());
  });

  test("view-only members can list drafts but cannot mutate rehearsals", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "modoEnsaios", "private-session"), {
        title: "Rascunho", date: "", time: "", location: "", description: "",
        active: false, createdBy: primaryAuth.uid, createdAt: new Date(), updatedAt: new Date()
      });
    });
    const db = testEnv.authenticatedContext(viewerAuth.uid, token(viewerAuth)).firestore();
    await assertSucceeds(getDocs(collection(db, "modoEnsaios")));
    await assertSucceeds(getDoc(doc(db, "modoEnsaios", "private-session")));
    await assertFails(updateDoc(doc(db, "modoEnsaios", "private-session"), { title: "Ataque", updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, "modoEnsaios", "private-session")));
  });

  test("create-only members cannot alter an existing rehearsal after creation", async () => {
    const db = testEnv.authenticatedContext(memberCreatorAuth.uid, token(memberCreatorAuth)).firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, "modoEnsaios", "creator-member-session"), {
      title: "Novo ensaio", date: "", time: "", location: "", description: "",
      active: true, createdBy: memberCreatorAuth.uid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    batch.set(doc(db, "modoEnsaioMusicas", "creator-member-session_00"), {
      sessionId: "creator-member-session", order: 0, musicaId: "active-song", title: "Música teste",
      slug: "musica-teste", cifraId: "", cifraTitle: "", instrumento: "violao",
      bpm: "", compasso: "", originalKey: "C", notes: "",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    await assertSucceeds(batch.commit());
    await assertFails(updateDoc(doc(db, "modoEnsaios", "creator-member-session"), { title: "Sem permissão", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, "modoEnsaioMusicas", "creator-member-session_01"), {
      sessionId: "creator-member-session", order: 1, musicaId: "active-song", title: "Outra",
      slug: "musica-teste", cifraId: "", cifraTitle: "", instrumento: "violao",
      bpm: "", compasso: "", originalKey: "C", notes: "",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
  });

  test("delete-only members remove a rehearsal atomically but cannot edit it", async () => {
    const deleteOnly = { uid: "delete-only-uid", email: "delete-only@example.com", email_verified: true };
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "integrantes", `email_${deleteOnly.email}`), {
        name: "Integrante exclusor", email: deleteOnly.email, uid: deleteOnly.uid,
        active: true, pendingUid: false,
        permissions: { ensaios: { create: false, edit: false, delete: true } },
        createdAt: new Date(), updatedAt: new Date(), uidBoundAt: new Date()
      });
      await setDoc(doc(db, "modoEnsaios", "delete-only-session"), {
        title: "Excluir", date: "", time: "", location: "", description: "",
        active: false, createdBy: primaryAuth.uid, createdAt: new Date(), updatedAt: new Date()
      });
      await setDoc(doc(db, "modoEnsaioMusicas", "delete-only-session_00"), {
        sessionId: "delete-only-session", order: 0, musicaId: "active-song", title: "Música teste",
        slug: "musica-teste", cifraId: "", cifraTitle: "", instrumento: "violao",
        bpm: "", compasso: "", originalKey: "C", notes: "",
        createdAt: new Date(), updatedAt: new Date()
      });
    });
    const db = testEnv.authenticatedContext(deleteOnly.uid, token(deleteOnly)).firestore();
    await assertFails(updateDoc(doc(db, "modoEnsaios", "delete-only-session"), {
      title: "Sem edição", updatedAt: serverTimestamp()
    }));
    await assertFails(deleteDoc(doc(db, "modoEnsaioMusicas", "delete-only-session_00")));
    const batch = writeBatch(db);
    batch.delete(doc(db, "modoEnsaioMusicas", "delete-only-session_00"));
    batch.delete(doc(db, "modoEnsaios", "delete-only-session"));
    await assertSucceeds(batch.commit());
  });
});

describe("administrative authorization", () => {
  test("modo ensaio e repertório são criados atomicamente em um único lote", async () => {
    const db = testEnv.authenticatedContext(creatorAuth.uid, token(creatorAuth)).firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, "modoEnsaios", "creator-session"), {
      title: "Ensaio do criador", date: "2026-11-15", time: "19:00", location: "Igreja",
      description: "", active: true, createdBy: creatorAuth.uid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    batch.set(doc(db, "modoEnsaioMusicas", "creator-session_00"), {
      sessionId: "creator-session", order: 0, musicaId: "active-song", title: "Música teste",
      slug: "musica-teste", cifraId: "", cifraTitle: "", instrumento: "violao",
      bpm: "72", compasso: "4/4", originalKey: "C", notes: "",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    await assertSucceeds(batch.commit());
  });

  test("administrador apenas criador não injeta músicas no modo ensaio de outra pessoa", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "modoEnsaios", "primary-session"), {
        title: "Ensaio principal", date: "2026-11-15", time: "19:00", location: "Igreja",
        description: "", active: true, createdBy: primaryAuth.uid,
        createdAt: new Date(), updatedAt: new Date()
      });
    });
    const db = testEnv.authenticatedContext(creatorAuth.uid, token(creatorAuth)).firestore();
    await assertFails(setDoc(doc(db, "modoEnsaioMusicas", "primary-session_00"), {
      sessionId: "primary-session", order: 0, musicaId: "active-song", title: "Música teste",
      slug: "musica-teste", cifraId: "", cifraTitle: "", instrumento: "violao",
      bpm: "72", compasso: "4/4", originalKey: "C", notes: "",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
  });

  test("modo ensaio rejeita BPM e compasso fora dos limites", async () => {
    const db = testEnv.authenticatedContext(editorAuth.uid, token(editorAuth)).firestore();
    await setDoc(doc(db, "modoEnsaios", "validation-session"), {
      title: "Validação", date: "2026-11-15", time: "19:00", location: "",
      description: "", active: true, createdBy: editorAuth.uid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    const base = {
      sessionId: "validation-session", order: 0, musicaId: "active-song", title: "Música teste",
      slug: "musica-teste", cifraId: "", cifraTitle: "", instrumento: "violao",
      bpm: "999", compasso: "13/9", originalKey: "C", notes: "",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    };
    await assertFails(setDoc(doc(db, "modoEnsaioMusicas", "invalid-metrics"), base));
  });

  test("admins with rehearsal permissions can create bounded mode rehearsal data", async () => {
    const db = testEnv.authenticatedContext(editorAuth.uid, token(editorAuth)).firestore();
    await assertSucceeds(setDoc(doc(db, "modoEnsaios", "session-one"), {
      title: "Ensaio de domingo", date: "2026-11-15", time: "19:00", location: "Igreja",
      description: "Passagem às 18h", active: true, createdBy: editorAuth.uid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
    await assertSucceeds(setDoc(doc(db, "modoEnsaioMusicas", "session-one_00"), {
      sessionId: "session-one", order: 0, musicaId: "active-song", title: "Música teste",
      slug: "musica-teste", cifraId: "", cifraTitle: "", instrumento: "violao",
      bpm: "72", compasso: "4/4", originalKey: "C", notes: "Começar suave",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(doc(db, "modoEnsaios", "session-one"), { createdBy: "attacker", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, "modoEnsaioMusicas", "bad-song"), {
      sessionId: "session-one", order: 99, musicaId: "missing-song", title: "Inválida",
      slug: "invalida", cifraId: "", cifraTitle: "", instrumento: "violao",
      bpm: "", compasso: "", originalKey: "", notes: "",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
  });
  test("cifras e downloads exigem uma música existente", async () => {
    const db = testEnv.authenticatedContext(primaryAuth.uid, token(primaryAuth)).firestore();

    await assertSucceeds(setDoc(doc(db, "cifras", "linked-chord"), cifra()));
    await assertFails(setDoc(doc(db, "cifras", "orphan-chord"), cifra({ musicaId: "missing-song" })));
    await assertFails(updateDoc(doc(db, "cifras", "linked-chord"), {
      musicaId: "missing-song",
      updatedAt: serverTimestamp()
    }));

    await assertSucceeds(setDoc(doc(db, "downloadsPorMusica", "linked-download"), musicDownload()));
    await assertFails(setDoc(doc(db, "downloadsPorMusica", "orphan-download"), musicDownload({ musicaId: "missing-song" })));
    await assertFails(updateDoc(doc(db, "downloadsPorMusica", "linked-download"), {
      musicaId: "missing-song",
      updatedAt: serverTimestamp()
    }));
  });

  test("uma cifra migrada pode corrigir o vínculo sem regravar metadados legados", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "cifras", "legacy-orphan"), cifra({
        musicaId: "missing-song",
        createdAt: { seconds: 1773691828, nanoseconds: 558000000, __type: "timestamp" },
        updatedAt: "2026-04-02T13:47:12.070Z"
      }));
    });

    const db = testEnv.authenticatedContext(primaryAuth.uid, token(primaryAuth)).firestore();
    await assertSucceeds(updateDoc(doc(db, "cifras", "legacy-orphan"), {
      musicaId: "active-song",
      updatedAt: serverTimestamp()
    }));
  });

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
    assert.equal(snapshot.size, 3);
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
