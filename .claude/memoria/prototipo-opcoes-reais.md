# O protótipo de interface usa as opções reais do app

Toda aba, grupo, ferramenta, campo, opção e tecla do protótipo vem do app, com o nome em português do `src/ui/i18n.ts` (tabela `pt`). Nada inventado: o que não existe no app não entra, e o nome não muda.

**Por quê:** o dono reclamou que a ribbon do protótipo tinha abas inventadas (Editar, Inserir…) em vez das reais (Início, Arquitetura, Estrutura, Anotar, Vista, Gerenciar) e pediu o resto da interface com as opções reais (2026-10-28).

**Como aplicar:** antes de desenhar uma parte, ler a fonte dela e listar o que existe:
- ribbon: `src/app/ribbon-tabs.ts` (abas, grupos, `FILE_MENU`, abas de contexto "Modificar | …" e "Colocar …");
- nomes e teclas: `src/app/actions.ts`;
- propriedades: `src/elements/*/fields.ts`, `src/elements/opening/panel.ts`, `src/ui/panel.ts` (seções, campos `sub` recuados, `wide` em linha própria);
- navegador: `src/ui/browser.ts`;
- barra 3D, status e visibilidade: chaves `view3d.*`, `foot.*`, `layer.*`, `vis.*`.

Exceção pedida pelo dono: a ribbon do protótipo NÃO tem a aba de contexto do app ("Modificar | …", "Colocar …"). As ações da seleção ficam no painel de propriedades, numa barra de ícones sob o título, e os modos da ferramenta ficam na faixa sobre a vista (2026-10-28).

Os valores de exemplo (4,00 m, Sala, Cozinha) podem ser inventados; os nomes, não. Depois de mudar o protótipo, rodar `run-states.cjs` (scratchpad/tools), que executa o script em todos os estados e confere os campos.
