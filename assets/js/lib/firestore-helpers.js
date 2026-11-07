import { db } from "../db.js";
import { collection, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

export function watchCollection(collectionName, callback, options = {}) {
  if (!collectionName || typeof callback !== "function") {
    return () => {};
  }

  const sortField = options.sortField || "updatedAt";
  const sortDirection = options.sortDirection || "desc";

  try {
    const ref = query(collection(db, collectionName), orderBy(sortField, sortDirection));
    return onSnapshot(ref, (snapshot) => {
      callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error(`[watchCollection] ${collectionName}`, error);
    });
  } catch (error) {
    console.error(`[watchCollection] ${collectionName}`, error);
    return () => {};
  }
}
