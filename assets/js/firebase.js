import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyD4PbLKQIUjrU3rY4aaQ1hW7xNpLmR3F4s",
  authDomain: "ministerio-seven-site.firebaseapp.com",
  projectId: "ministerio-seven-site",
  storageBucket: "ministerio-seven-site.firebasestorage.app",
  messagingSenderId: "232635892630",
  appId: "1:232635892630:web:a8989fcc54a0cf45bc93b7",
  measurementId: "G-KS57H6C9H9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, provider, db, storage };
