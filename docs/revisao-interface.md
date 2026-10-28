# Revisão da interface do cad2 — problemas e soluções

Data: 2026-10-28. Branch `worktree-revisao-interface`. Visto no app (Playwright, 1920×1080, gestos reais) e no código. A aplicação é para desktop: celular fora do escopo.
Capturas: `docs/revisao-interface/01…09-*.png`.

## Referências pesquisadas

- **Revit, paleta Propriedades** (help.autodesk.com, Revit 2023): de cima para baixo, seletor de tipo, filtro de categoria,
  "Editar tipo", propriedades da instância. Sem seleção mostra a vista; durante a colocação mostra o elemento que vai ser colocado.
  A ribbon (aba contextual "Modificar") só tem **comandos**, nunca campos.
- **Archicad, Info Box e Tool Settings** (help.graphisoft.com, AC29): o mesmo painel serve para "Padrão" (próximo elemento) e
  "Selecionado"; o título diz qual; painéis recolhíveis; favoritos por ferramenta.
- **Microsoft, guia da ribbon** (learn.microsoft.com, uxguide/cmd-ribbons): a ribbon só compensa com muitos comandos em várias áreas;
  barras de ferramentas e paletas podem ser mais eficientes; trocar de aba o tempo todo a torna ineficiente; aba contextual só para
  comandos do objeto; grupos de 3 a 5 comandos.
- **Microsoft, menus** (uxguide/cmd-menus): menu de contexto com até 15 itens em grupos com separadores, conjunto completo
  (Recortar/Copiar/Colar), Propriedades por último; comandos nunca dentro de listas de seleção.
- **Figma UI3** (figma.com/blog/behind-our-redesign-ui3): barra de ferramentas fina, tela em primeiro lugar, painel de propriedades
  por importância e recolhível; testaram e **descartaram** interface que aparece e some, porque o espaço "parecia instável".
- **Fusion, ViewCube** (help.autodesk.com/…/GS-VIEWCUBE): cubo sozinho no canto, casa ao lado, projeção e tamanho no menu do
  botão direito do cubo; estilo visual numa barra de navegação fina e separada.
- **NN/g**: 10 heurísticas; divulgação progressiva (no máximo dois níveis); Lei de Fitts (alvos maiores e perto de onde se
  trabalha); modal só para o que é crítico.
- **Hassenzahl / MeasuringU**: qualidade pragmática (fazer bem) e hedônica (estímulo e **identificação**: o que a ferramenta diz
  sobre quem a usa) pesam quase igual no apelo. "Cara de formulário" fere a identificação profissional.
- **WCAG 2.2, 2.5.8**: alvos de 24×24 px ou com folga equivalente.

## A estratégia (o que muda na disposição)

1. **A ribbon deixa de ter abas que trocam sozinhas e campos.** No lugar: uma barra superior fixa e fina com as ferramentas
   agrupadas por tarefa (Selecionar · Construir · Estrutura · Anotar · Modificar · Vistas). A ribbon com campos é a causa da
   "cara de formulário".
2. **Propriedades e configurações moram só no painel de Propriedades** (à direita): seletor de tipo no topo, seções recolhíveis,
   o mesmo painel para "Próximo elemento" e "Selecionado" (como Revit e Archicad), valores que diferem do tipo marcados.
3. **Comandos da seleção** numa mini-barra flutuante junto do elemento (já existe) e num menu de botão direito completo e agrupado.
4. **Opções da ferramenta ativa** (cópia, desunir, inverter lado, dobradiça, arco, retângulo) numa faixa de opções clicável no topo
   da vista, com a tecla ao lado, em vez de só no rodapé.
5. **Navegação da vista no canto**: só o cubo (3D) com a casa; projeção e tamanho no menu do cubo. Planta/3D e pavimento vão para a
   barra superior, uma vez só.
6. **Barra inferior da vista** vira uma "pílula" compacta de ícones (Pavimentos visíveis, Explodir, Corte, Raio-X, Caixa, Paralela) e
   um único botão **Exibição** que abre um painel com estilo (cartões visuais), qualidade e luz.
7. **Visibilidade** num só lugar: categorias com olho, substituições e combinações de camadas.

## Problemas e soluções

Gravidade: S1 quebra; S2 errado num caso real; S3 atrapalha; S4 cosmético.

### Ribbon e barra superior

