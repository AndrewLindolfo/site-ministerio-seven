const PROFILE_PREVIEW_KEY = "seven_public_profile_preview_v1";

function readPreview() {
  try {
    const value = JSON.parse(localStorage.getItem(PROFILE_PREVIEW_KEY) || "null");
    return value?.signedIn && value?.photoURL ? value : null;
  } catch {
    return null;
  }
}

export function writePublicAuthPreview(profile) {
  try {
    localStorage.setItem(PROFILE_PREVIEW_KEY, JSON.stringify({
      signedIn: true,
      photoURL: String(profile?.photoURL || "/assets/img/v7/icon_120.png"),
      displayName: String(profile?.displayName || "Conta").slice(0, 120)
    }));
  } catch {}
}

export function clearPublicAuthPreview() {
  try {
    localStorage.removeItem(PROFILE_PREVIEW_KEY);
  } catch {}
}

export function ensurePublicUserSlot() {
  const actions = document.querySelector(".header-actions");
  const mobileToggle = document.getElementById("mobile-menu-toggle");
  if (!actions || !mobileToggle) return null;
  let slot = document.getElementById("public-user-slot");
  if (slot) return slot;
  slot = document.createElement("div");
  slot.id = "public-user-slot";
  slot.className = "public-user-slot";
  actions.insertBefore(slot, mobileToggle);
  return slot;
}

function requestFullAuth() {
  document.dispatchEvent(new CustomEvent("seven:public-auth-request"));
}

function renderLoginPreview(slot) {
  slot.innerHTML = `
    <button type="button" id="public-login-button" class="public-login-button public-login-button--image-only" aria-label="Entrar">
      <img src="/assets/img/ui/login-user-preto.png" alt="" class="public-login-button__image public-login-button__image--light" />
      <img src="/assets/img/ui/login-user-branco.png" alt="" class="public-login-button__image public-login-button__image--dark" />
    </button>`;
  slot.querySelector("#public-login-button")?.addEventListener("click", requestFullAuth, { once: true });
}

function renderAccountPreview(slot, preview) {
  slot.innerHTML = `
    <button type="button" id="public-user-toggle" class="public-user-toggle public-user-toggle--preview" aria-label="Carregando conta" aria-busy="true">
      <img alt="" class="public-user-avatar" />
    </button>`;
  const avatar = slot.querySelector(".public-user-avatar");
  if (avatar) avatar.src = preview.photoURL;
  slot.querySelector("#public-user-toggle")?.addEventListener("click", requestFullAuth, { once: true });
}

export function initPublicAuthShell() {
  const slot = ensurePublicUserSlot();
  if (!slot || slot.childElementCount) return slot;
  const preview = readPreview();
  if (preview) renderAccountPreview(slot, preview);
  else renderLoginPreview(slot);
  return slot;
}

