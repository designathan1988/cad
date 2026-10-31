# Larguras de janela no teste: só desktop, 1920 e 1280

Os testes do app rodam em 1920 × 1080 (a resolução de trabalho) e, para conferir, em 1280 de largura. Nunca em
880, 1100 nem em qualquer largura estreita; nada de viewport de celular.

**Por quê:** em 2026-10-31 testei a interface nova em 880 px seguindo a versão antiga desta memória, que pedia
~880 px. O dono respondeu: "PELA ÚLTIMA VEZ. ESSA APLICAÇÃO NÃO É PARA MOBILE!!!" e "VAI TESTAR EM 880 POR
QUE, CARALHO?". A regra antiga (2026-10-26, a tela pulava ao selecionar em janelas estreitas) está revogada.

**Como aplicar:** cada teste de interação em 1920 × 1080; a conferência de largura só em 1280. Ao selecionar,
comparar as capturas de antes e depois em 1920 para ver se o desenho pulou. Não criar nem ajustar regras CSS
para janelas estreitas ou celular. Relacionadas: [[desktop-only]], [[organic-gestures]].
