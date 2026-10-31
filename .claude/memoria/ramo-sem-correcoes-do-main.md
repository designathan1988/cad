# Um ramo de worktree não tem as correções feitas no main depois que ele saiu

O worktree `revisao-interface` saiu do main em 4d41084; o main seguiu com 93 commits (F-0096, F-0099, o arrasto de parede 2d16f98…).
Um defeito "antigo" achado no worktree (arrastar parede não movia) já estava corrigido no main: só faltava no ramo.

**Por quê:** em 2026-10-31 relatei como "pré-existente, não causado aqui" um defeito que o STATE.md dava como corrigido; a causa era o
ramo ter saído antes da correção. O STATE.md é do main, não do ramo.

**Como aplicar:** ao achar um defeito num worktree, conferir antes se o main já o corrigiu (`git log main --grep`, `git merge-base
--is-ancestor <commit> HEAD`) e portar a correção; dizer ao dono quantos commits o main tem que o ramo não tem
(`git rev-list --count HEAD..main`).