| # | Problema (onde) | Solução |
|---|---|---|
| R1 · S2 | Aba contextual "Colocar parede/porta" é um formulário de 5 a 15 campos (captura 02, 03; `app.ts:534`, `ribbon-tabs.ts`). Os mesmos campos estão no painel "Próxima parede/porta" ao lado: duas cópias. | Tirar todos os campos da ribbon. O painel de Propriedades já mostra o próximo elemento (`frame.ts:338-357`). |
| R2 · S2 | A ribbon troca de aba sozinha a cada seleção ou ferramenta (`app.ts:1776`, `chrome.ts:544-551`): a faixa muda de altura e conteúdo sob o mouse. | Barra superior estável; comandos da seleção na mini-barra e no menu de contexto. |
| R3 · S3 | Botões grandes e pequenos misturados sem regra (Parede grande, Piso/Telhado/Escada em lista pequena; captura 01): a ordem visual não segue a frequência de uso. | Todas as ferramentas do mesmo tamanho, ícone + rótulo curto, agrupadas por tarefa com separadores. |
| R4 · S3 | "Planta" e "3D" aparecem na ribbon E no painel do cubo (captura 05). | Um só seletor Planta/3D na barra superior. |
| R5 · S3 | A dica inicial manda "Parede na aba Arquitetura", mas o botão Parede está na aba Início, visível (captura 01). | Dica "Comece pela ferramenta Parede (W)" apontando para o botão. |
| R6 · S3 | Textos cortados nos campos da ribbon ("Abrir, almofadad…", "Maçaneta de alav…"; captura 03). | Some com R1. |
| R8 · S4 | O título "cad2" e a fonte vinda do Google em tempo de execução (`index.html:6-10`). | Marca do produto na barra; pilha de fontes do sistema com números tabulares. |

### Painel do cubo (view cube) — reclamação do dono

| # | Problema | Solução |
|---|---|---|
| C1 · S2 | Um cartão branco empilha cubo, casa, ícones Planta/3D, seletor "Térreo" e "Navegador" (capturas 01, 05): coisas de natureza diferente no mesmo bloco, que cobre o desenho. | Cubo sozinho, sem cartão, semitransparente até o mouse chegar; casa ao lado; o resto sai dali. |
| C2 · S3 | Na planta o cartão continua com Planta/3D/Térreo/Navegador (captura 01). | Na planta não há cubo; nada no canto. |
| C3 · S3 | Rótulos do cubo minúsculos e inclinados ("Topo", "Frente", "Direita"). | Rótulos maiores, retos na face voltada para a tela. |
| C4 · S3 | O pavimento é um `select` com "Editar pavimentos…" como opção (`chrome.ts:136`). Comando dentro de lista. | Seletor de pavimento na barra superior: lista com elevação e "Gerenciar pavimentos" como botão. |

### Barra inferior da vista 3D — reclamação do dono

| # | Problema | Solução |
|---|---|---|
| B1 · S2 | 14 controles de texto do mesmo peso numa faixa: Todos, Até este, Só este, Explodir, Cortar, Raio-X, Caixa, Paralela, Estilo [select], Qualidade [select], Luz, Visibilidade (captura 05; `chrome.ts:81-132`). | Pílula compacta de ícones com dica; estilo, qualidade e luz num painel "Exibição". |
| B2 · S3 | Estilo e Qualidade são `select` com legenda: cara de formulário. | Estilos como cartões visuais (Sombreado, Realista, Linhas…). |
| B3 · S2 | "Visibilidade" abre "Substituições gráficas" (captura 07; `input-buttons.ts:87`); mostrar/ocultar categorias fica no Navegador. | Um painel Visibilidade com categorias (olho), substituições e combinações. |
| B4 · S3 | O painel Luz fica aberto sobre o desenho e só fecha pelo próprio botão (captura 06/07). | Popover que fecha com Esc e clique fora. |
| B5 · S3 | Texto contraditório: "a demolir em vermelho" e "a demolir em amarelo" no mesmo diálogo; botão "Aparecendo (ocultar)" (captura 07). | Um texto só e rótulo de interruptor: "Mostrar substituições". |

### Painel de Propriedades

| # | Problema | Solução |
|---|---|---|
| P1 · S3 | Sem seleção, o painel ocupa ~300 px só com "Nada selecionado" (captura 05). | Sem seleção mostra o pavimento/vista (como o Revit) ou recolhe para uma borda fina. |
| P2 · S3 | Opção avançada "Ao trocar o tipo, manter Vão livre/Linha de referência" logo no topo (captura 04). | Para "Mais opções". |
| P3 · S3 | Valores próprios da parede vs. do tipo não se distinguem (`document.ts:277`, `wallOverrides`). | Marca "alterado do tipo" e botão de voltar ao tipo no campo. |
| P4 · S3 | A parede é chamada pelo número da ordem de desenho ("Parede 2"), que muda quando outra é apagada (`document.ts:250`). | Marca estável (P1, P2…) atribuída uma vez. |

### Menus, teclas e retorno

