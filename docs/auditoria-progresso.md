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
- Consultas públicas de músicas, cifras, álbuns, downloads, comunicados e programações agora exigem `active == true` no Firestore; conteúdo desativado deixou de ser baixado para filtragem no navegador.
- Cache de listas públicas e administrativas foi separado e centralizado, com deduplicação de consultas concorrentes e testes automatizados; 20 testes estão aprovados.
- Configuração do site agora usa atualização parcial e não apaga mais a foto principal ao salvar links; URLs, agenda e e-mail são normalizados antes da persistência.
- Serviços de ensaios e programações receberam limites, timestamps, leitura direta por ID e validação de títulos, datas, horários e listas de músicas.
- Serviços de músicas e cifras agora preservam visualizações em edições, limitam o tamanho dos documentos, sanitizam HTML na gravação e validam vídeos e campos essenciais.
- Abertura de cifra por `slug` ou música vinculada passou a consultar somente as variantes necessárias, sem baixar toda a coleção.
- Comunicados agendados com exibição antecipada foram corrigidos; tipos, modos, datas, botões e tamanhos agora são validados antes da gravação.
- Permissão principal deixou de ser inferida pela ausência de permissões; documento `master` e flags explícitas são os únicos caminhos, e IDs de novos convites por e-mail não sofrem colisão.
- Logs administrativos não vazam mais dados para `config`; backup inclui as coleções de conteúdo faltantes, exporta em paralelo e a restauração recebeu limites e preserva IDs internos.
- Painel administrativo e cadastro de ADMs revisados; identificação usa UID, cartões são ocultados até a validação, dados persistidos são escapados, operações exibem falhas sem travar a tela e alterações de e-mail recriam o convite sem reaproveitar o UID anterior.
- Gestão e editor de músicas revisados; a listagem consulta uma vez e filtra localmente, usa DOM seguro, respeita permissões antes das ações e não deixa listeners duplicados, enquanto o editor valida permissões, mantém o estado ativo e consulta títulos duplicados diretamente.
- Exclusão de música agora é bloqueada quando há cifras ou downloads vinculados, evitando documentos órfãos; dois arquivos CSS vazios e redundantes foram removidos.
- Listagem administrativa de cifras revisada; a coleção é carregada uma vez, filtros são locais e sem acentos, a interface usa DOM seguro e somente variantes de instrumentos autorizados são expostas, e o seletor de instrumento deixou de injetar estilos e listeners residuais.
- Editor administrativo de cifras revisado; músicas são carregadas uma vez e renderizadas por DOM, permissões são aplicadas também à persistência, campos protegidos preservam o valor existente, conteúdo inativo não é reativado e duplicidades são consultadas somente pela música vinculada.
- Gestão de programações revisada; carregamento duplicado foi removido, ações são protegidas antes da execução, links internos são codificados e o estado ativo é preservado nas edições.
- O campo `hideAfter` de programações voltou a funcionar: horários simples, datas e `Timestamp` são lidos corretamente, o formulário recebe apenas `HH:mm` e o valor agora é incluído no salvamento.
- Gestão e editor de ensaios revisados; a falha `PLACEHOLDER` no tratamento de erros foi removida, leituras aguardam autenticação, permissões são verificadas na execução, renderização usa DOM seguro e operações passam a registrar atividades.
- CSS antigo de modal e estilos duplicados de programações foram removidos do módulo de ensaios, mantendo apenas os seletores realmente usados.
- Gestão de fotos revisada; álbuns são carregados uma vez por atualização, títulos e URLs usam DOM seguro, permissões protegem abertura e execução das ações, edições preservam o estado ativo e mensagens do Firebase são exibidas corretamente.
- Hub e gestões de downloads gerais e por música revisados; cada administrador vê apenas os módulos autorizados, leituras repetidas foram removidas, conteúdo persistido é escapado, selects usam DOM seguro e permissões protegem todas as operações.
- Edições de downloads preservam o estado ativo, campos receberam limites coerentes com os serviços e falhas de criação, edição e exclusão exibem o erro real sem deixar botões travados.
- Gestão de contatos revisada; dados pessoais só são consultados após confirmar a permissão de visualização, a leitura foi limitada aos 200 registros mais recentes, toda renderização usa DOM seguro e a permissão de exclusão passou a executar a função correspondente.
- Marcação de leitura recebeu timestamp e tratamento de erro, e o CSS vazio exclusivo de contatos foi removido.
- Gestão de notificações revisada; permissões de criar e editar são verificadas conforme o estado do formulário, datas aceitam `Timestamp`, leituras repetidas foram removidas e operações possuem estados de erro e bloqueio.
- Administradores com permissões parciais não apagam mais configurações protegidas de popup, faixa do topo, botão ou exibição antecipada ao editar um comunicado.
- Configuração de links revisada e limitada ao administrador principal; campos possuem limites, erros são exibidos sem travar o formulário e a gravação continua parcial para não apagar outras configurações do site.
- `admin/config.html`, `admin-config.js` e os CSS vazios de configuração foram removidos por duplicarem integralmente a página `admin/links.html`.
- Backup agora permanece bloqueado até validar o administrador principal, apresenta progresso e erros no próprio painel e descreve corretamente todas as coleções incluídas.
- Logs administrativos só são consultados após confirmar `logs.view`, não listam mais todos os administradores, escapam todos os campos persistidos e calculam usuários a partir do próprio histórico limitado.
- Pendente no módulo de cifras: validação visual responsiva e consolidação final do CSS após inspeção no navegador.

## Próximo arquivo

- Consolidação do SDK Firebase, arquivos residuais e auditoria estática final
