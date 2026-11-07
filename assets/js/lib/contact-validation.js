function normalize(value = "", maxLength = 1000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function validateContactPayload(data = {}) {
  const payload = {
    nome: normalize(data.nome, 120),
    email: normalize(data.email, 320).toLowerCase(),
    assunto: normalize(data.assunto, 160),
    mensagem: normalize(data.mensagem, 4000)
  };

  if (payload.nome.length < 2) return { ok: false, message: "Informe seu nome." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return { ok: false, message: "Informe um e-mail válido." };
  if (payload.assunto.length < 3) return { ok: false, message: "Informe o assunto." };
  if (payload.mensagem.length < 10) return { ok: false, message: "Escreva uma mensagem com pelo menos 10 caracteres." };
  return { ok: true, payload };
}
