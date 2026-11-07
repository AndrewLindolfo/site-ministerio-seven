import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDIHB-clMayqI7ltnluGITvu3mNwTwuO_o",
  authDomain: "ministerio-seven-v2.firebaseapp.com",
  projectId: "ministerio-seven-v2",
  storageBucket: "ministerio-seven-v2.firebasestorage.app",
  messagingSenderId: "877779049437",
  appId: "1:877779049437:web:1c73a1e4c0924d5f9d3434",
  measurementId: "G-7J2294B6V8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, provider, db, storage };
