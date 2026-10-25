# Paredes, portas e janelas: o que as ferramentas de referência oferecem e o que falta no cad2

Pesquisa de 2026-10-25 (Revit, ArchiCAD, SketchUp, Vectorworks, Chief Architect, Floorplanner, Planner 5D,
Snaptrude, Rayon, Coohom, Arcol), comparada com o código do cad2 no commit 6346f33. Status: EXISTE,
PARCIAL, FALTA; prioridade só para PARCIAL e FALTA, pelo quanto o recurso é básico para desenhar uma casa.
Siglas: Rv Revit, AC ArchiCAD, SU SketchUp, VW Vectorworks, CA Chief Architect, FP Floorplanner, P5D
Planner 5D, ST Snaptrude, RY Rayon, CH Coohom, AR Arcol.

Resumo: 157 recursos; 71 existem, 26 em parte, 60 faltam. Forte: o motor de junções (L, T, X, nós,
alturas diferentes, prioridade de camadas), as regras de posição das aberturas, as cotas temporárias
editáveis, as guias, a entrada digitada. Falta mais: modificar (copiar, dividir, aparar, espelhar,
offset), retângulo de paredes, snaps de interseção/perpendicular/extensão/paralelo, a barra de espaço e
os controles de inverter no desenho, tipos e catálogo de portas e janelas, cotas permanentes.

Depois desta pesquisa entraram: Mover, Copiar, Girar, Espelhar e Escalar (a524e7c), o que muda 4.3, 4.4
(em parte: falta colar em outro pavimento), 4.6 e 4.7.

## Defeitos achados na leitura do código

1. Snap em parede em arco usa a corda (2.13): "Meio" e "Sobre a parede" caem fora do arco.
2. Trocar a linha de referência desloca o corpo da parede (4.18); no Revit, não.
3. Comprimento digitado no rodapé solta as juntas (4.11): usa updateWalls; a cota temporária usa stretchEnd.
4. Ctrl+Z no meio da cadeia (1.20): a parede some, mas a cadeia continua do ponto antigo.

### 1. Desenho de paredes

| # | Recurso | Status | Evidência no cad2 | Quem tem | Prior. | Nota de implementação (arquitetura do cad2) |
|---|---|---|---|---|---|---|
| 1.1 | Cadeia por cliques; Enter, Esc e botão direito terminam | EXISTE | wall-tool.ts:5-12; input.ts:269-296 | Rv (Chain), AC, SU, ST, RY | — | — |
| 1.2 | Fechar o contorno clicando no início | EXISTE | wall-tool.ts:87-88; snap.ts:92 | AC, SU, FP | — | — |
| 1.3 | Junta automática ao desenhar, e a prévia já mostra a junta real | EXISTE | join/discover.ts:14; app/geometry.ts:64-69 | Rv (Auto Join), VW, CA | — | — |
| 1.4 | Retângulo de paredes (2 cliques, ou "L;W" digitado) | FALTA | nenhum | Rv, AC, SU, VW (Rectangle mode), FP (Draw Room) | Alta | Estado `rect` em wall-tool.ts que emite 4 segmentos num só `addWalls`, um passo de desfazer. Sentido do desenho fixo para o lado externo ficar fora. |
| 1.5 | Retângulo girado (3 cliques) | FALTA | nenhum | AC, SU | Baixa | A mesma máquina, com a base dada por 2 pontos. |
| 1.6 | Polígono regular, círculo completo, elipse | FALTA | arco limitado a 340° (arc-edit.ts:8-9) | Rv (polígono só num trecho de busca, não verificado), AC (círculo = dois semicírculos) | Baixa | Círculo como dois arcos de 180°, como o AC faz. |
| 1.7 | Arco por início, fim e ponto de curvatura; raio digitado | EXISTE | wall-tool.ts:14-19, 108-134, 165-171 | Rv (Start-End-Radius), AC (Circumference) | — | — |
| 1.8 | Arco por centro e pontas | FALTA | nenhum | Rv (Center-ends), AC (Centerpoint & radius) | Média | Novo estado na máquina; o bulge sai do centro e das pontas. |
| 1.9 | Arco tangente à parede anterior, dentro da cadeia | FALTA | nenhum | Rv (Tangent End), AC (chained curved tangential) | Média | A direção do último segmento já existe no estado (`last`, `start`); bulge = f(tangente, corda). |
| 1.10 | Concordância (fillet) entre duas paredes | FALTA | nenhum | Rv (Fillet arc), AC (Fillet/Chamfer), CA (Make Arc Tangent) | Média | Ferramenta pura em src/tools: corta as duas pontas e insere o arco, num só comando. |
| 1.11 | Paredes sobre linhas existentes: guia, contorno de piso, contorno de cômodo (pick lines / varinha mágica) | FALTA | nenhum | Rv (Pick Lines), AC (Magic Wand), FP (Draw Room), ST | Média | Ação "Paredes ao redor deste cômodo/piso" a partir de `RoomSolid.outline` ou `Floor.source.points`; um clique sobre uma guia cria a parede nela. |
| 1.12 | Offset ao desenhar (distância entre a linha clicada e a de referência) | FALTA | nenhum; as guias cobrem parte do uso (guide-tool.ts) | Rv (Offset), VW (control line com offset) | Baixa | Campo `offset` em `WallDefaults`, aplicado em `makeWall` (app.ts:423-440). |
| 1.13 | Linha de referência: eixo, face externa, face interna | PARCIAL | schema.ts:7; shape.ts:26-35; fields.ts:27-31, 62-69. Faltam o eixo do núcleo e as faces do núcleo | Rv (6 opções), AC (6 em parede composta), VW (pelo núcleo) | Média | Acrescentar `coreCenter`, `coreExterior` e `coreInterior` em `exteriorOffset`, usando `coreLayersOf`. |
| 1.14 | Trocar lado ou linha de referência durante o desenho (Espaço, ou tecla) | FALTA | nenhuma tecla de Espaço em input.ts | Rv (Espaço inverte), AC ("C" alterna a linha), AutoCAD Arch. (Ctrl/Shift) | Alta | Evento `flip` em wall-tool.ts, que inverte o lado das camadas do trecho e da cadeia; ou alternar `defaults.referenceLine`. |
| 1.15 | Tipo, referência, base e topo da próxima parede no painel | EXISTE | fields.ts:172-216; panel.ts:140-144 | Rv (Options Bar), AC (Info Box), ST | — | — |
| 1.16 | Entrada digitada: comprimento, comprimento<ângulo (Tab), ponto x;y, expressões com mm/cm/m | EXISTE | core/measure.ts:1-36; `submitMeasure` em app.ts:590-669; input.ts:477-482 | Rv (listening dimensions), AC (Tracker), SU (Measurements box), VW (Data bar) | — | — |
| 1.17 | Coordenada relativa (Δx;Δy desde o último ponto); ângulo relativo à parede anterior | FALTA | `parsePoint` é absoluto (measure.ts:16-22) | SU (`<x,y>`), AC (Tracker relativo) | Média | Prefixo "@" no parser; a ferramenta recebe `from`. |
| 1.18 | Desenhar no 3D | PARCIAL | Desde 625af4e o ponto é o que se vê nas paredes e pisos do pavimento (`aimAt3d` em input.ts; `surfacePoint` em scene-3d.ts), com snap, eixo e medida no 3D (render/overlay-3d.ts). Ainda faltam no 3D: guias (`levelGuides`, só em planta), alças, cotas temporárias e pré-seleção (3.8, 3.9, 2.25) | Rv, AC (plano de edição), CA, ST | Média | Ver 2.25, 3.8 e 3.9. |
| 1.19 | Desenhar no pavimento de cima encaixando no de baixo, que aparece esmaecido | EXISTE | input.ts:134-146; `levelBelow` e `underlay` em app.ts:966-978 | Rv (underlay) | — | — |
| 1.20 | Desfazer o último trecho sem sair da cadeia | PARCIAL | Cada trecho é um passo (`wallEvent`, app.ts:585). Mas o Ctrl+Z apaga a parede e a cadeia continua do ponto antigo: `undo()` (app.ts:744-747) não mexe em `ui.wall`. Lido no código, não testado | AC (Backspace apaga o último segmento) | Alta | Backspace, ou Ctrl+Z com o estado `drawing`: desfaz e recua `last` para o início da parede desfeita. |
| 1.21 | Altura: topo no pé-direito do pavimento + offset, ou altura fixa; base com offset; valor do tipo com "voltar ao tipo" | EXISTE | document.ts:135-167; fields.ts:71-141; type-fields.ts | Rv, AC (Toplink), VW | — | — |
| 1.22 | Topo preso a outro pavimento ("até o Pavimento 2") | FALTA | `HeightRule` só aceita o próprio nível ou altura fixa (schema.ts:28) | Rv (Top Constraint), AC (Toplink a outro story), VW (preso ao story) | Média | `{kind:'level', levelId, offset}` com migração do arquivo para a versão 6. |

