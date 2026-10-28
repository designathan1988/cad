# Memória do projeto

Aprendizados guardados entre sessões, um por arquivo nesta pasta. Este índice é importado pelo `CLAUDE.md`; cada linha aponta para o arquivo com o detalhe (o porquê e como aplicar).

- [Falar português](falar-portugues.md) — SEMPRE responder ao usuário em português do Brasil, inclusive relatórios e recaps
- [Navegador de teste](no-visible-browser.md) — uma janela Playwright visível, mantida aberta e reaproveitada, sem roubar o foco; nunca o painel embutido nem o Chrome
- [Commit e push no GitHub](commit-push-github.md) — sempre fazer commit e push do cad2 em github.com/designathan1988/cad (origin/main)
- [Nunca pedir permissão](never-ask-permission.md) — não parar para perguntar nem pedir aprovação; escolher a melhor opção e seguir
- [Travamento do Playwright](playwright-occlusion-hang.md) — janela do Chrome pequena ou coberta trava cliques; flags em playwright-mcp.config.json; não mexer no CDP; parar chamadas > 30 s
- [Testes antes do commit](tests-before-commit.md) — SUBSTITUÍDO por fix-in-code-verify-in-app (sem suítes de teste agora); continua valendo: nada de px cru no CSS
- [Corrigir no código, conferir no app](fix-in-code-verify-in-app.md) — sem suítes, mutação ou execuções pesadas; ler o código, corrigir, conferir no app com gestos e capturas
- [Gestos orgânicos](organic-gestures.md) — só nos testes do app: trajetos de mouse imprecisos, como de gente; sempre capturar e analisar
- [Terminar antes de começar](finish-before-new.md) — fechar o trabalho em andamento primeiro; o protótipo de interface v72 é modelo de disposição das funções que existem, não lista de funções
- [Sem heredoc](no-heredoc.md) — NUNCA heredoc no shell; usar Edit/Write ou um script escrito com Write
- [Plano de escopo](scope-plan.md) — docs/plano-de-escopo.md é a especificação (15 fases, contrato primeiro); construir e testar num projeto novo em branco
- [Fotorrealista limpo](photoreal-trace.md) — como o traçado evita trava, grão, fireflies, sombra em degraus e luz sob as paredes; nunca FEATURE_MIS 0
- [Memória que sobrevive à compactação](compaction-memory.md) — o trabalho em andamento fica em docs/agent (orders.md, STATE.md, work.md), reimpresso pelos hooks a cada compactação
- [Só desktop](desktop-only.md) — a aplicação não é para celular: nunca testar nem projetar para mobile
- [Larguras de janela no teste](test-window-sizes.md) — testar também com ~880 e ~1280 px de largura; comparar as capturas para a vista nunca pular ao selecionar
