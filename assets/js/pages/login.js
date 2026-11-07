import { loginWithEmailPassword, loginWithGoogle } from "../auth.js";

function getLoginErrorMessage(error) {
  const code = String(error?.code || "");
  if (code === "admin/not-authorized") return "Este e-mail não está autorizado como administrador.";
  if (code === "admin/uid-mismatch") return "Este administrador já está vinculado a outra conta de acesso.";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "E-mail ou senha inválidos.";
  }
  if (code === "auth/invalid-email") return "Digite um e-mail válido.";
  if (code === "auth/too-many-requests") return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (code === "auth/popup-closed-by-user") return "A janela do Google foi fechada antes da conclusão.";
  if (code === "auth/popup-blocked") return "O navegador bloqueou a janela do Google. Libere pop-ups e tente novamente.";
  if (code === "auth/network-request-failed") return "Não foi possível conectar. Verifique sua internet e tente novamente.";
  return "Não foi possível entrar. Tente novamente.";
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("email-login-form");
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const emailButton = document.getElementById("email-login-button");
  const googleButton = document.getElementById("google-login-button");
  const status = document.getElementById("login-status");

  const setBusy = (busy) => {
    if (emailButton) emailButton.disabled = busy;
    if (googleButton) googleButton.disabled = busy;
    if (emailInput) emailInput.disabled = busy;
    if (passwordInput) passwordInput.disabled = busy;
  };

  const runLogin = async (action) => {
    setBusy(true);
    if (status) {
      status.textContent = "Entrando…";
      status.dataset.state = "loading";
    }
    try {
      await action();
    } catch (error) {
      if (status) {
        status.textContent = getLoginErrorMessage(error);
        status.dataset.state = "error";
      }
      setBusy(false);
    }
  };

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    await runLogin(() => loginWithEmailPassword(emailInput?.value, passwordInput?.value));
  });

  googleButton?.addEventListener("click", async () => {
    await runLogin(loginWithGoogle);
  });
});
