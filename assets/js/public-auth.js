import { auth, provider } from "./firebase.js";
import { getAdminProfileForUser } from "./auth.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getPublicUserProfile, normalizeProfilePhotoUrl, savePublicUserProfile } from "./services/public-user-service.js";

let currentUser = null;
let currentMenu = null;
let firebaseAuthUnsubscribe = null;
let lastFirebaseUser = null;
let authStateKnown = false;
const authSubscribers = new Set();
let authReadyResolver = null;
const authReadyPromise = new Promise((resolve) => {
  authReadyResolver = resolve;
});

function normalize(email = "") {
  return String(email || "").trim().toLowerCase();
}

function $(selector) {
  return document.querySelector(selector);
}

function ensureAuthModal() {
  if ($("#public-auth-modal")) return;

  const modal = document.createElement("div");
  modal.id = "public-auth-modal";
  modal.className = "public-auth-modal hidden";
  modal.innerHTML = `
    <div class="public-auth-modal__overlay" data-close-public-auth="1"></div>
    <div class="public-auth-modal__panel" role="dialog" aria-modal="true" aria-labelledby="public-auth-modal-title">
      <button type="button" class="public-auth-modal__close" data-close-public-auth="1" aria-label="Fechar">✕</button>
      <div class="public-auth-modal__eyebrow">Ministério Seven</div>
      <h2 id="public-auth-modal-title">Entrar</h2>
      <p class="public-auth-modal__text">Faça login para acessar favoritos, playlists e recursos pessoais do site.</p>
      <button type="button" id="public-google-login-button" class="public-auth-modal__google-btn">
        <span class="public-auth-modal__google-icon" aria-hidden="true"><img src="./assets/img/ui/logo-g-login.png" alt="" class="public-auth-modal__google-image" /></span>
        <span>Continuar com Google</span>
      </button>
      <p class="public-auth-modal__footnote">O login não é obrigatório para navegar no site. Ele é usado apenas para recursos pessoais.</p>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelectorAll("[data-close-public-auth='1']").forEach((node) => {
    node.addEventListener("click", closePublicAuthModal);
  });

  $("#public-google-login-button")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await loginPublicUser();
      closePublicAuthModal();
    } catch (error) {
      console.error("Erro ao fazer login público:", error);
      alert(`Não foi possível entrar com Google: ${error.code || error.message || "erro desconhecido"}`);
    } finally {
      button.disabled = false;
    }
  });
}

export function openPublicAuthModal() {
  ensureAuthModal();
  $("#public-auth-modal")?.classList.remove("hidden");
  document.body.classList.add("modal-open");
  $("#public-google-login-button")?.focus();
}

export function closePublicAuthModal() {
  $("#public-auth-modal")?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function ensureHeaderSlot() {
  const actions = $(".header-actions");
  const mobileToggle = $("#mobile-menu-toggle");
  if (!actions || !mobileToggle) return null;

  let slot = $("#public-user-slot");
  if (slot) return slot;

  slot = document.createElement("div");
  slot.id = "public-user-slot";
  slot.className = "public-user-slot";
  actions.insertBefore(slot, mobileToggle);
  return slot;
}

function closeUserMenu() {
  currentMenu?.classList.add("hidden");
  $("#public-user-toggle")?.setAttribute("aria-expanded", "false");
}

async function buildProfileData(user) {
  const email = normalize(user?.email || "");
  const profile = await getPublicUserProfile(user?.uid || "");
  const firstName = profile?.firstName || user?.displayName?.split(" ")?.[0] || "";
  const lastName = profile?.lastName || user?.displayName?.split(" ").slice(1).join(" ") || "";

  return {
    uid: user?.uid || "",
    email,
    photoURL: normalizeProfilePhotoUrl(profile?.photoURL || user?.photoURL) || "/assets/img/v7/icon_120.png",
    firstName,
    lastName,
    displayName: profile?.displayName || user?.displayName || [firstName, lastName].filter(Boolean).join(" "),
    phone: profile?.phone || "",
    isAdmin: false,
    isNewProfile: !profile
  };
}

async function renderLoggedOut(slot) {
  slot.innerHTML = `
    <button type="button" id="public-login-button" class="public-login-button public-login-button--image-only" aria-label="Entrar">
      <img src="./assets/img/ui/login-user-preto.png" alt="Entrar" class="public-login-button__image public-login-button__image--light" />
      <img src="./assets/img/ui/login-user-branco.png" alt="Entrar" class="public-login-button__image public-login-button__image--dark" />
    </button>`;
  $("#public-login-button")?.addEventListener("click", openPublicAuthModal);
}

async function renderLoggedIn(slot, profile) {
  slot.innerHTML = `
    <div class="public-user-menu">
      <button type="button" id="public-user-toggle" class="public-user-toggle" aria-label="Minha conta" aria-expanded="false">
        <img alt="Conta" class="public-user-avatar" />
      </button>
      <div id="public-user-dropdown" class="public-user-dropdown hidden">
        <a href="./conta.html">Minha conta</a>
        <a href="./favoritos.html">Favoritos</a>
        <a href="./playlists.html">Playlists</a>
        <button type="button" id="public-logout-button">Sair</button>
      </div>
    </div>
  `;

  const toggle = $("#public-user-toggle");
  const dropdown = $("#public-user-dropdown");
  const avatar = slot.querySelector(".public-user-avatar");
  if (avatar) avatar.src = profile.photoURL;
  if (profile.isAdmin && dropdown) {
    const adminLink = document.createElement("a");
    adminLink.href = "./admin/index.html";
    adminLink.className = "public-user-admin-link";
    adminLink.textContent = "Admin";
    dropdown.insertBefore(adminLink, dropdown.lastElementChild);
  }
  currentMenu = dropdown;

  toggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const hidden = dropdown?.classList.toggle("hidden") ?? true;
    toggle.setAttribute("aria-expanded", hidden ? "false" : "true");
  });

  $("#public-logout-button")?.addEventListener("click", async () => {
    await signOut(auth);
    closeUserMenu();
    if (window.location.pathname.includes("/conta.html")) {
      window.location.href = "./index.html";
    }
  });
}

async function renderHeaderAuth(user) {
  const slot = ensureHeaderSlot();

  if (!user) {
    currentUser = null;
    if (slot) await renderLoggedOut(slot);
    return;
  }

  const profile = await buildProfileData(user);
  try {
    profile.isAdmin = !!(await getAdminProfileForUser(user));
  } catch (error) {
    console.warn("Não foi possível verificar o acesso administrativo.", error);
  }
  currentUser = { ...profile, firebaseUser: user };
  if (profile.isNewProfile) {
    await savePublicUserProfile(profile.uid, {
      firstName: profile.firstName,
      lastName: profile.lastName,
      displayName: profile.displayName,
      email: profile.email,
      phone: profile.phone,
      photoURL: profile.photoURL
    });
  }
  if (slot) await renderLoggedIn(slot, profile);
}

async function handleAuthState(user) {
  lastFirebaseUser = user;
  await renderHeaderAuth(user);
  authStateKnown = true;
  if (authReadyResolver) {
    authReadyResolver(currentUser);
    authReadyResolver = null;
  }
  for (const callback of authSubscribers) {
    try {
      await callback(user);
    } catch (error) {
      console.error("Erro em observador de autenticação pública.", error);
    }
  }
}

function ensureAuthWatcher() {
  if (firebaseAuthUnsubscribe) return;
  firebaseAuthUnsubscribe = onAuthStateChanged(auth, (user) => {
    handleAuthState(user).catch((error) => {
      console.error("Erro ao processar autenticação pública.", error);
    });
  });
}

export async function loginPublicUser() {
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logoutPublicUser() {
  await signOut(auth);
}

export function getCurrentPublicUser() {
  return currentUser;
}

export function watchPublicAuth(callback) {
  ensureAuthWatcher();
  if (typeof callback !== "function") return () => {};
  authSubscribers.add(callback);
  if (authStateKnown) {
    queueMicrotask(() => {
      Promise.resolve(callback(lastFirebaseUser)).catch((error) => {
        console.error("Erro em observador de autenticação pública.", error);
      });
    });
  }
  return () => authSubscribers.delete(callback);
}

export function whenPublicAuthReady() {
  return authReadyPromise;
}

export function requirePublicLogin(onReady) {
  if (currentUser?.uid) {
    if (typeof onReady === "function") onReady(currentUser);
    return true;
  }
  openPublicAuthModal();
  return false;
}

export function initPublicAuth() {
  ensureAuthModal();
  ensureAuthWatcher();

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".public-user-menu")) closeUserMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeUserMenu();
      closePublicAuthModal();
    }
  });
}
