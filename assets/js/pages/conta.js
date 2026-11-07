import { auth } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { openPublicAuthModal } from "../public-auth.js";
import { getPublicUserProfile, savePublicUserProfile } from "../services/public-user-service.js";

function $(selector) {
  return document.querySelector(selector);
}

function fillProfile(user, profile = null) {
  const firstName = profile?.firstName || user?.displayName?.split(" ")?.[0] || "";
  const lastName = profile?.lastName || user?.displayName?.split(" ").slice(1).join(" ") || "";
  const displayName = profile?.displayName || user?.displayName || [firstName, lastName].filter(Boolean).join(" ");
  const email = profile?.email || user?.email || "";
  const phone = profile?.phone || "";
  const photoURL = profile?.photoURL || user?.photoURL || "assets/img/v7/icon_120.png";

  $("#conta-photo").src = photoURL;
  $("#conta-display-name").textContent = displayName || "Minha conta";
  $("#conta-status").textContent = email || "Usuário autenticado";
  $("#conta-first-name").value = firstName;
  $("#conta-last-name").value = lastName;
  $("#conta-email").value = email;
  $("#conta-phone").value = phone;
}

function setLoggedOutState() {
  $("#conta-display-name").textContent = "Sua conta";
  $("#conta-status").textContent = "Faça login para continuar.";
  $("#conta-photo").src = "assets/img/v7/icon_120.png";
  $("#conta-form")?.classList.add("hidden");
  $("#conta-login-state")?.classList.remove("hidden");
}

function setLoggedInState() {
  $("#conta-form")?.classList.remove("hidden");
  $("#conta-login-state")?.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  $("#conta-login-button")?.addEventListener("click", openPublicAuthModal);

  $("#conta-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user?.uid) {
      openPublicAuthModal();
      return;
    }

    const firstName = $("#conta-first-name").value.trim();
    const lastName = $("#conta-last-name").value.trim();
    const email = $("#conta-email").value.trim();
    const phone = $("#conta-phone").value.trim();
    const displayName = [firstName, lastName].filter(Boolean).join(" ");

    try {
      await savePublicUserProfile(user.uid, {
        firstName,
        lastName,
        displayName,
        email,
        phone,
        photoURL: user.photoURL || ""
      });
      fillProfile(user, { firstName, lastName, displayName, email, phone, photoURL: user.photoURL || "" });
      alert("Conta salva com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar conta:", error);
      alert("Não foi possível salvar sua conta agora.");
    }
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setLoggedOutState();
      return;
    }
    setLoggedInState();
    const profile = await getPublicUserProfile(user.uid);
    fillProfile(user, profile);
  });
});
