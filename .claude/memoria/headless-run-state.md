# Estado entre execuções do teste headless (scratchpad pw/drive.cjs)

Cada execução de `drive.cjs` recarrega a página. O que volta e o que não volta:
- volta: o projeto (salvo no navegador), o pavimento mostrado, a vista (planta ou 3D), o zoom e o enquadramento da planta;
- não volta: o histórico de desfazer (Ctrl+Z não alcança o que a execução anterior fez), a seleção, seções abertas do painel ("Mais opções" fechado).

**Por quê:** em 2026-10-29 um zoom de roda deixado por uma execução anterior mudou a posição das coisas; os cliques por coordenada
caíram em outro lugar e apagaram um cômodo de teste sem querer. Sem histórico entre execuções, não deu para desfazer.

**Como aplicar:** no começo de cada execução que clica por coordenadas, apertar Esc e `Home` (enquadrar) e tirar uma captura antes
de clicar; apagar só depois de conferir na captura (e no painel) o que está selecionado; desfazer na mesma execução.
