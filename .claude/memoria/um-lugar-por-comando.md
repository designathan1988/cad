# Cada comando num lugar só

Na interface, nenhum comando aparece em dois lugares ao mesmo tempo. Ferramentas ficam na barra lateral; a barra superior mostra só o que a ferramenta em uso oferece (com Selecionar, os comandos da seleção); as ações da seleção não se repetem no painel de propriedades nem numa barra flutuante.

**Por quê:** o dono mandou "elimine todas as duplicações" (2026-10-28), depois de ver o Selecionar na barra superior e também na lateral, e as ações da seleção no painel em vez de na barra superior.

**Como aplicar:** antes de publicar uma prancheta, rodar `scratchpad/tools/find-duplicates.cjs` nela: ele junta os comandos visíveis em cada estado (barra, ferramentas, navegador, menu Arquivo, painéis, barra 3D, botões fixos) e lista os nomes repetidos. A única repetição aceita é o primeiro modo de uma ferramenta na barra superior (Linha da parede, Piso, Cota…), que é a volta ao modo e não um comando a mais; dizer isso ao dono.