### 2. Auxílios de desenho, snaps e cotas

| # | Recurso | Status | Evidência no cad2 | Quem tem | Prior. | Nota de implementação |
|---|---|---|---|---|---|---|
| 2.1 | Extremidade, inclusive o canto do corpo de uma parede grossa | EXISTE | snap.ts:93-105 | Rv (SE), AC, SU, VW | — | — |
| 2.2 | Ponto médio | EXISTE | snap.ts:122-128 | Rv (SM), SU, VW, CA | — | — |
| 2.3 | Sobre a parede (ponto mais próximo, em passos de 5 cm) | EXISTE | snap.ts:147-158 | Rv (SN), SU (On Edge) | — | — |
| 2.4 | Face da parede | PARCIAL | Só na ferramenta Medir (input.ts:128-133); desenhando, o snap pega o eixo ou o corpo | SU (On Face), AC (surface snap) | Média | Passar as arestas das faces também à ferramenta de parede, abaixo da extremidade na prioridade. |
| 2.5 | Interseção de paredes fora das pontas | FALTA | Só há cruzamento de guias (snap.ts:106-117) | Rv (SI), SU, VW | Alta | Aplicar `lineCrossing` aos pares de segmentos perto do cursor. |
| 2.6 | Perpendicular (pé da perpendicular a partir do ponto atual) | PARCIAL | Só quando o raio de 15° já cai perpendicular (snap.ts:153-156) | Rv (SP), SU, AC (snap guides) | Alta | Com `from` definido, projetar `from` em cada segmento perto do cursor. |
| 2.7 | Extensão da linha de uma parede além da ponta | FALTA | nenhum | SU (Extend Edge), VW (extension lines), AC | Alta | Linha temporária a partir da ponta sob o cursor, ativada por pausa, como o VW. |
| 2.8 | Paralelo ou perpendicular a uma parede existente (ângulo relativo) | FALTA | O snap de ângulo é absoluto, em passos de 15° (snap.ts:129-141) | SU (Parallel), AC (Parallel/Perpendicular), VW (smart edges) | Alta | Incluir os ângulos das paredes próximas na lista de direções do snap de ângulo. |
| 2.9 | Alinhamento horizontal/vertical com pontas, com linha tracejada | EXISTE | snap.ts:172-190; plan-view.ts:702 | Rv (snap lines), SU (From Point), VW | — | — |
| 2.10 | Passos de ângulo (15°) e de grade (5 cm) | PARCIAL | Fixos (snap.ts:62-66); não mudam com o zoom nem com a preferência do usuário | Rv (incrementos por zoom, configuráveis) | Baixa | Tabela de passos escolhida pelo mpp. |
| 2.11 | Shift = ângulo reto | EXISTE | snap.ts:195-207 | AC, SU (Shift trava), RY | — | — |
| 2.12 | Origem | EXISTE | snap.ts:119 | SU | — | — |
| 2.13 | Snap em parede em arco: sobre o arco, centro, quadrantes, tangente | PARCIAL (defeito) | O arco entra no snap como corda: input.ts:145-146 passa `start/end`. "Meio" e "Sobre a parede" caem na corda, fora da parede. Lido no código, não testado | Rv (SC, SQ, ST), SU (Center, Arc Midpoint), VW, CA | Alta | Segmento do tipo 'arc' em `SnapInput`, ou os segmentos de `expandArc`. |
| 2.14 | Snap nos batentes e no centro de portas e janelas | FALTA | nenhum | (não pesquisado) | Baixa | Pontos de `OpeningFrame` como extremidades. |
| 2.15 | Guias paralelas a uma face, com distância digitada e persistentes | EXISTE | tools/guide-tool.ts; input.ts:560-581; elements/guide/* | SU (Tape Measure), AC (Guide Lines), Rv (planos de referência), ST (reference lines) | — | — |
| 2.16 | Guias com ângulo, por dois pontos, ponto-guia, guia em 3D, guia a partir de arco | FALTA | Só paralela a parede reta ou a outra guia (guide-tool.ts:42-67; arcos pulados em :47); só em planta (app.ts:518-521) | SU (Protractor, guide point), AC (Guide Line Segment, círculos, 3D) | Média | `Guide` já é ponto + direção; falta o gesto. |
| 2.17 | Ligar e desligar encaixes | PARCIAL | Só global, tecla S (app.ts:716-722) | Rv (por tipo; SE/SM/SI…), FP (segurar S), RY (segurar Ctrl) | Baixa | Segurar uma tecla para desligar temporariamente; opções por tipo de snap. |
| 2.18 | Tab percorre os candidatos de snap | FALTA | nenhum | Rv (Tab), AC (Espaço) | Média | `snap()` passa a devolver a lista ordenada de candidatos e o índice escolhido fica na UI. |
| 2.19 | Medida ao vivo do trecho (comprimento · ângulo) | EXISTE | app.ts:1092-1093; plan-view.ts:522-536 | Rv, SU, FP | — | — |
| 2.20 | Cotas temporárias até as paredes próximas durante o desenho (listening / Distance Guides) | PARCIAL | Só a porta ou janela sendo colocada mostra a cota até a face ao lado (opening-ui.ts:90-122). Para parede, só o comprimento | Rv, AC (Distance Guides), CA | Alta | Reaproveitar `gapDims` e `wallStops` com a parede da prévia (`PREVIEW_ID`). |
| 2.21 | Cotas temporárias da parede selecionada (comprimento, vão até a paralela), editáveis | EXISTE | temp-dims.ts:37-53, 181-237; app.ts:1257-1335 | Rv, CA (comprimento e parede paralela) | — | — |
| 2.22 | Cotas temporárias de porta e janela (até a face ao lado ou outra abertura), editáveis | EXISTE | temp-dims.ts:55-104 | Rv, VW (Offset insertion) | — | — |
| 2.23 | Cotas do arco (corda e raio), editáveis | EXISTE | temp-dims.ts:109-144 | Rv (raio por listening dims) | — | — |
| 2.24 | Escolher a referência da cota (face, eixo, núcleo) e arrastar a linha de chamada | FALTA | O comprimento é medido na linha de referência (temp-dims.ts:43-50) | Rv (Move Witness Line; ajustes de cota temporária), CA (superfície ou estrutura) | Média | `TempDim` com alternativas de referência e um clique para trocar. |
| 2.25 | Cotas temporárias no 3D e em seleção múltipla | FALTA | `placeDims` só em planta (app.ts:1139); só com um selecionado (temp-dims.ts:34) | AC (Tracker no 3D) | Baixa | Projetar com `toScreen` no 3D (app.ts:443-450). |
| 2.26 | Cotas permanentes associativas (alinhada, angular, raio, em cadeia), com trava e EQ | FALTA | Botão "Cota" desativado, "em breve" (`SOON` em shell.ts:11) | Rv, AC, CA, FP | Alta | Elemento novo src/elements/dimension com referências (wallId + face) e geometria derivada; EQ como regra. |
| 2.27 | Tornar permanente uma cota temporária | FALTA | nenhum | Rv | Média | Depende de 2.26. |
| 2.28 | Ferramenta Medir (distância, Δx, Δy, ângulo) | EXISTE | tools/measure-tool.ts; app.ts:569-575 | SU, FP, CA | — | — |

### 3. Feedback visual e cursores (2D e 3D)

| # | Recurso | Status | Evidência no cad2 | Quem tem | Prior. | Nota de implementação |
|---|---|---|---|---|---|---|
| 3.1 | Marca do snap com o nome ("Extremidade da parede 3") em planta | EXISTE | plan-view.ts:700-718; app.ts:1072-1088 | Rv, SU (ScreenTip), AC | — | — |
| 3.2 | Desenho diferente para cada tipo de snap (quadrado, triângulo, X…) | FALTA | Sempre um X (plan-view.ts:704-711) | Rv (formas por tipo), AC (formas do cursor), SU (marcadores) | Média | Mapa `SnapKind` → desenho em plan-view.ts e overlay-3d.ts. |
| 3.3 | Cursor próprio de cada ferramenta e estado (mira, lápis, mão sobre cota, + e − na seleção) | PARCIAL | Desde 625af4e: mira com o ícone da ferramenta (ui/cursors.ts, `toolCursor`). Faltam os cursores de estado: mover ou esticar sobre alça, + e − com Shift, mão sobre a cota, "proibido" quando a porta não cabe | AC (lápis, checkmark, mercedes), SU (lápis, transferidor, +/−), CA (mão sobre a cota) | Média | `toolCursor(tool, estado)` com o handle ou elemento sob o ponteiro. |
| 3.4 | Prévia da parede com espessura e junta real | EXISTE | app/geometry.ts:64-69; plan-view.ts:347-350 | Rv, AC | — | — |
| 3.5 | Linha de referência do trecho em desenho, tracejada | EXISTE | app.ts:1104; plan-view.ts:352 | AC | — | — |
| 3.6 | Mostrar a linha de referência das paredes existentes, com seta do sentido (liga/desliga) | FALTA | nenhum | AC (On-Screen View Options, com seta), Rv (pontos azuis sobre a linha de localização) | Alta | Camada no overlay de plan-view (start→end com seta); liga/desliga no navegador. |
| 3.7 | Indicador do lado externo e controle de inverter clicável na parede selecionada | FALTA | Inverter só pelo menu ou pela barra (context-actions.ts:36) | Rv (flip controls), CA (alça triangular de porta), FP | Alta | Handle `flip` novo em handles.ts, disparando `flipWalls`. |
| 3.8 | Pré-seleção ao passar o mouse | PARCIAL | Em planta sim (plan-view.ts:339-346); no 3D não, porque `scene.sync` não recebe o hover (app.ts:1135) | Rv, AC | Média | Passar `ui.hover` a `Scene3D.sync`, com material próprio. |
| 3.9 | Alças da seleção (pontas, setas de esticar, arco, girar) | PARCIAL | Em planta (handles.ts:32-61); nenhuma no 3D (app.ts:1343) | Rv (alças em 3D), FP (alças em 3D) | Média | Projetar as alças com `toScreen` no 3D. |
| 3.10 | Marca de snap, medida e ponto inicial no 3D | EXISTE | render/overlay-3d.ts, ligado em app.ts no commit 625af4e (não testado por mim) | Rv, AC, ST | — | — |
| 3.11 | Instrução no rodapé conforme o estado, com as teclas válidas | EXISTE | app.ts:1474-1549 | Rv (status bar), AC (Tracker) | — | — |
| 3.12 | Dica junto ao cursor com o elemento sob ele | PARCIAL | Há o nome do snap junto ao ponto e a etiqueta "Parede N" no hover (app.ts:362-377); não há dica de elemento | Rv (tooltip), AC (Info Tag) | Baixa | — |
| 3.13 | Prévia de porta ou janela com o motivo da recusa antes do clique, e a cota da regra | EXISTE | app.ts:245-249, 1511-1515; opening-ui.ts:90-122 | VW (prévia com handing indicators) | — | — |
| 3.14 | Elemento inválido na cor de aviso, com sinal "!" | EXISTE | plan-view.ts:585, 596-619; scene-3d.ts:261 | Rv (cor de alerta) | — | — |
| 3.15 | Pavimento de baixo esmaecido | EXISTE | app.ts:974-978; plan-view.ts:213-224 | Rv (underlay) | — | — |

### 4. Edição de paredes

| # | Recurso | Status | Evidência no cad2 | Quem tem | Prior. | Nota de implementação |
|---|---|---|---|---|---|---|
| 4.1 | Mover arrastando, mantendo as juntas; com Alt, a parede vai sozinha | EXISTE | select-drag.ts:149-157; tools/edit.ts:26-55 | Rv (ligadas vão juntas), AC | — | — |
| 4.2 | Mover pelo teclado (5 cm; 1 cm com Alt) | EXISTE | tools/nudge.ts:14-51; input.ts:583-587 | Rv, FP, RY | — | — |
| 4.3 | Mover com distância digitada, ou de um ponto base a um destino | PARCIAL | Só pelas cotas de vão (temp-dims.ts:221, 233); não há ferramenta Mover. Em andamento, não commitado: src/tools/modify-tool.ts e transform.ts (mover, copiar, girar, escalar, espelhar com ponto base e valor digitado). | Rv (Move), SU (VCB), CA (Point to Point Move), AR, ST | Alta | tools/move-tool.ts (base, destino, distância digitada) sobre `moveWalls`. |
| 4.4 | Copiar, duplicar e colar, inclusive em outro pavimento na mesma posição | FALTA | nenhum. Em andamento, não commitado: src/tools/modify-tool.ts e transform.ts (mover, copiar, girar, escalar, espelhar com ponto base e valor digitado). | Rv, AC (Ctrl ao arrastar), SU, FP (Ctrl+C/V entre andares), ST, AR (Alt) | Alta | Comando `copyElements(ids, delta, levelId)`: ids novos, regras de abertura e grupos remapeados. |
| 4.5 | Girar pela alça, em passos de 15° | EXISTE | select-drag.ts:198-203; tools/edit.ts:72-83 | Rv, AC | — | — |
| 4.6 | Girar com ângulo digitado e centro escolhido | FALTA | O centro é sempre o meio da caixa (handles.ts:50). Em andamento, não commitado: src/tools/modify-tool.ts e transform.ts (mover, copiar, girar, escalar, espelhar com ponto base e valor digitado). | Rv (centro arrastável, ângulo digitado), AC (Tracker), SU | Alta | rotate-tool: clique do centro, referência, ângulo digitado. |
| 4.7 | Espelhar (eixo escolhido ou desenhado, com cópia) | FALTA | nenhum. Em andamento, não commitado: src/tools/modify-tool.ts e transform.ts (mover, copiar, girar, escalar, espelhar com ponto base e valor digitado). | Rv (Pick/Draw Axis), AC, FP | Alta | `mirrorWalls`: espelha os pontos, inverte o bulge e troca start/end para manter o lado externo; aberturas como em flip.ts. |
| 4.8 | Matriz linear e polar | FALTA | nenhum | Rv (Array), AC (Multiply), SU ("3x"), ST | Média | Usa a cópia de 4.4. |
| 4.9 | Offset: cópia paralela a uma distância, também de uma cadeia | FALTA | nenhum; a guia só cria uma linha | Rv (OF), AC (Offset / Multiple Offset), SU (F) | Alta | `offsetWalls` com `faceOffsets`, medindo face a face. |
| 4.10 | Esticar a ponta: alça livre com snaps, ou seta ao longo da linha | EXISTE | select-drag.ts:158-171; tools/edit.ts:57-92 | Rv, AC (Stretch) | — | — |
| 4.11 | Comprimento digitado | PARCIAL | Pela cota temporária, as juntas se mantêm (temp-dims.ts:50). Pelo campo do rodapé, `submitMeasure` usa `updateWalls`, e as paredes ligadas na ponta não acompanham (app.ts:660-666). Lido no código, não testado | Rv, CA, RY | Média | Trocar app.ts:665 por `setWalls(stretchEnd(...))`. |
| 4.12 | Dividir parede (num ponto, ou com vão) | FALTA | nenhum | Rv (Split, Split with Gap), AC (Split), CA (Add Break), FP, CH | Alta | `splitWall`: duas paredes; aberturas reatribuídas pela estação, com a regra recalculada. |
| 4.13 | Unir paredes colineares | FALTA | nenhum | CH (duplo clique); o AC não une paredes | Média | Comando inverso de 4.12. |
| 4.14 | Aparar ou estender (até o canto, até um limite) | FALTA | Só à mão, levando a ponta até "Sobre a parede" | Rv (Trim/Extend), AC (Adjust, Intersect) | Alta | tools/trim.ts com `intersectLines` entre as linhas de referência. |
| 4.15 | Alinhar | PARCIAL | Paralelas: alinhar com a primeira e distribuir (arrange-walls.ts:35-62). Falta alinhar a uma face ou guia escolhida, com trava | Rv (AL, com cadeado), AC (Align), CH | Média | — |
| 4.16 | Inverter (camadas para o outro lado), mantendo as aberturas no lugar | EXISTE | elements/wall/flip.ts:40-56; context-menu.ts:46 | Rv, AC (Flip) | — | — |
| 4.17 | Trocar o tipo (busca com miniatura das camadas) | EXISTE | fields.ts:44-52 | Rv (Type Selector), VW | — | — |
| 4.18 | Trocar a linha de referência de uma parede sem movê-la | PARCIAL (defeito) | O corpo se desloca: shape.ts:26-35 recalcula a partir da mesma linha, e `updateWalls` só troca o campo (fields.ts:68). Lido no código, não testado | Rv (a parede não se move), AC (Edit Reference Line Location) | Alta | Comando `setReferenceLine` que desloca start/end pela diferença de offsets. |
| 4.19 | Curvar parede reta e endireitar arco | PARCIAL | A alça de curvatura só aparece em arcos (handles.ts:54); endireitar perto da corda existe (select-drag.ts:177) | AC (Curve/Straighten edge), FP (Curve) | Média | Mostrar o losango também na parede reta. |
| 4.20 | Raio do arco editável | EXISTE | fields.ts:147-157; temp-dims.ts:131-142 | Rv, CA | — | — |
| 4.21 | Editar tipos e camadas | EXISTE | ui/types-dialog.ts; ui/layer-editor.ts; elements/wall/types.ts | Rv, AC, VW | — | — |
| 4.22 | Topo e base presos a laje, telhado ou forro | FALTA | nenhum | Rv (Attach Top/Base), AC (Trim to Roof, Adjust to Slabs) | Média | Depende de lajes e telhados (pendencias.md:128). |
| 4.23 | Perfil da parede (empena), vão retangular na parede, frisos e rodapés, parede empilhada | FALTA | nenhum | Rv (Edit Profile, Wall Opening, Sweeps/Reveals, Stacked), AC (Complex Profile), VW (peaks) | Baixa | — |
| 4.24 | Parede inclinada, trapezoidal ou poligonal | FALTA | nenhum | Rv (Slanted/Tapered), AC, FP (altura por canto) | Baixa | — |
| 4.25 | Parede-cortina | FALTA | nenhum (pendencias.md:129) | Rv, AC, VW, CA | Baixa | — |
| 4.26 | Apagar levando as aberturas e reescrevendo as regras | EXISTE | elements/opening/commands.ts:74-109 | Rv, AC | — | — |

### 5. Junções

| # | Recurso | Status | Evidência no cad2 | Quem tem | Prior. | Nota de implementação |
|---|---|---|---|---|---|---|
| 5.1 | L automático: meia-esquadria no mesmo tipo, encontro camada por camada entre tipos | EXISTE | join/cut-l.ts:1-5 | Rv (butt, miter), AC (prioridade) | — | — |
| 5.2 | T por prioridade de camada, com entalhe | EXISTE | join/cut-t.ts:1-4; schema.ts:9-19 | Rv (prioridade por função), AC (prioridade do material) | — | — |
| 5.3 | X (cruzamento) | EXISTE | join/types.ts:48-54 | Rv, VW (X Join) | — | — |
| 5.4 | Nó de 3 e 4 pontas; com 5 ou mais, avisa | EXISTE | join/node.ts:1-5 | Rv (Wall Joins até 4) | — | — |
| 5.5 | Paredes de alturas diferentes | EXISTE | app/geometry.ts:147-204 | Rv, AC | — | — |
| 5.6 | Juntas com arcos | PARCIAL | Funcionam, com limites: falta o encontro camada por camada em arco e em nó (pendencias.md:111-114); avisa `arcJoinUnsupported` (join/types.ts:27-28) | Rv, AC | Baixa | — |
| 5.7 | Escolher a junta de cada canto: desligar, topo, meia-esquadria, corte reto, qual parede passa | FALTA | Especificado (wall-joins-spec.md §2.3), não implementado (pendencias.md:115) | Rv (Wall Joins, Disallow Join), VW (Wall Join tool), CA (Disable Auto Connect, Edit Wall Intersections) | Média | `WallJoinOverride` no Doc mais comando; `deriveJoins` lê o override. |
| 5.8 | Envolvimento de camadas nas pontas livres e nos vãos | FALTA | O vão corta reto todas as camadas (opening/void.ts:71-78) | Rv (Wrapping at Inserts/Ends), AC (Wall Closure), VW (wall closures) | Média | Cortes por camada em `OpeningCut`, como `layerCuts` em `EndCut`. |
| 5.9 | Prioridade editável, separada da função | FALTA | Fixa (schema.ts:13-19) | Rv 2026, AC (0–999) | Baixa | — |
| 5.10 | Linhas entre camadas e limpeza das juntas | EXISTE | geometry/seams.ts | Rv, AC | — | — |
| 5.11 | Avisos de junta no painel | EXISTE | ui/panel.ts:99-107; join/types.ts:24-32 | Rv | — | — |

### 6. Portas e janelas

| # | Recurso | Status | Evidência no cad2 | Quem tem | Prior. | Nota de implementação |
|---|---|---|---|---|---|---|
| 6.1 | Colocar na parede com prévia; regra pelo cursor (centro a 10 px, da face ao lado, de outra abertura, em passos de 5 cm) | EXISTE | tools/opening-tool.ts:16-21, 78-101; app/wall-stops.ts | Rv, AC, VW, ST | — | — |
| 6.2 | Distância digitada; Enter coloca; sem mouse (parede selecionada + D) | EXISTE | opening-tool.ts:112-124; app.ts:472-496, 642-645 | ST (distância da borda), VW (Enter Offset) | — | — |
| 6.3 | Recusa quando sobrepõe ou não cabe, com o motivo antes do clique | EXISTE | opening/commands.ts:13-17; app.ts:231-249 | — | — | — |
| 6.4 | Lado de abertura pelo lado do cursor | EXISTE | opening-tool.ts:36, 111 | Rv (face mais próxima), AC (setas), ST | — | — |
| 6.5 | Escolher a dobradiça (mão) ao colocar | FALTA | Sempre `start` (schema.ts:80; app.ts:230) | Rv (Espaço), AC (4 setas na tela), VW (handing indicators) | Alta | O quadrante do cursor em relação ao centro define `hinge`; Espaço alterna. |
| 6.6 | Inverter dobradiça e lado depois de colocar (menu, barra, painel) | EXISTE | context-menu.ts:48-49; opening/fields.ts:190-226 | Rv, CA, FP | — | — |
| 6.7 | Controles de inverter no próprio desenho, ou Espaço na seleção | FALTA | nenhum (pendencias.md:79) | Rv (flip controls; Espaço), CA (alça triangular), FP | Alta | Handles novos em handles.ts para aberturas. |
| 6.8 | "Abre para" com o nome do cômodo; dobradiça dita como vista desse lado | EXISTE | opening/sides.ts; opening/fields.ts:190-245 | — | — | — |
| 6.9 | Largura, altura, peitoril; tamanho da próxima no painel | EXISTE | opening/fields.ts:43-69, 313-320; schema.ts:68-71 | Rv, AC, FP, P5D | — | — |
| 6.10 | Altura da verga como campo; peitoril e verga ancorados ao pavimento | PARCIAL | A verga é derivada; existe "alinhar vergas" (commands.ts:207-231) | Rv (Head Height), AC (Sill/Header anchor) | Baixa | Campo `head` calculado, gravando o peitoril. |
| 6.11 | Tipos e catálogo: tamanhos padrão; folha dupla, de correr, pivotante, basculante, maxim-ar, fixa | FALTA | Só `kind` porta ou janela (schema.ts:7) | Rv (famílias), VW (swing, double, sliding, folding, pocket, barn), CA, SU 2025 (Live Components), FP | Alta | `OpeningType` no Doc, como `WallType`, com o tipo de folha; símbolo e 3D derivados do tipo. |
| 6.12 | Batente, guarnição, peitoril, verga e soleira, em planta e no 3D | FALTA | No 3D só uma placa de folha ou vidro (scene-3d.ts:251-264); na planta a janela tem 3 linhas (symbol.ts:14-17) | VW (Frame, Trim, Lintel, Threshold), AC (Casing, Sill, Board), CA | Média | Peças derivadas em elements/opening, ligadas ao tipo. |
| 6.13 | Camadas envolvendo o vão; posição da esquadria na espessura da parede | FALTA | void.ts:71-78 | AC (Reveal, Wall Closure), Rv, CA (Depth/Inset), VW | Média | Ver 5.8. |
| 6.14 | Porta aberta no 3D (ângulo) | FALTA | Folha fechada (scene-3d.ts:251-264) | CA (Swing Angle), VW, FP | Baixa | — |
| 6.15 | Arrastar ao longo da parede ou para outra parede | EXISTE | select-drag.ts:179-197 | Rv (Pick New Host), AC, VW | — | — |
| 6.16 | Regras de posição: do início ou do fim, centro, de outra abertura, alinhada com abertura de outra parede, em grupo | EXISTE | schema.ts:16-22; opening/fields.ts:72-183; derive.ts:150-178 | Rv (restrições e EQ), AC | — | — |
| 6.17 | Centralizar entre as paredes ao lado; alinhar vergas; distribuir (igual ou vão fixo) | EXISTE | opening/fields.ts:166-181; commands.ts:207-251 | CA (Center Object) | — | — |
| 6.18 | Copiar ao longo da parede; matriz de aberturas | FALTA | Distribuir só arruma as que já existem | ST (Copy ao longo da parede), Rv (Array), AC (Multiply) | Média | Usa a cópia de 4.4, com a regra `fromOpening`. |
| 6.19 | Avisos: sobreposição, fora da parede, alta demais, sobre junta, referência ruim | EXISTE | derive.ts:20, 186-209; app/geometry.ts:88-105 | — | — | — |
| 6.20 | Colisão de folhas de porta; área livre de passagem | FALTA | nenhum (pendencias.md:78) | AC (Minimal Space), Rv (só por terceiros) | Média | Derivado: o setor da folha (symbol.ts) contra outras folhas e paredes gera um aviso. |
| 6.21 | Etiquetas (P1, J1) | FALTA | nenhum (pendencias.md:203) | Rv (Tag on Placement), VW (ID Tag), AC (markers) | Média | — |
| 6.22 | Tabela de portas e janelas | FALTA | nenhum (pendencias.md:207) | Rv (Schedules), AC (Interactive Schedule) | Média | — |
| 6.23 | Em parede em arco | PARCIAL | Coloca e corta (void.ts:44-68). Sem cotas (temp-dims.ts:58); as setas não deslizam (nudge.ts:36); não alinha (commands.ts:180) | Rv, AC | Baixa | — |
| 6.24 | Colocar no 3D | EXISTE | No 6346f33 a mira caía no plano do piso; desde 625af4e usa o ponto visto na parede (`aimAt3d` em input.ts). Não testado por mim | Rv, AC | — | — |
| 6.25 | Vão sem porta (passagem), nicho, janela de canto, bay window | FALTA | nenhum | Rv (Wall Opening), CA (pass-through, canto, bay) | Média | `kind: 'opening'`, sem folha. |
| 6.26 | No 3D, a parede é cortada na altura certa | EXISTE | opening/void.ts:80-100 | Rv, AC | — | — |

### 7. Seleção e organização

| # | Recurso | Status | Evidência no cad2 | Quem tem | Prior. | Nota de implementação |
|---|---|---|---|---|---|---|
| 7.1 | Clique; Shift soma ou tira | EXISTE | select-drag.ts:97-107 | Rv, AC, SU, FP | — | — |
| 7.2 | Janela (→) e cruzamento (←), também no 3D | EXISTE | select-drag.ts:270-312 | Rv, SU, AC | — | — |
| 7.3 | Clicar de novo pega o elemento de baixo | EXISTE | input.ts:179-183, 321-329 | Rv/AC/RY (com Tab) | — | — |
| 7.4 | N e Shift+N percorrem os elementos | EXISTE | app.ts:684-702 | — | — | — |
| 7.5 | Ctrl+A: todas as paredes do pavimento | EXISTE | app.ts:672-678 | Rv, AC, SU, FP | — | — |
| 7.6 | Selecionar semelhantes (mesmo tipo) | PARCIAL | Só pelo navegador do projeto (browser.ts:66-72; app.ts:1391-1397) | Rv (Select All Instances), AC (Find & Select) | Média | Ação "Selecionar semelhantes" no menu de contexto. |
| 7.7 | Selecionar a cadeia de paredes ligadas | FALTA | nenhum | Rv (Tab), SU (triplo clique) | Média | Percorrer o `JoinGraph` (corners e nodes). |
| 7.8 | Filtrar uma seleção mista por categoria | FALTA | O painel mostra um tipo e avisa "parte de" (panel.ts:79-83) | Rv (Filter), FP | Baixa | — |
| 7.9 | Laço ou cerca | FALTA | nenhum (pendencias.md:168) | SU (Shift+Espaço), AC (polígono) | Baixa | — |
| 7.10 | Conjuntos de seleção salvos | FALTA | nenhum (pendencias.md:170) | AC | Baixa | — |
| 7.11 | Grupos de elementos | FALTA | Só grupos de aberturas (opening/schema.ts:38-49) | Rv, AC, FP | Baixa | — |
| 7.12 | Ocultar por categoria | EXISTE | browser.ts:58-62; app.ts:1377-1388 | SU (Tags), AC | — | — |
| 7.13 | Travar e isolar | FALTA | nenhum (pendencias.md:190-193) | FP (lock), Rv | Baixa | — |
| 7.14 | Painel editando vários de uma vez | EXISTE | ui/fields.ts; app.ts:1173 | Rv, AC | — | — |

### 8. Teclado, acessibilidade e desfazer

| # | Recurso | Status | Evidência no cad2 | Quem tem | Prior. | Nota de implementação |
|---|---|---|---|---|---|---|
| 8.1 | Atalhos de ferramenta, lista (?) e paleta de comandos bilíngue (Ctrl+K) | EXISTE | input.ts:629-650, 687-751; app/actions.ts | SU, FP, RY (Ctrl+K) | — | — |
| 8.2 | Esc cancela, Enter termina, botão direito termina | EXISTE | input.ts:269-296, 602-628 | Rv, AC, SU | — | — |
| 8.3 | Digitar um número vai ao campo de medida; Tab passa do comprimento ao ângulo | EXISTE | input.ts:477-482, 594-601 | Rv, VW (Tab) | — | — |
| 8.4 | Setas movem; Shift+setas e +/− mexem na vista | EXISTE | input.ts:553-587; view-keys.ts | FP, RY | — | — |
| 8.5 | Barra de espaço (inverter, girar ao colocar) | FALTA | nenhum | Rv | Alta | Ver 1.14, 6.5 e 6.7. |
| 8.6 | Atalhos de uma tecla que podem ser desligados ou remapeados (WCAG 2.1.4) | FALTA | Listener global em `window` (input.ts:523-650) | Exigência da WCAG 2.1.4 | Média | Preferência "atalhos de uma tecla" e mapa de teclas editável. |
| 8.7 | Alternativa a arrastar (WCAG 2.5.7) | PARCIAL | Mover (setas, cotas), esticar (cota) e arco (raio) têm alternativa; girar só arrastando | Exigência da WCAG 2.5.7 | Média | Ver 4.6. |
| 8.8 | Tamanho de alvo (WCAG 2.5.8) | PARCIAL | No toque, 44 px (select-drag.ts:75). No mouse, alcance de 8 px (alvo de ~16 px), abaixo de 24 px; a cota digitada serve de controle equivalente, mas girar não tem | Exigência da WCAG 2.5.8 | Baixa | — |
| 8.9 | Fluxo completo só com teclado | PARCIAL | pendencias.md:256-258 (K1 a K4 corrigidos, esperando reteste) | Exigência da WCAG 2.1.1 | Média | — |
| 8.10 | Foco visível | EXISTE | 4 regras `:focus-visible` em styles.css; não verificado na tela | Exigência da WCAG 2.4.7 | — | — |
| 8.11 | Regiões vivas (rodapé, avisos) | EXISTE | shell.ts: `toast` (role=status) e `instr` (aria-live) | — | — | — |
| 8.12 | Desfazer: um passo por comando, com o nome no aviso | EXISTE | core/store.ts:36-45; app.ts:744-752 | Rv, AC | — | — |
| 8.13 | Lista do histórico (desfazer até um ponto) | FALTA | nenhum | Rv (lista suspensa) | Baixa | `pastLabels` já existe no store. |
| 8.14 | Desfazer o último trecho da cadeia sem sair dela | PARCIAL | Ver 1.20 | AC (Backspace) | Alta | Ver 1.20. |
| 8.15 | Snap por tecla e Tab entre candidatos | FALTA | Ver 2.17 e 2.18 | Rv (SE, SM…; Tab) | Média | Ver 2.18. |

## As 25 prioridades

1. Snap em arco usando a corda (2.13), defeito. 2. Trocar a referência sem mover a parede (4.18),
defeito. 3. Desfazer o último trecho e continuar a cadeia (1.20). 4. Copiar/colar/duplicar, inclusive
entre pavimentos (4.4). 5. Mover/girar/espelhar com ponto-base e valor digitado (feito em a524e7c).
6. Dividir parede (4.12). 7. Aparar e estender (4.14). 8. Retângulo de paredes (1.4). 9. Offset (4.9).
10. Snaps de interseção, perpendicular e extensão (2.5-2.7). 11. Paralelo/perpendicular a paredes
existentes (2.8). 12. Barra de espaço: inverter ao desenhar, dobradiça e lado ao colocar a porta
(1.14, 6.5, 8.5). 13. Controles de inverter clicáveis e lado externo indicado (3.7, 6.7). 14. Linha de
referência com seta (3.6). 15. Cotas até as paredes próximas ao desenhar (2.20). 16. Tipos e catálogo
de portas e janelas (6.11). 17. Cotas permanentes associativas (2.26). 18. Comprimento digitado mantendo
as juntas (4.11), defeito. 19. Referência da cota temporária: face, eixo, núcleo (2.24). 20. Batente,
guarnição, peitoril, camadas envolvendo o vão (6.12, 6.13, 5.8). 21. Tipo de junta por canto (5.7).
22. Vão sem porta (6.25). 23. Colisão de folhas de porta (6.20). 24. Seleção em cadeia e semelhantes
(7.7, 7.6). 25. Matriz, e copiar aberturas ao longo da parede (4.8, 6.18).

## Fontes

Revit (help.autodesk.com):
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-05BAFEAA-5186-484E-80F4-8D900C454748.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-F26DB6DA-A0EC-424D-B656-3BDF47607F4F.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-4042EE5F-6E2D-4DD3-BCC6-91103246EED1.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Customize/files/GUID-3C6FDBDC-8FCC-4CEA-A887-C1FDD189D81C.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Customize/files/GUID-A3947840-1F30-41D7-AF75-B61687952A07.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Customize/files/GUID-9AAFFC5A-F360-4FA6-8831-F764BE36BA08.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-74FFB00B-FB29-44B7-8FEA-613DBE010AD4.htm
- https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-DE82A2B9-0129-4D03-BC47-17A52BD4E168.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-805557AB-CB88-4AD6-9753-4CEBD0FB2C78.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Customize/files/GUID-0C635A25-161D-4756-A3D1-C564079A1965.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-84FFE118-6EF7-4747-8DF7-AE675818645E.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-0CCBFE40-9F0C-4869-BC4E-76E0A8E7BF67.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-42AA53C5-7BC2-403D-9675-5F41C24212BC.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-40DAA2D0-9797-4937-AE6B-51EC92D599BC.htm
- https://help.autodesk.com/cloudhelp/2023/ENU/Revit-Model/files/GUID-17697733-43F6-4A80-8D0D-0526823ABEA0.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-D9AB5E1D-2D76-4D92-8000-24B78AAF09CC.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-9C867721-1970-4ECC-90F1-3C112B9EC2E6.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-7D416FFB-36A2-4B98-95D1-0A007DCD51CE.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-DF735D0A-A051-43C0-B21B-E8F6CBAFD5C3.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-9C25D11A-C4D3-4B0A-9793-45E82464840A.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-B902060A-E2B1-4E20-A073-4A19BA3B3A14.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-905CCD0D-8DE0-454D-B65A-F03DA2E1F7F8.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-ED60CE62-B955-45E9-9D7D-00F1552D858C.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-ED2045E5-90BF-418F-AAD6-3BB1544F34F5.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-F3B8DD5E-5380-45C1-B0D6-E6B081224E63.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-DE386617-D2BB-4F71-96B1-51D157DAEAA7.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-54122AE4-F009-42FB-8670-D665598A5A46.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-CC9640A1-199E-49E3-A036-01B960CD2B78.htm
- https://help.autodesk.com/cloudhelp/2025/ENU/Revit-ArchDesign/files/GUID-BBC16AF1-88C1-4B2E-A23A-917C3F427E97.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-BBD3A057-E79F-43CB-A388-95625C0E1096.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-BC422403-C03D-4292-AD8B-D578EC0659D1.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-57DC0275-79A9-4F31-9664-3CFD862F32A1.htm
- https://help.autodesk.com/cloudhelp/2025/ENU/Revit-GetStarted/files/GUID-A9AABE14-D963-46A4-AB74-CDDD336575DA.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-GetStarted/files/GUID-564F9709-24F3-4E76-842A-1A3CAA3B50E9.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-6B18982C-1FBA-4E5C-AE30-6FAE4022CE35.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-19EAF7A9-331F-4271-94CC-43B76B13011E.htm
- https://help.autodesk.com/cloudhelp/2025/ENU/Revit-ArchDesign/files/GUID-10DB1268-CA74-4620-8A1B-AF412BCD36D6.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-C6A3DD86-FFAF-4781-8E50-5714965C24BE.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-1CCD1005-CBDA-4338-8D60-489095D4BB25.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-WhatsNew/files/GUID-50F25D06-C5CD-42B9-A766-CAABD3F2FA91.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-7E952007-8A5A-4693-8E0F-A847F72F7617.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-3B7BAC64-6120-4372-A29E-95C4A1D853F5.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-GetStarted/files/GUID-0B88E1B2-37D2-4008-A2B4-50C35F1DB147.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-99DE7F11-3B8D-4CD2-ADC1-3359D4FC2BF1.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-987D9F47-E4C7-4213-8ABE-F61D8CC56D6A.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-D317147A-AC24-4983-A578-55F074FDF64A.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-6D4DBBDA-3611-40CD-9A45-BE40EB07188A.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-GetStarted/files/GUID-2BCBE79A-BB10-4447-B4ED-BA85395E2649.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-GetStarted/files/GUID-86A50B39-334D-4EE2-B2B8-F28DC6C2D26C.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-GetStarted/files/GUID-71F54593-506C-4068-89BC-3385D5576F02.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-GetStarted/files/GUID-9EA7771F-1024-4FFC-A5F8-245B4DA494F2.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-52612B0F-43AA-47AF-A76C-BB0E3DD24E34.htm
- https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-BAB2E354-D036-4B8D-AD69-74597D7EFA88.htm
- https://kinship.io/blog/clearance-zones-in-revit

ArchiCAD 28/29 (help.graphisoft.com):
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-7.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-9.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-10.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-11.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-19.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-272.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-306.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-310.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-17.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-30.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/030_Interaction/030_Interaction-40.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/030_Interaction/030_Interaction-46.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/030_Interaction/030_Interaction-47.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/030_Interaction/030_Interaction-53.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/030_Interaction/030_Interaction-58.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/030_Interaction/030_Interaction-65.htm
- https://help.graphisoft.com/AC/28/INT/_AC28_Help/070_Documentation/070_Documentation-124.htm
- https://help.graphisoft.com/AC/29/INT/_AC29_Help/030_Interaction/030_Interaction-39.htm
- https://help.graphisoft.com/AC/29/INT/_AC29_Help/030_Interaction/030_Interaction-72.htm
- https://help.graphisoft.com/AC/29/INT/_AC29_Help/030_Interaction/030_Interaction-75.htm
- https://help.graphisoft.com/AC/29/INT/_AC29_Help/030_Interaction/030_Interaction-76.htm
- https://help.graphisoft.com/AC/29/INT/_AC29_Help/030_Interaction/030_Interaction-77.htm
- https://help.graphisoft.com/AC/29/INT/_AC29_Help/030_Interaction/030_Interaction-85.htm
- https://help.graphisoft.com/AC/29/INT/_AC29_Help/030_Interaction/030_Interaction-86.htm
- https://help.graphisoft.com/AC/29/INT/_AC29_Help/030_Interaction/030_Interaction-88.htm
- https://help.graphisoft.com/AC/29/INT/_AC29_Help/030_Interaction/030_Interaction-92.htm
- https://help.graphisoft.com/AC/29/INT/_AC29_Help/030_Interaction/030_Interaction-96.htm
- https://help.graphisoft.com/AC/29/INT/_AC29_Help/030_Interaction/030_Interaction-28.htm

SketchUp:
- https://help.sketchup.com/en/sketchup/introducing-drawing-basics-and-concepts
- https://help.sketchup.com/en/using-guides
- https://help.sketchup.com/using-measurements-box
- https://help.sketchup.com/en/sketchup/moving-entities-around
- https://help.sketchup.com/en/sketchup/drawing-basic-shapes
- https://help.sketchup.com/en/sketchup/offsetting-line-existing-geometry
- https://help.sketchup.com/en/sketchup/selecting-geometry
- https://help.sketchup.com/sketchup/creating-basic-component
- https://help.sketchup.com/en/default-keyboard-shortcuts
- https://sketchup.trimble.com/en/blog/article/sketchup-2025-tell-a-richer-story-with-visuals-that-pop
- https://help.sketchup.com/release-notes/sketchup-desktop-20260

Vectorworks:
- https://app-help.vectorworks.net/2025/eng/VW2025_Guide/Walls/Creating_walls.htm
- https://app-help.vectorworks.net/2025/eng/VW2025_Guide/Walls/Standard_wall_preferences.htm
- https://app-help.vectorworks.net/2024/eng/VW2024_Guide/Walls_edit/Joining%20walls.htm
- https://app-help.vectorworks.net/2025/eng/VW2025_Guide/Walls/Concept__Wall_closures.htm
- https://app-help.vectorworks.net/2024/eng/VW2024_Guide/Symbols/Offset_symbol_insertion_mode.htm
- https://app-help.vectorworks.net/2025/eng/VW2025_Guide/Doors/Door_settings.htm
- https://app-help.vectorworks.net/2025/eng/VW2025_Guide/Windows/Inserting_windows.htm
- https://app-help.vectorworks.net/2025/eng/VW2025_Guide/Basic2/Snapping_to_a_smart_edge.htm
- https://app-help.vectorworks.net/2025/eng/VW2025_Guide/Basic1/Data_bar_options.htm

Chief Architect:
- https://chiefarchitect.com/products/features
- https://chiefarchitect.com/support/article/KB-01116/moving-walls-using-dimensions.html
- https://www.chiefarchitect.com/support/article/KB-00692/drawing-a-curved-wall-that-is-tangent-to-two-straight-walls.pdf
- https://chiefarchitect.com/support/article/KB-00033/adjusting-wall-connections.html
- https://www.chiefarchitect.com/support/article/KB-00615/changing-a-door-s-hinge-and-swing-sides.html
- https://chiefarchitect.com/support/article/KB-00418/controlling-the-offset-or-depth-of-a-door-or-window.html
- https://www.chiefarchitect.com/support/article/KB-00734/using-the-point-to-point-move-tool.html
- https://chiefarchitect.com/support/category/32/doors.html

Planejadores web e BIM no navegador:
- https://fpcdn.s3.us-east-1.amazonaws.com/static/brochures/Floorplanner-editor-manual-04-2025.pdf
- https://support.planner5d.com/en/articles/5876845-changing-dimensions-web
- https://www.coohom.com/helpcenter/floor-plan-wall-editing-tips-split,-merge,-and-align
- https://help.snaptrude.com/en/articles/9091066-walls
- https://help.snaptrude.com/en/articles/9040869-placing-and-editing-doors-and-windows-in-a-project
- https://help.snaptrude.com/en/articles/11059692-copy-array-tool
- https://intercom.help/arcol/en/articles/10447851-move-copy-tool
- https://docs.rayon.design/documentation/design/walls
- https://docs.rayon.design/documentation/design/shortcuts
- https://help.autodesk.com/cloudhelp/2016/ENU/AutoCAD-Architecture/files/GUID-15BF3ACD-953C-47CB-B405-8D4C6733635A.htm

Acessibilidade:
- https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html
- https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html
- https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/

Limites: as ajudas oficiais foram lidas por um resumidor (citações próximas, não exatas). Não
confirmados: o polígono inscrito/circunscrito do Revit; se os controles de inverter do Revit ficam sempre
do lado externo; o sentido da janela de seleção no ArchiCAD. HomeByMe, Roomle e Homestyler não cobertos.
