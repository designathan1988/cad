# Prompt: teste completo do cad2 como usuário real

Cole o texto abaixo numa sessão nova do Claude Code aberta na pasta do cad2.

---

Teste a aplicação cad2 inteira como um usuário real, com gestos humanos, tire fotos de cada passo, analise cada foto e corrija no código tudo o que estiver errado. O objetivo é achar **todos** os problemas de funcionalidade e de interface, não só os óbvios.

## 1. Antes de tocar no app: o mapa completo

Não confie na minha lista; descobrir o que existe é trabalho seu. Monte um inventário a partir do código e grave em `docs/mapa-de-teste.md`:

- Todas as abas da faixa de ferramentas e cada botão delas (`src/app/ribbon-tabs.ts`, `src/ui/ribbon.ts`).
- Todos os tipos de elemento (`src/elements/registry.ts` e cada pasta em `src/elements/`): parede, porta, janela, laje, telhado, escada, coluna, viga, guarda-corpo, cômodo, terreno, cota, nota, corte, folha, instalações (MEP), etc. — a lista real é a do código.
- Todos os diálogos (`src/ui/*-dialog.ts`), painéis, menus, menu de contexto (`src/app/context-menu.ts`), busca, tour, dicas.
- Todos os atalhos de teclado (`src/app/keymap.ts`, `src/app/input-keys.ts`, `src/app/view-keys.ts`).
- Todas as vistas: planta, 3D, fotorrealista, passeio (walk), cortes, folhas, impressão, tabelas e quantitativos, simulação.
- Estados e fluxos: criar, selecionar, selecionar vários, mover, girar, copiar, apagar, desfazer/refazer, alças, cotas temporárias, ajuste (snap), pavimentos, camadas, salvar/abrir projeto, importar, exportar, imprimir.

Mostre o mapa com a contagem de itens antes de começar a testar.

## 2. Como usar o mouse e o teclado

Use só a janela Playwright visível que já estiver aberta (regras em `.claude/memoria/`: uma janela, reaproveitada, sem novas abas, sem roubar o foco, sem redimensionar a janela do Windows). Nada de JavaScript na página, chamada direta de funções ou testes automatizados no lugar dos gestos.

Cada gesto tem que parecer de gente:

- **Trajeto errante:** antes de cada clique, leve o mouse em 4 a 8 passos intermediários com `browser_mouse_move_xy`, numa curva irregular, com pequenas variações de velocidade (passos curtos e longos misturados), nunca em linha reta direto ao alvo.
- **Pouso impreciso:** pare 2 a 8 px fora do centro do alvo; às vezes passe do alvo e volte; às vezes pouse na borda do botão. Pare um instante sobre o alvo (hover) e fotografe as dicas e realces que aparecem.
- **Clique:** `browser_mouse_down` e `browser_mouse_up` separados, às vezes com um tremor de 1 a 2 px entre os dois (é assim que um clique vira arrasto sem querer — teste isso também).
- **Arrasto:** pressione, mova em muitos passos pequenos e irregulares, hesite no meio, volte um pouco, siga, e só então solte. Teste soltar em cima de algo, no vazio, fora da área de desenho e fora da janela.
- **Duplo clique, botão direito, roda do mouse** (zoom e rolagem) em vários pontos, não só no centro.
- **Teclado:** digite em campos como gente (inclusive errando e apagando com Backspace), use Tab, Shift+Tab, Enter, Esc, setas, Delete, Ctrl+Z, Ctrl+Y, Ctrl+C/V, Shift e Ctrl junto com cliques, e todos os atalhos do mapa.
- **Erros de usuário de propósito:** clicar na ferramenta errada e cancelar, apertar Esc no meio de um desenho, desfazer várias vezes seguidas, digitar valor inválido (negativo, zero, letras, vazio, número enorme), clicar duas vezes rápido num botão, abrir um diálogo por cima de outro.

## 3. Fotos e análise

- Tire uma foto (PNG, resolução de trabalho 1920 × 1080; confirme a largura da página antes de julgar a foto) antes e depois de cada gesto importante, e foto com zoom nos detalhes pequenos: ícones, textos, bordas, alinhamentos, cursores, alças, cotas.
- **Analise de verdade cada foto**, descrevendo o que vê. Procure: elemento que não aparece ou aparece no lugar errado, vista que pula ao selecionar, texto cortado, sobreposto, em inglês ou com erro de português, ícone errado ou borrado, contraste fraco, foco de teclado invisível, botão que não responde, realce que não some, alça difícil de pegar, cursor errado, desenho que não segue o mouse, atraso perceptível, artefato no 3D ou no fotorrealista.
- Leia o console depois de cada fluxo (`browser_console_messages`) e trate todo erro ou aviso como problema.
- Envie as fotos importantes para mim (SendUserFile) à medida que avança.
- Repita os gestos de seleção e de painéis também com a página em ~1280 px e ~880 px de largura (só a página, `setViewportSize`), compare as fotos para ver se o desenho mudou de lugar, e volte para 1920 × 1080 logo em seguida.

## 4. Corrigir

- Para cada problema: ache a causa raiz no código, corrija, espere o recarregamento automático (HMR), repita o mesmo fluxo com gestos humanos e tire nova foto. Mostre antes e depois.
- Sem atalhos: nada de esconder erro com try/catch vazio, valor fixo ou condição especial; nada de px cru no CSS.
- Não rode suítes de teste nem processos pesados; um `npm run typecheck` rápido antes de cada commit é permitido.
- Desfaça (Ctrl+Z) o que você desenhou no projeto de teste quando terminar cada fluxo.
- Faça commit pequeno de cada correção verificada e push para `origin main`, só com arquivos do projeto.
- Grave cada aprendizado novo em `.claude/memoria/`.

## 5. Não pare cedo

Não pare no primeiro problema, não encurte o roteiro e não declare que algo funciona sem foto que prove. Se uma chamada do Playwright passar de 30 s, interrompa e me diga.

## 6. Relatório final

- Cobertura: "X de Y itens do mapa testados", e quais ficaram de fora e por quê.
- Lista de problemas encontrados, cada um com: onde, como reproduzir, foto, causa, correção (antes/depois) e commit.
- Problemas encontrados e **não** corrigidos, com o motivo.
- O que você não conseguiu testar ou não verificou.
