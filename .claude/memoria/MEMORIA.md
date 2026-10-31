# Memória do projeto

Aprendizados guardados entre sessões, um por arquivo nesta pasta. Este índice é importado pelo `CLAUDE.md`; cada linha aponta para o arquivo com o detalhe (o porquê e como aplicar).

- [Falar português](falar-portugues.md) — SEMPRE responder ao usuário em português do Brasil, inclusive relatórios e recaps
- [Navegador de teste](no-visible-browser.md) — uma janela Playwright visível, mantida aberta e reaproveitada, sem roubar o foco; nunca o painel embutido nem o Chrome; página perdida (about:blank) não se recarrega; desde 2026-10-28 os testes rodam em headless (sem janela)
- [Commit e push no GitHub](commit-push-github.md) — sempre fazer commit e push do cad2 em github.com/designathan1988/cad (origin/main)
- [Nunca pedir permissão](never-ask-permission.md) — não parar para perguntar nem pedir aprovação; escolher a melhor opção e seguir
- [Travamento do Playwright](playwright-occlusion-hang.md) — janela do Chrome pequena ou coberta trava cliques; flags em playwright-mcp.config.json; não mexer no CDP; parar chamadas > 30 s
- [Testes antes do commit](tests-before-commit.md) — SUBSTITUÍDO por fix-in-code-verify-in-app (sem suítes de teste agora); continua valendo: nada de px cru no CSS
- [Corrigir no código, conferir no app](fix-in-code-verify-in-app.md) — sem suítes, mutação ou execuções pesadas; ler o código, corrigir, conferir no app com gestos e capturas
- [Gestos orgânicos](organic-gestures.md) — só nos testes do app: trajetos de mouse imprecisos, como de gente; sempre capturar e analisar
- [Terminar antes de começar](finish-before-new.md) — fechar o trabalho em andamento primeiro; o protótipo de interface v72 é modelo de disposição das funções que existem, não lista de funções
- [Sem heredoc](no-heredoc.md) — NUNCA heredoc nem here-string; nada de node -e com crases dentro de aspas duplas (o Bash executa); usar Edit/Write ou um script escrito com Write
- [Plano de escopo](scope-plan.md) — docs/plano-de-escopo.md é a especificação (15 fases, contrato primeiro); construir e testar num projeto novo em branco
- [Fotorrealista limpo](photoreal-trace.md) — como o traçado evita trava, grão, fireflies, sombra em degraus e luz sob as paredes; nunca FEATURE_MIS 0
- [Memória que sobrevive à compactação](compaction-memory.md) — o trabalho em andamento fica em docs/agent (orders.md, STATE.md, work.md), reimpresso pelos hooks a cada compactação
- [Larguras de janela no teste](test-window-sizes.md) — só 1920×1080 e 1280 de largura; NUNCA 880 nem janela estreita (regra antiga revogada em 2026-10-31)
- [Só desktop](desktop-only.md) — a aplicação não é para celular nem janela estreita: nunca testar, projetar nem escrever CSS para isso
- [Conferir o desenho antes de tirar um campo](check-render-before-removing.md) — antes de tirar um campo "só da área removida", grep quem o lê na planta, no 3D e na geometria
- [Estado entre execuções headless](headless-run-state.md) — cada execução recarrega: zoom e pavimento ficam, desfazer some; Home e captura antes de clicar por coordenadas; select nativo por teclado; NODB=1 sem IndexedDB
- [Ramo sem as correções do main](ramo-sem-correcoes-do-main.md) — num worktree, conferir se o main já corrigiu um defeito antes de chamá-lo de antigo; portar e contar os commits que faltam
