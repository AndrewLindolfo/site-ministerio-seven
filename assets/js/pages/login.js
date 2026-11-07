import { loginWithGoogle } from "../auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("google-login-button");
  button?.addEventListener("click", async () => {
    await loginWithGoogle();
  });
});
