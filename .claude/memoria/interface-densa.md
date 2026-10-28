# Interface compacta, de app profissional

A interface do cad2 é densa: controles de 24–26 px, texto de 12 px, barras baixas, espaçamentos 6/10/12 px (tokens em
`src/ui/styles.css :root`). Botões de painel só com ícone, o nome na dica. Barras de rolagem, sliders, listas e campos sempre
estilizados no tema, nunca os nativos.

**Por quê:** o dono disse em 2026-10-28 que "tudo está muito grande, muito espaçado", que a interface "mais ocupa espaço do que
qualquer outra coisa", e que barras de rolagem e campos de formulário também devem ser estilizados. A referência medida foi o
VS Code (barra de título 35 px, status 28 px, botões 24 px) e o modo compacto do Fluent.

**Como aplicar:** pesquisar e medir antes de mudar tamanhos; mudar pelos tokens, não por valores soltos; conferir na tela que
nada ficou cortado (rótulos da ribbon, linhas dos painéis) depois de qualquer redução.