| # | Problema | Solução |
|---|---|---|
| M1 · S2 | Menu do botão direito limitado a 6 itens: sem Copiar, Colar, Girar, Espelhar, Ocultar, Isolar (`context-actions.ts:38`). | Menu completo em grupos (até 15), mini-barra continua com 4-6 ícones. |
| M2 · S3 | Botão direito com ferramenta ativa faz uma coisa diferente por ferramenta, sem aviso (`input.ts:549`). | Menu da ferramenta: Terminar, Fechar, Desfazer ponto, Cancelar. |
| M3 · S2 | Opções da ferramenta só como teclas (C, U, Espaço, H, A, Q, "3x"), mostradas como chips no rodapé (`chrome.ts:266-366`). | Faixa de opções da ferramenta, clicável, no topo da vista (Revit Options Bar). |
| M4 · S3 | Resultado da medição, erros e recusas ("não cabe aqui") aparecem no rodapé, longe do mouse (`chrome.ts:264`, `app.ts:565`). | Etiqueta junto ao cursor (o rastreador de digitação já existe, `input.ts:110`). |
| M5 · S3 | Um aviso (toast) por vez, o próximo apaga o anterior; sem botão Refazer/Desfazer (`app.ts:1467`). | Pilha de até 3 avisos com ação. |
| M6 · S3 | Teclas definidas em três lugares (`actions.ts`, `input-keys.ts`, `input.ts:1006`); o menu de contexto mostra teclas fixas (`context-menu.ts:22`). | Um registro de comandos (ícone, rótulo, dica, tecla, onde aparece) de onde tudo lê. |
| M7 · S3 | Ajuda de atalhos é uma lista plana de ~50 linhas sem grupos nem busca (`input.ts:1006`). | Ajuda gerada do registro, em grupos, com busca. |
| M8 · S3 | Ctrl+A seleciona só paredes (`actions.ts:150`); Backspace apaga a seleção (`input-keys.ts:266`). | Ctrl+A seleciona tudo o que está visível; só Delete apaga. |
| M9 · S3 | "Abrir/fechar porta" na planta muda a vista para 3D sem pedir (`context-menu.ts:69`). | Nunca trocar de vista como efeito colateral. |

### Janelas, catálogos e projeto

| # | Problema | Solução |
|---|---|---|
| J1 · S2 | Seis catálogos separados, todos modais (tipos de parede, materiais, objetos, modelos, pisos, portas e janelas; `actions.ts:218-225`) e mais seis janelas de configuração. O modal esconde o modelo. | Biblioteca única não modal (painel lateral com categorias), reaproveitando a galeria boa da captura 09; Configurações do projeto numa janela com seções. |
| J2 · S3 | Navegador mistura Projetos, Unidades, Pavimentos, Vistas e Camadas; camadas como texto "visível/oculto" e riscado (captura 06). | Navegador só com Pavimentos e Vistas; camadas vão para Visibilidade, com olho. |
| J3 · S2 | "Salvar" baixa uma nova cópia a cada vez e não há estado "alterado" (`app-files.ts:18`). | Indicador salvo/alterado; "Salvar" no mesmo arquivo onde o navegador permitir, "Baixar cópia" nos outros. |
| J4 · S3 | Não há tela inicial: o app abre direto num desenho vazio (`boot.ts:37`). | Tela inicial com projetos recentes em cartões, Novo e Abrir. |
| J5 · S2 | Visibilidade só com 6 categorias; pilares e vigas somem com as paredes, escadas com os pisos, cotas e textos não têm controle (`geometry.ts:468`). | Categorias de modelo e de anotação separadas. |
| J6 · S3 | Colisão ligada por padrão e o objeto para sem dizer por quê (`collision.ts:113`). | Destacar o obstáculo e dizer junto ao cursor. |

## O que foi feito nesta rodada (nova interface)

Ver a seção "Implementado" no fim deste arquivo, atualizada a cada passo com o commit.

## Implementado

Conferido no app a 1920×1080, console sem erros. Capturas "depois" 11 a 14.

- **R1** (commit d3060bc): a aba "Colocar …" da ribbon só tem comandos; os campos do próximo elemento ficam no painel de
  Propriedades (`ribbon-tabs.ts`). Antes: captura 03; depois: 11.
- **C1, C2, R4**: o canto da vista tem só o cubo e a casa, sem cartão, meio transparente até o mouse chegar; Planta | 3D,
  pavimento e Navegador foram para a barra de título; a ribbon não repete Planta/3D (`shell.ts`, `styles.css`, `ribbon-tabs.ts`).
  Antes: 05; depois: 12 e 14.
- **B1, B2, B4**: a barra inferior do 3D mostra os interruptores só como ícones com dica; Estilo, Qualidade, Brilho e Sol estão num
  painel "Exibição", que fecha com Esc ou clique fora (`shell.ts`, `input-buttons.ts`, `styles.css`, `i18n.ts`). Depois: 12 e 13.
- **R5**: dica inicial "Comece pela ferramenta Parede, acima (W)".

Ainda não feito (próximos passos, nesta ordem): B3/B5 Visibilidade única; R2/R3 barra de ferramentas estável no lugar das abas;
M1/M2 menus de contexto completos; M3/M4 faixa de opções da ferramenta e etiqueta junto ao cursor; P1-P4 painel de Propriedades;
J1 biblioteca não modal; J2 navegador; J3/J4 salvar e tela inicial; M5-M9; J5, J6; R8.
