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

## Em andamento

- Auditoria dos arquivos HTML públicos da raiz.

## Próximo arquivo

- `agenda.html`
