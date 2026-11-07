import { addDocument, serverTimestamp } from "../db.js";
import { validateContactPayload } from "../lib/contact-validation.js";

const LAST_SENT_KEY = "seven_contact_last_sent";
const MIN_INTERVAL_MS = 60_000;

function readLastSent() {
  try {
    return Number(localStorage.getItem(LAST_SENT_KEY) || 0);
  } catch {
    return 0;
  }
}

function saveLastSent() {
  try {
    localStorage.setItem(LAST_SENT_KEY, String(Date.now()));
  } catch {
    return;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contato-form");
  const status = document.getElementById("contato-status");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const setStatus = (message) => {
      if (status) status.textContent = message;
    };

    if (document.getElementById("contato-site")?.value) {
      form.reset();
      setStatus("Mensagem enviada com sucesso.");
      return;
    }

    const elapsed = Date.now() - readLastSent();
    if (elapsed < MIN_INTERVAL_MS) {
      setStatus("Aguarde um minuto antes de enviar outra mensagem.");
      return;
    }

    const result = validateContactPayload({
      nome: document.getElementById("contato-nome")?.value,
      email: document.getElementById("contato-email")?.value,
      assunto: document.getElementById("contato-assunto")?.value,
      mensagem: document.getElementById("contato-mensagem")?.value
    });
    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    setStatus("Enviando mensagem...");
    try {
      await addDocument("contatos", {
        ...result.payload,
        createdAt: serverTimestamp(),
        lido: false
      });
      saveLastSent();
      form.reset();
      setStatus("Mensagem enviada com sucesso.");
    } catch (error) {
      console.error("Não foi possível enviar a mensagem.", error);
      setStatus("Não foi possível enviar sua mensagem agora. Tente novamente mais tarde.");
    } finally {
      if (button) button.disabled = false;
    }
  });
});
