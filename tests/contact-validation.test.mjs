import test from "node:test";
import assert from "node:assert/strict";
import { validateContactPayload } from "../assets/js/lib/contact-validation.js";

test("normaliza uma mensagem de contato válida", () => {
  const result = validateContactPayload({
    nome: "  Maria Silva  ",
    email: " MARIA@EXAMPLE.COM ",
    assunto: "  Convite  ",
    mensagem: "  Gostaria de fazer um convite.  "
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.payload, {
    nome: "Maria Silva",
    email: "maria@example.com",
    assunto: "Convite",
    mensagem: "Gostaria de fazer um convite."
  });
});

test("rejeita e-mail inválido e mensagem curta", () => {
  assert.equal(validateContactPayload({ nome: "Maria", email: "maria", assunto: "Teste", mensagem: "Mensagem válida" }).ok, false);
  assert.equal(validateContactPayload({ nome: "Maria", email: "maria@example.com", assunto: "Teste", mensagem: "Curta" }).ok, false);
});

test("limita o tamanho dos campos persistidos", () => {
  const result = validateContactPayload({
    nome: "N".repeat(200),
    email: "maria@example.com",
    assunto: "A".repeat(300),
    mensagem: "M".repeat(5000)
  });
  assert.equal(result.payload?.nome.length, 120);
  assert.equal(result.payload?.assunto.length, 160);
  assert.equal(result.payload?.mensagem.length, 4000);
});
