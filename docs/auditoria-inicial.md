# Auditoria inicial — Ministério Seven

Data da análise: 2026-11-06

## Escopo e segurança

- Fonte de referência: cópia local do repositório atualmente publicado.
- Repositório de reconstrução: `AndrewLindolfo/site-ministerio-seven`.
- Produção atual e seu repositório não serão modificados durante a reconstrução.
- Firebase usado pelo site atual: `ministerio-seven-v2` (plano Spark).
- Firebase de destino: `ministerio-seven-site` (plano Blaze).
- Firestore atual: edição Standard, modo nativo, região multirregional `nam5`.
- Firestore de destino: edição Standard, modo nativo, região `southamerica-east1`.

## Inventário da base importada

- 418 arquivos, aproximadamente 10 MB.
- 218 arquivos JavaScript.
- 62 folhas CSS.
- 38 páginas HTML.
- 67 imagens PNG.
- 1 arquivo de regras do Firestore.
- Não existe suíte automatizada de testes nem configuração de build no projeto importado.

## Achados iniciais confirmados

### Segurança crítica

As regras antigas permitem que qualquer usuário autenticado grave em `admins`, `activity_logs` e em praticamente todas as coleções de conteúdo. Como a autorização administrativa é feita no navegador, um usuário autenticado pode tentar criar ou alterar o próprio documento de administrador. A base antiga não será replicada com essas regras.

A comparação no Console confirmou que as regras efetivamente implantadas têm essa vulnerabilidade. O arquivo local diverge apenas na leitura de `ensaios`: a produção exige autenticação, enquanto a cópia local a torna pública.

### Autorização apenas no cliente

O painel esconde páginas e botões com JavaScript, mas as regras do Firestore não aplicam as mesmas permissões. Restrições visuais não protegem os dados diretamente.

### Service worker propenso a conteúdo obsoleto

O service worker usa cache-first, não remove caches antigos e mantém o nome fixo `ministerio-seven-v1`. Isso pode entregar JavaScript e CSS antigos depois de uma atualização, explicando comportamentos intermitentes entre dispositivos.

### Dependências inconsistentes

A maior parte do projeto importa Firebase Web SDK `10.12.2`, enquanto `assets/js/lib/firestore-helpers.js` importa `11.7.1`. A nova base terá uma única versão controlada pelo gerenciador de pacotes.

### Duplicação e arquivos suspeitos

- `admin/config.html` e `admin/links.html` são idênticos.
- Há cópias duplicadas dos banners em diretórios aninhados.
- Ícones e favicons idênticos aparecem com nomes diferentes.
- A distribuição completa do TinyMCE está versionada, incluindo temas e arquivos que não precisam ser enviados ao usuário.

### Configuração desatualizada

`assets/js/config.js` registra o domínio oficial `ministerioseven.site` e o subdomínio administrativo `adm.ministerioseven.site`.

### Referências quebradas

O verificador estático reproduzível (`npm run audit:static`) encontrou:

- `editor-cifra.html` está na raiz, mas referencia 13 recursos usando `../assets/...`; esses caminhos saem da raiz do site e quebram CSS, ícones e JavaScript.
- `playlists.html` referencia `assets/css/pages/biblioteca-pessoal.css`, que não existe.
- O projeto carrega duas versões diferentes do Firebase Web SDK (`10.12.2` e `11.7.1`).

## Verificações concluídas

- Todos os arquivos JavaScript próprios passam na verificação sintática do Node.js.
- Todos os arquivos JSON são sintaticamente válidos.
- A sintaxe correta não elimina falhas de integração, autorização ou lógica; essas áreas serão testadas por fluxo.

## Próximas etapas

1. Mapear páginas, coleções, consultas e fluxos administrativos.
2. Ler as regras efetivamente implantadas no projeto antigo e comparar com o arquivo local.
3. Definir modelo de permissões seguro para o novo projeto.
4. Definir arquitetura, ferramentas de build, testes e emuladores.
5. Migrar cada módulo com testes de regressão e validação visual.
6. Validar em canal de preview antes de qualquer troca de domínio.

## Estado seguro do projeto de destino

O Firestore novo está vazio e usa a regra inicial `allow read, write: if false`. Esse bloqueio será preservado até que os modelos, consultas e testes das regras novas estejam completos.

