# Estrutura do Firebase de destino

Projeto: `ministerio-seven-site`

## Serviços

- Authentication: e-mail/senha e, quando habilitado no console, Google.
- Cloud Firestore `(default)`: edição Standard, modo Native, região `southamerica-east1`.
- Cloud Storage: bucket existente, fechado pelas regras porque o site atual não realiza uploads.
- Firebase Hosting: site estático servido diretamente da raiz do repositório.

## Coleções

- `admins`: `master` para o administrador principal; convites secundários no formato `email_<email normalizado>`.
- `musicas`, `cifras`, `programacoes`, `albuns`, `downloads`, `downloadsPorMusica`, `notificacoes`: conteúdo público somente quando `active == true`; gravação administrativa por permissão.
- `ensaios`: conteúdo público exibido na página inicial; gravação administrativa por permissão.
- `contatos`: criação pública com esquema limitado; leitura, marcação e exclusão administrativas por permissão.
- `config/site`: leitura pública e gravação exclusiva do administrador principal.
- `activity_logs`: criação por administradores autenticados, leitura por permissão e nenhuma alteração ou exclusão pelo cliente.
- `usuariosPublicos/{uid}`: perfil privado do próprio usuário.
- `bibliotecasUsuarios/{uid}`: favoritos e playlists privados do próprio usuário.

## Inicialização administrativa

As regras não permitem que o navegador crie o primeiro administrador. Antes do primeiro login administrativo, o documento `admins/master` deve ser criado por uma operação confiável com o UID e o e-mail verificado da conta principal. Essa etapa será feita somente depois que a conta existir no Authentication do projeto novo.

## Validação

- Regras do Firestore e Storage compiladas pelo Firebase CLI em `--dry-run`.
- 10 cenários de autorização aprovados no emulador local.
- Índices compostos não são necessários para as consultas atuais; o arquivo de índices permanece explicitamente vazio.
