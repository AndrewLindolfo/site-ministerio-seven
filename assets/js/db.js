import { app, auth, db, storage } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export { serverTimestamp, increment };

export function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function slugify(value = "") {
  return normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function addDocument(collectionName, data) {
  const ref = await addDoc(collection(db, collectionName), data);
  return ref.id;
}

export async function setDocument(collectionName, id, data, options = {}) {
  await setDoc(doc(db, collectionName, id), data, options);
  return id;
}

export async function getDocument(collectionName, id) {
  const snap = await getDoc(doc(db, collectionName, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateDocument(collectionName, id, data) {
  await updateDoc(doc(db, collectionName, id), data);
}

export async function deleteDocument(collectionName, id) {
  await deleteDoc(doc(db, collectionName, id));
}

export async function getCollection(collectionName, options = {}) {
  const parts = [];
  if (Array.isArray(options.where)) {
    for (const [field, op, value] of options.where) {
      parts.push(where(field, op, value));
    }
  }
  if (options.orderBy?.field) {
    parts.push(orderBy(options.orderBy.field, options.orderBy.direction || "asc"));
  }
  if (options.limit) {
    parts.push(limit(options.limit));
  }

  const ref = parts.length ? query(collection(db, collectionName), ...parts) : collection(db, collectionName);
  const snap = await getDocs(ref);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getOneByField(collectionName, field, value) {
  const items = await getCollection(collectionName, {
    where: [[field, "==", value]],
    limit: 1
  });
  return items[0] || null;
}

export function explainFirebaseError(error) {
  const code = error?.code || "";
  if (code.includes("permission-denied")) {
    return "Permissão negada no Firestore. As regras do banco precisam liberar acesso ao usuário logado.";
  }
  if (code.includes("unauthenticated")) {
    return "Usuário não autenticado. Faça login novamente.";
  }
  if (code.includes("unavailable")) {
    return "Firestore indisponível no momento. Tente de novo.";
  }
  return error?.message || "Erro desconhecido ao acessar o Firebase.";
}


export function watchDocument(collectionName, id, callback, onError = null) {
  return onSnapshot(doc(db, collectionName, id), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, onError || ((error) => console.error("Erro ao observar documento:", error)));
}


export function watchCollection(collectionName, callback, options = {}, onError = null) {
  const parts = [];
  if (Array.isArray(options.where)) {
    for (const [field, op, value] of options.where) {
      parts.push(where(field, op, value));
    }
  }
  if (options.orderBy?.field) {
    parts.push(orderBy(options.orderBy.field, options.orderBy.direction || "asc"));
  }
  if (options.limit) {
    parts.push(limit(options.limit));
  }

  const ref = parts.length ? query(collection(db, collectionName), ...parts) : collection(db, collectionName);
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, onError || ((error) => console.error("Erro ao observar coleção:", error)));
}


export { app, auth, db, storage };
