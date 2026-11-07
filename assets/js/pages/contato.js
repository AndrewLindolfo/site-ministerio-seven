import { addDocument, serverTimestamp } from "../db.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contato-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    await addDocument("contatos", {
      nome: document.getElementById("contato-nome")?.value || "",
      email: document.getElementById("contato-email")?.value || "",
      assunto: document.getElementById("contato-assunto")?.value || "",
      mensagem: document.getElementById("contato-mensagem")?.value || "",
      createdAt: serverTimestamp(),
      lido: false
    });

    alert("Mensagem enviada com sucesso.");
    form.reset();
  });
});
