# Estado entre execuções do teste headless (scratchpad pw/drive.cjs)

Cada execução de `drive.cjs` recarrega a página. O que volta e o que não volta:
- volta: o projeto (salvo no navegador), o pavimento mostrado, a vista (planta ou 3D), o zoom e o enquadramento da planta;
- não volta: o histórico de desfazer (Ctrl+Z não alcança o que a execução anterior fez), a seleção, seções abertas do painel ("Mais opções" fechado).

**Por quê:** em 2026-10-29 um zoom de roda deixado por uma execução anterior mudou a posição das coisas; os cliques por coordenada
caíram em outro lugar e apagaram um cômodo de teste sem querer. Sem histórico entre execuções, não deu para desfazer.

**Como aplicar:** no começo de cada execução que clica por coordenadas, apertar Esc e `Home` (enquadrar) e tirar uma captura antes
de clicar; apagar só depois de conferir na captura (e no painel) o que está selecionado; desfazer na mesma execução.

Também (2026-10-31):
- `<select>` nativo (escala do rodapé, estilo do 3D): no headless o clique na lista aberta não chega; clicar no seletor, Esc e setas
  (é gesto de usuário). Depois clicar no vazio: com o foco no seletor, Ctrl+K não abre a paleta.
- Paleta aberta engole Ctrl+Z: fechar (Esc) antes de desfazer.
- Sem IndexedDB (janela privada): `NODB=1 node drive.cjs …` usa o perfil `profile-nodb` sem `indexedDB` (ambiente, não gesto).
