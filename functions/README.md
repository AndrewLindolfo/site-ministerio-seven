# Integrações do ambiente de teste

Esta função atende `/api` e exige um token Firebase de um administrador ativo. Ela não é publicada automaticamente.

- Letras: LRCLIB, identificada pelo cabeçalho do projeto e com tratamento de limite de uso.
- Vídeos: YouTube Data API v3, usando `YOUTUBE_API_KEY` somente no servidor.
- Cifras: coleção interna `authorizedChordSources` ou um provedor autorizado configurado por `CHORD_PROVIDER_URL` e `CHORD_PROVIDER_TOKEN`.

Nenhum conector raspa páginas de letras ou cifras. Resultados ausentes não são inventados e o cadastro manual permanece disponível.

## Coleção de cifras autorizadas

Enquanto não houver um provedor externo contratado, `authorizedChordSources` pode armazenar cifras cuja reutilização foi autorizada. Cada documento aceita `title`, `normalizedTitle`, `artist`, `version`, `source`, `key`, `contentText` e `active`. O conteúdo é lido somente pela função autenticada.

## Teste local

1. Copie `.env.example` para `.env` dentro desta pasta e preencha apenas as integrações disponíveis.
2. Inicie os emuladores de Auth, Firestore, Functions e Hosting.
3. Use um administrador cadastrado no banco de testes.

O arquivo `.env` é ignorado pelo Git. A configuração atual do projeto continua apontando para um Firebase de teste ainda não provisionado e, por segurança, nenhum deploy é executado por estes arquivos.
