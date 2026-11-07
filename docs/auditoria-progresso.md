# Progresso da auditoria

## Regra de retomada

Ao retomar o trabalho, revalidar o último item concluído e continuar a partir do primeiro item pendente.

## Concluído

- Base antiga importada e preservada no histórico Git.
- Firebase atual e Firebase de destino identificados.
- Regras antigas comparadas com as regras implantadas.
- Verificador estático criado.
- `.gitattributes` revisado e mantido para normalização de texto.
- `.vscode/settings.json` removido por conter apenas configuração pessoal do Live Server.
- `CNAME` removido porque pertence ao GitHub Pages e o destino será Firebase Hosting.
- `README.txt` removido por ser um registro parcial e obsoleto de alterações.
- `editor-cifra.html` da raiz removido por ser uma cópia antiga e quebrada; a página válida está em `admin/editor-cifra.html`.
- `manifest.json` validado; ícones confirmados e escopo, identificador e idioma definidos explicitamente.
- `robots.txt` atualizado para o domínio atual e para não indexar áreas administrativas ou pessoais.
- `sitemap.xml` atualizado para o domínio atual.
- `service-worker.js` removido porque não era registrado e continha uma estratégia antiga de cache sem atualização ou limpeza.
- `404.html` corrigido para funcionar em qualquer URL inexistente, sem depender do nível do caminho; indexação desativada.
- `assets/js/pages/error404.js` removido porque continha apenas um ouvinte vazio.
- `agenda.html`, `assets/js/pages/agenda.js` e `assets/css/pages/agenda.css` revisados; metadados corrigidos, incorporação limitada a HTTPS e estados de carregamento e erro tornados previsíveis.

## Em andamento

- Auditoria dos arquivos HTML públicos da raiz concluída.
- Módulo `cifra.html`: conteúdo rico agora é sanitizado, instrumentos são normalizados por lista fechada, modo temporário de demonstração foi removido, carregamento da coleção foi reduzido a uma leitura e preferências locais não derrubam mais a página quando o armazenamento está bloqueado.
- Módulo de cifras: controles, diagramas, ações pessoais e exportação de PDF revisados; acessibilidade por teclado adicionada, campos persistidos limitados, conteúdo de impressão sanitizado e editor do metrônomo ligado ao CSS existente.
- Testes unitários de teoria musical adicionados e aprovados.
- `cifras.html`, `assets/js/pages/cifras.js` e o filtro alfabético compartilhado revisados; renderização insegura removida, links internos validados e busca sem distinção de acentos coberta por testes.
- `conta.html` e o fluxo público de autenticação revisados; observadores duplicados foram centralizados, gravações de perfil em toda página foram eliminadas, dados e fotos são normalizados e a identificação administrativa passou a usar UID em vez de listar administradores por e-mail.
- Testes de URLs de perfil adicionados e aprovados.
- `contato.html` e `assets/js/pages/contato.js` revisados; limites, validação, proteção contra duplo envio, campo-isca e estados de erro foram adicionados, com testes unitários do payload persistido.
- `downloads.html` e `downloads-por-musica.html` revisados; conteúdo passou a ser criado por DOM, URLs externas são limitadas a HTTPS, campos persistidos têm limites e a busca por música ignora acentos.
- `favoritos.html` e `playlists.html` revisados; referência CSS inexistente removida, renderização convertida para DOM seguro, leituras concorrentes deduplicadas e limites da biblioteca ajustados ao teto de documento do Firestore.
- `ferramentas.html` revisado; microfone e contextos de áudio são encerrados com segurança, análise do afinador foi reduzida e reutiliza memória, entradas do metrônomo são limitadas e a matemática de áudio recebeu testes automatizados.
- `fotos.html` revisado; cartões são criados por DOM e links e capas de álbuns são normalizados como HTTPS tanto na leitura quanto na gravação.
- Página temporária `inauguracao.html` e seus arquivos exclusivos removidos após o lançamento; o redirecionamento vencido e desativado também foi retirado de `index.html`.
- `index.html` e dependências da página inicial revisados; metadados foram corrigidos, URLs dinâmicas são validadas, conteúdo persistido é escapado, carregamentos independentes ocorrem em paralelo e observadores que repetiam consultas foram removidos.
- As notificações da mesma abertura agora compartilham uma única consulta; armazenamento local bloqueado não interrompe mais a página e dois módulos vazios e sem uso foram removidos.
- `login.html` e o núcleo de autenticação administrativa revisados; login por e-mail/senha e Google foi estruturado, sessões não autorizadas são encerradas e a validação deixou de depender de consulta ampla por e-mail.
- O observador global de autenticação não tenta mais sincronizar administradores em toda página, e o popup de comunicados passou a carregar somente onde possui interface e finalidade.
- `musica.html` revisado; letras ricas são sanitizadas, músicas inativas não são abertas pela rota pública, o observador contínuo foi removido e cifras e navegação são carregadas em paralelo.
- Incorporações do YouTube agora aceitam somente HTTPS, hosts oficiais e IDs válidos; preferências dos controles têm limites e não derrubam a página quando o armazenamento local está indisponível.
- Testes automatizados de URLs do YouTube adicionados e aprovados.
- `musicas.html` revisado; listagem passou a usar DOM seguro, slugs são codificados, itens incompletos são descartados e a busca ignora maiúsculas e acentos.
- `notificacoes.html` revisado; a leitura duplicada em tempo real foi removida, cartões usam DOM seguro, links são validados e datas aceitam valores nativos e `Timestamp` do Firestore.
- Busca global revisada; carregamentos concorrentes aguardam a mesma promessa, falhas parciais não apagam todo o índice, resultados com destino compartilhado não são mais descartados e links são normalizados antes da exibição.
- A busca passou a usar DOM seguro e melhorou estado de carregamento e acessibilidade; dois módulos vazios ou sem referências foram removidos e a validação compartilhada de URLs recebeu testes.
- Inicialização global revisada; páginas administrativas não carregam mais a conta pública e páginas sem ações pessoais deixaram de consultar favoritos e playlists.
- Tema, menus móvel e administrativo e autenticação pública foram endurecidos; perfil e estado visual de administrador usam cache curto para evitar novas leituras a cada navegação.
- Quinze módulos vazios, demonstrativos ou substituídos e quatro funções globais sem uso foram removidos após confirmação de ausência de referências.
- Ações pessoais revisadas; alterações por usuário são serializadas, limites deixam de falhar silenciosamente, tipos e destinos são normalizados e o modal de playlists usa DOM seguro e restaura o foco.
- Dois serviços desconectados do site, de preferências antigas de cifra e contador de visualizações, foram removidos após confirmação de ausência de referências.
- Pendente no módulo de cifras: validação visual responsiva e consolidação final do CSS após inspeção no navegador.

## Próximo arquivo

- Serviços públicos de conteúdo em `assets/js/services/`
