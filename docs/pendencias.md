# O que falta

Lista viva do que ainda não está feito, com a origem de cada item. Um item sai daqui quando o commit que
o resolve existe e, se for de interface, quando a sessão de teste o viu no navegador.

## Teste com gestos de 2026-10-25 (Playwright headless, 1920×1080, 1024×768, 390×844)

Corrigidos nesta rodada (não commitados): barra flutuante agindo sobre o elemento selecionado antes;
alça de girar sobre a seta de esticar em parede vertical; barra no lugar velho depois do cubo 3D;
paredes 3D escuras no tema escuro; prévia de camadas no terço do meio; "Caminhar" cortado; anel do
tour fora da tela; "Fechar" dos atalhos fora da tela; rótulo "Início · fecha" velho; cômodo novo sem
seleção nem aviso; piso por contorno sem encaixe nem cota; clique de novo para chegar ao piso sob o
cômodo; prévia vermelha logo depois de colocar porta/janela; nome do projeto editável (arquivo e aba
com o nome); textos (dica vazia, rodapé de cômodo/piso, seleção mista, maiúscula depois de dois-pontos,
N e Shift+N); duração dos avisos; aviso ao ligar/desligar encaixes; coordenadas velhas depois de Home/F.

Segunda rodada (mesmo dia), também vistos no navegador:
- Faces de corte no 3D: só as faces à mostra dos blocos são desenhadas (faces.ts ligado ao 3D, com
  teste); sumiram os pontinhos claros nas paredes. O `npm run typecheck` voltou a passar.
- Arco saindo do canto externo de um L: junta sem aviso (nó de 3 pontas, encaixe por fora do canto,
  com teste); e a ponta de uma parede grossa encaixa também pelo seu canto externo (teste do encaixe).
- Pavimento de cima mostra o de baixo, claro, e encaixa nas paredes dele.
- Dois cômodos no mesmo espaço: aviso na etiqueta e no painel (com teste).
- Celular: a dica do rodapé em até três linhas.
- "Desfeito: Apagar" / "Refeito: …": o aviso diz o que foi desfeito (o histórico guarda o nome).

Terceira rodada (mesmo dia, Chrome visível, projeto "Casa Jardim" montado com gestos), vistos no navegador:
- Encaixe na origem e nos eixos (o primeiro clique a 3 px do cruzamento ficava 5 cm fora).
- Parede terminada sobre outra seguindo o ângulo travado (a divisória saía a 90,3°), e o ponto sobre
  a parede em passos de 5 cm; o corpo desenhado da parede (não só o eixo) conta para o encaixe.
- Portas e janelas medidas da face da parede ao lado (wall-stops.ts): na colocação, nas cotas
  temporárias e no painel ("Da parede no início/fim"); antes media da ponta de uma parede de 10 m.
- Arrastar porta ou janela: desliza pela parede ou passa para outra (antes nada se movia).
- "Abre para" com o nome do cômodo de cada lado ("Sala e cozinha" | "Lado de fora").
- Triângulo do grupo de ferramentas abre o submenu com um clique.
- Botões só de texto quebram em duas linhas em vez de vazar.
- Canto entre tipos diferentes (wall-joins-spec.md, entrega 6).
- Arrastar um cômodo move o ponto dele (para outro espaço, se soltar lá); um piso por contorno, o
  contorno. Alt ao arrastar paredes: elas vão sozinhas, sem levar as juntas (não testado com gesto:
  a ferramenta de teste não segura Alt durante o arraste; coberto só pela leitura do código).

- Altura da parede em leitura sob "Ajuste do topo" quando o topo é o pé-direito.
- Dobradiça "Esquerda / Direita" vista do lado para onde a porta abre, com a nota de onde se olha;
  a medida da posição diz "Parede à esquerda / à direita / acima / abaixo" (planta sempre com o norte
  para cima), e não início/fim do desenho.
- "Centralizar entre as paredes ao lado": a janela no meio do trecho do próprio cômodo.

- Ferramenta Medir (M; antes "em breve"): dois cliques dão a distância, as projeções e o ângulo; encaixa
  nas faces e nos cantos das paredes ("Na face da parede", "Canto"), não só nos eixos. A Cota continua
  "em breve" (cotas permanentes, item do Adendo 2).

- Paredes paralelas selecionadas juntas: "Alinhar com a primeira selecionada" e "Distribuir com espaços
  iguais" (as das pontas ficam), com as juntas mantidas como num arraste.

- A cota de comprimento da parede vai para o lado sem paredes encostadas (antes a etiqueta cobria a
  ponta de um T); a cota da porta ou janela sendo colocada é desenhada como as temporárias, com
  chamadas e marcas, colada à face oposta à folha.

- Ao arrastar a ponta de uma parede, o encaixe aparece como ao desenhar ("Sobre a parede 5"); girar e
  esticar dizem "Shift mantém reto, Esc cancela" (o Alt só vale para mover).

- Botão direito termina o que está em andamento (sequência de paredes, contorno de piso, fita de medir,
  arraste) antes de abrir menu, como no Revit e no AutoCAD.
- Cotas inteligentes: uma parede selecionada mostra o vão livre até a parede paralela mais próxima de
  cada lado; digitar o vão move a parede (juntas mantidas). As cotas seguem o arraste de uma parede.

- Guias (linhas de construção, como as do SketchUp e os planos de referência do Revit): Alt sobre uma
  parede reta (ou outra guia) nas ferramentas de parede, piso e medir cria uma guia paralela, medida da
  face do lado do ponteiro (o vão livre). Segurando o Alt, arrastar e soltar fixa; um toque no Alt deixa
  a guia seguindo até um clique, Enter ou uma distância digitada; Esc cancela. O desenho se prende à
  guia e aos cruzamentos dela com paredes e outras guias (com Shift também). As guias ficam no
  documento (versão 5 do arquivo): desfazer, salvar, selecionar, mover (arraste e setas), Del, "Apagar
  as guias deste pavimento" (menu, paleta, painel) e a camada "Guias" no navegador do projeto.
  Só em planta. Não verificado: se o Chrome real deixa de focar o menu dele ao soltar o Alt sozinho
  (o preventDefault foi posto; o Playwright injeta as teclas por fora do menu do navegador).

- Desenho em 3D: o ponto das ferramentas de desenho e da mira de portas/janelas é o que se vê sob o
  ponteiro nas paredes, portas, janelas e pisos do pavimento em edição (e do de baixo), não o chão atrás
  delas: clicar no topo da ponta de uma parede pega a ponta e une. Sobre o 3D aparecem o marcador do
  encaixe com o nome ("Extremidade da parede 2"), uma linha subindo a altura do pavimento, o eixo do
  trecho com o comprimento e o ângulo, o início e o contorno de piso. Cada ferramenta tem o seu cursor
  (mira com o ícone dela), na planta e no 3D.

- Vista 3D com controle dos pavimentos (barra no topo do 3D, com ícones e rótulos, e na paleta): mostrar
  todos, o pavimento em edição e os de baixo, ou só ele (como Sweet Home 3D e o Floor Overview do Chief
  Architect); explodir (cada pavimento sobe 2,5 m além do de baixo, só na vista, como o Displace
  Elements do Revit); cortar na altura de corte da planta do pavimento em edição, com as paredes
  cortadas preenchidas (poché) pelas mesmas peças que a planta desenha. Estado de interface, guardado
  nas preferências. Seleção, desenho, a barra flutuante e a seleção por janela acompanham o
  deslocamento dos pavimentos explodidos.
- Seleção na planta com tolerância de 6 px para paredes, portas e janelas, e porta/janela pela folha e
  pelo arco. Barra de ferramentas sem grupos: parede, piso, porta e janela com botão e ícone próprios.
  Alt (arrastar sem as paredes unidas) dito no rodapé antes do arraste; Esc cancela o arraste com Alt.

- Modificar (como o painel Modificar do Revit e Move/Rotate/Scale do SketchUp): Mover (Shift+M), Copiar
  (Shift+C), Girar (Shift+R), Espelhar (Shift+X) e Escalar (Shift+E), na barra superior (cada um
  com o seu ícone), na paleta, e Mover no menu e na barra flutuante. Ponto-base e destino com encaixes
  (ângulos de 15° e Shift a partir da base), ou valor digitado (distância, graus, fator); Enter usa o
  centro da seleção como centro do giro, da escala ou do espelho; C liga/desliga a cópia (Espelhar já
  copia, como no Revit); Esc volta um passo. Prévia ao vivo da seleção inteira, cópias incluídas. Levam
  as paredes com portas, janelas e grupos, os cômodos cujas paredes vão juntas, pisos de contorno e
  guias; no lugar, as paredes unidas mantêm as juntas; espelhada, cada parede troca as pontas (camadas e
  dobradiças espelhadas); escalada, espessuras e tamanhos de porta e janela ficam.

- Defeitos achados pela pesquisa (docs/pesquisa/paredes-portas-janelas.md), corrigidos: o snap em
  parede em arco pegava a corda (agora o meio do arco, o pé no arco em passos de 5 cm, e o ângulo de
  15° cortando o arco); trocar a linha de referência deslocava o corpo da parede (agora o corpo fica e
  a linha vai à face, como no Revit e no ArchiCAD; as unidas acompanham); o comprimento digitado no
  rodapé soltava as juntas (agora como a cota temporária); Ctrl+Z no meio da cadeia deixava a cadeia no
  ponto antigo (agora desfaz o trecho e segue do início dele; Backspace faz o mesmo, como no ArchiCAD).

- Linha de referência na planta (como o ArchiCAD mostra): nas paredes selecionadas e na que está sendo
  desenhada, a linha por onde a parede é desenhada (eixo, face externa ou interna), com um ponto no
  início e uma seta no sentido (o lado externo fica à direita do sentido); de todas as paredes, pela
  opção "Linhas de referência" no navegador do projeto ou na paleta. Espaço, desenhando paredes, põe o
  corpo do outro lado da linha (como no Revit), dito no rodapé.

- Retângulo de paredes (Q na ferramenta de parede, ou a paleta): um canto e o oposto, ou os lados
  digitados como largura;profundidade (para o lado do cursor); quatro paredes num só passo de desfazer,
  no sentido anti-horário para o lado externo ficar para fora; prévia com as juntas e a medida "L × P".

- Encaixes novos: interseção das linhas de duas paredes (inclusive onde se encontrariam se fossem
  prolongadas), perpendicular a uma parede a partir do último ponto, extensão da linha de uma parede além
  da ponta (até 8 m, com a tracejada saindo da ponta) e paralela/perpendicular a uma parede inclinada ao
  desenhar; cada um com o nome da parede no rótulo.

- Dividir (Shift+S), Unir (Shift+J) e Canto (Shift+T), como Split, juntar paredes e Trim/Extend to
  Corner do Revit: Dividir corta a parede onde se clica (o meio encaixa; arco vira dois arcos), recusa
  passar por porta ou janela e parte menor que 5 cm, e as portas e janelas ficam onde estavam (cada uma
  na parte em que está); a parte nova vem depois das outras paredes, que mantêm os números. Unir junta
  duas paredes retas em linha, ponta com ponta, do mesmo tipo, linha de referência e altura (menu,
  barra flutuante e paleta). Canto: clique numa parede e na outra, e as duas vão até onde as linhas se
  cruzam; Esc solta a primeira, outro Esc sai.

- Barra superior com as ferramentas de edição (pedido: "essas ferramentas deveriam ficar na barra
  superior e não na barra de ferramentas lateral"): Mover, Copiar, Girar, Espelhar, Escalar | Dividir,
  Canto | Medir, Cota, ao lado de desfazer e refazer, como a aba Modificar do Revit e as barras do
  SketchUp e do ArchiCAD; a barra lateral fica com o que desenha. O que não cabe vai, do fim para o
  começo, para o botão "Mais ferramentas" (…), um menu com ícone, nome e tecla, marcado quando a
  ferramenta em uso está nele; no celular as ferramentas vão para a segunda linha, ao lado do pavimento
  e das vistas. O tour ganhou a parada "Editar".

Quarta rodada (2026-10-25, Chrome visível pelo Playwright, 1920×1080, 1280, 1024, 768 e 390 px; um
anexo desenhado na Casa Jardim com gestos imprecisos), corrigidos e vistos no navegador (95fc9aa, d774353):
- Parede continuada a partir de um canto existente, em linha com uma das paredes mas no sentido contrário:
  "Paredes demais num mesmo ponto" e a parede de topo sobreposta às duas; agora T limpo (spec §7.4).
- Duas paredes desenhadas até o eixo de uma terceira, uma de cada lado: viravam um L atravessando o corpo
  dela, sem aviso; agora dois T (spec §6).
- Medir: a fita pegava a linha entre reboco e núcleo (4,38 m num quarto de 4,35 m) e o eixo da parede do
  outro lado (4,43 m); agora o contorno das paredes e o pé perpendicular mais perto.
- Dividir: clique no vazio alinhado com a ponta de uma parede ia para ela ("perto demais da ponta").
- Dividir, Canto e Unir dizem no rodapé o que fizeram; etiquetas de cômodo saem de baixo das linhas das
  cotas temporárias; rodapé esconde primeiro as teclas para a dica caber (1280 px); no 3D diz como girar;
  A e Q dizem o que fazem agora; botão do painel em tela estreita mostra o que está na tela e abre o painel
  sem seleção; barra superior dobra os botões da direita num menu (☰); apagar pavimento impossível mostra o
  motivo ao passar o mouse; atalhos mais largos; "Próxima porta/janela" com o texto certo; W, Q na paleta.

Achados desta rodada ainda abertos (os cinco primeiros foram resolvidos na quinta rodada, abaixo):
- A passagem entre uma parede desenhada no sentido horário e a vizinha mostra a linha entre os acabamentos.
- Não verificado: a barra superior com emulação de toque (botões de 44 px).

Quinta rodada (2026-10-25, Chrome visível pelo Playwright, 1920×1080 e 390×844; a Casa Jardim com
gestos de mão que desviam), corrigidos e vistos no navegador (120ad2e a 609d09c):
- Arrastar a divisória entre os quartos com a mão desviando 5 mm ao longo dela soltava a ponta da parede
  externa e os dois quartos viravam um. Agora a ponta de uma parede movida ou girada que encosta no meio de
  outra (T) desliza pela própria linha e fica nela (Alt ainda move sozinha).
- Mover ou girar paredes mantém as linhas das paredes unidas, como no Revit: o canto com uma parede que
  ficou vai para o cruzamento das linhas. Antes, o Mover com o ponto-base no meio de uma parede e o destino
  11 px abaixo entortava o contorno inteiro da casa. (O teste de edit.ts que esperava o canto inclinado
  passou a esperar o canto reto.)
- Mover (Shift+M) ganhou "U desunir", o Desunir do Revit: as paredes vão sozinhas e as juntas se abrem.
- Janelas e portas medidas da face de uma parede ao lado eram guardadas como distância da ponta da própria
  parede: quando outra parede esticava essa ponta, a janela do Quarto 1 andava 0,5 m. Depois de qualquer
  mudança nas paredes, cada uma mantém a folga até a face de onde é medida (keep-openings.ts). Uma porta
  medida da divisória acompanha a divisória quando ela se move, em vez de ficar com a parede no vão.
- Um cômodo cujo ponto ficou do outro lado de uma parede movida passava a dividir o espaço com o vizinho e o
  resto ficava sem cômodo. Agora ele fica no que sobrou do seu espaço (ao vivo durante o arraste também).
  A etiqueta com aviso longo demais mostra um aviso curto ("Mesmo espaço que 2") em vez de um número laranja.
- Paredes sobrepostas ao longo de um trecho (copiar no mesmo lugar) dão aviso, e o painel diz com qual.
- 3D: um chão sob o modelo, que some no fundo; cômodo sem piso mostra o chão, não um buraco preto.
- Explodir com um pavimento só à vista fica apagado e diz por quê; a mensagem some quando a vista muda.
- Ferramenta Cômodo: o espaço fechado sem cômodo sob o ponteiro aparece antes do clique, com a área.
- Contorno fechado no sentido horário avisa que a face externa ficou para dentro e como inverter; o encaixe
  de ângulo pega até 5° (uma parede à mão, 13 px fora do nível em 190 px, saía a 4°).
- Apagar diz quantos elementos saíram e que Ctrl+Z traz de volta.
- Etiquetas de cômodo não se afastam do cômodo ao fugir das cotas; etiquetas de parede saem de cima das de
  cômodo; diálogos abrem presos no alto (o de tipos pulava ao ganhar uma camada).
- Vistos funcionando: arrastar parede, alça de ponta, alça de girar, deslizar porta, Esc cancelando arraste,
  piso por contorno, parede no 3D com comprimento digitado, N e Shift+N, desfazer e refazer, tema no 3D,
  cota temporária digitada, copiar.

Sexta rodada (2026-10-26, junções de paredes, Chrome visível pelo Playwright, 1920×1080), corrigido e visto
no navegador (44527ab, 1439550): as junções de várias paredes num ponto (wall-joins-spec.md, entrega 7) e o
encaixe (S): ele desligava, mas o rodapé não dizia isso ao desenhar e a escolha voltava a "sim" ao
recarregar. Agora o rodapé diz "encaixes: sim/não" em parede, retângulo, piso, medir e modificar, e a
escolha é guardada.

Achados da quinta rodada ainda abertos:
- Num cômodo muito pequeno (0,75 m) a etiqueta, empurrada para baixo da cota, fica sobre a parede.
- A alça de girar pode ficar sobre o valor de uma cota temporária; o quadrado da alça de ponta cobre o
  triângulo de aviso de uma abertura na junta.
- Recarregar a página volta a planta ao enquadramento inicial (zoom e posição não são guardados).
- Sem passar o mouse (toque), a ferramenta Cômodo não tem prévia: o toque cria direto.

Achados da rodada anterior ainda abertos:
- Modificar: porta ou janela sozinha não é levada (vai com a parede); cópia para outro pavimento;
  matriz (várias cópias em série) e deslocamento paralelo (offset) ainda não.
- Paredes empilhadas com faces desalinhadas (ex.: 20 cm sob 15 cm, ambas no eixo) deixam um degrau
  visível na fachada. Falta: aviso e ação "Alinhar com a parede de baixo" (Chief Architect: Align With
  Wall Above/Below), encaixe na face da parede de baixo ao desenhar, arestas finas no 3D. A linha que
  apareceu na Casa Jardim vinha de uma parede de 20 cm (provável resto de teste meu), devolvida a 15 cm.
- Caixa de corte com alças (Revit Section Box, Vectorworks Clip Cube), corte vertical a partir de uma
  linha na planta, elevações, ocultar/isolar temporário, raio-X, vistas salvas.
- Barra superior em tela de toque (botões de 44 px), visto com a emulação de toque do Chrome: a 768 px
  os botões da direita (comandos, atalhos, idioma, tema…) cobrem as vistas, e a 375 px Refazer fica sob
  Comandos. Já acontecia antes das ferramentas de edição irem para o alto (os mesmos botões, sem elas,
  não cabem); falta decidir quais saem para a paleta nessas larguras.
- Duas folhas de porta que se cruzam (ao colocar uma porta perto de outra) não dão aviso.
- Mudar o lado de abertura não tem atalho no próprio desenho (só painel e barra).

## Esperando reteste no navegador

- Diálogo "Tipos de parede" e editor de camadas (17, parte 4; 08f1a21). Planta e 3D por camada já
  foram vistos (e3e18c6).
- Linhas entre camadas nítidas nos eixos e uma só decisão de camadas por vista (08f1a21).
- Diagonal clara no núcleo, no canto de um L do mesmo tipo (observação 3 do reteste de e3e18c6):
  as peças de uma mesma cor agora são pintadas num caminho só, então não há costura de
  antisserrilhado entre elas. Corrigido no código, ainda não visto.
- Arco: cotas de corda e de raio, alça de curvatura e raio editável no painel (427a512).

## Detalhes da revisão do testador (checklist em 3287502)

- Com zoom grande, a curva do arco mostra os trechos retos: a flecha de 0,5 mm do ADR 0001 aparece
  acima de ~2 000 px/m. Ideia: desenhar a planta do arco com mais trechos que o motor usa.
- Distribuir com aberturas dos dois lados de um encontro usa a parede inteira (ADR 0003, "Not done").
- Grupo v3 que já começa com uma janela sobre o X continua assim até ser editado (reteste de 16453d5).
- Resolvidos e vistos no reteste de 16453d5: cota de "De outra abertura", pavimento na lista "Com",
  nome do cômodo no centro, pavimento ao recarregar e ao abrir.

## Motor de paredes

- Resolvido em 2026-10-24: o L na ponta de um arco cuja reta alcança os trechos seguintes
  (transbordo) agora junta (wall-joins-spec.md, §7.1 "ponta livre" e parte 6). 29 dos 32 casos da seed
  fixa cobrem exato; os outros 3 são pulados como segunda junta (item abaixo).
- Casos com duas juntas que o gerador da suíte de arcos pula (ponta longe sobre o arco, ou passando
  perto da outra ponta). A suíte do L está no limite: 5 de 100 pulados.
- Resolvido em 2026-10-24: alturas diferentes entre paredes ligadas (wall-joins-spec.md, §7.5 e parte 6).
- Resolvido em 2026-10-25: faces de corte no 3D (faces.ts).
- Resolvido em 2026-10-25: L entre tipos diferentes em butt camada por camada (wall-joins-spec.md, §7.1 e
  entrega 6): o reboco interno e o núcleo não aparecem mais na quina de fora.
- Falta: o mesmo butt camada por camada quando uma das paredes é o segmento de um arco, e na passagem
  de um nó de 3 ou 4 pontas. Ali o butt ainda é como T (a parede que passa vai inteira até a face
  externa da outra), porque as cadeias dos arcos (footprint.ts) e os nós (node.ts, `alone`) reconhecem
  a parede que encosta por ter cortes por camada.
- Resolvido em 2026-10-26 (44527ab): junções de várias paredes num ponto por setores (wall-joins-spec.md,
  §7.6 e entrega 7). Y simétrico, Y com fresta, λ, K, 5 pontas, X com ponta no cruzamento, três paredes
  num ponto ou a poucos centímetros, ponta dentro de um L, Y de espessuras muito diferentes. Visto no
  navegador com gestos e capturas, também no 3D.
- Falta (entrega 7): refazer à mão três casos de `tests/elements/wall/nodes.test.ts` que descrevem a regra
  anterior ("no pair in line", "five ends", "an end straddling a passage"); por leitura do código devem
  falhar. Nenhum teste foi rodado nem escrito, por instrução do usuário. Faltam também casos à mão para
  os setores e as junções, e olhar as suítes de propriedade de nós.
- Falta: setores para arcos (os nós com trechos de arco seguem a regra da passagem) e para um braço que
  passa pelo ponto com setor de mais de meia volta (aí a junção avisa `ComplexJoin` e fica a regra
  anterior).
- Overrides de junta (desligar, butt, miter, corte reto).
- Mutação ≥ 90 %.

## Adendo 2: conjunto BIM (ref/chat.txt:74-152; etapas 16 a 33)

Um item por linha, com a linha de origem. "Falta": não existe nada; "parcial": diz o que existe.

Referências do projeto
- Eixos de grade com nomes (1, 2, 3 e A, B, C), elementos presos a eles (l.80, l.132): falta.
- Planos de referência, elementos presos a eles (l.80, l.132): falta.
- Pavimentos (l.80): existem.

Construção
- Topo da parede preso a telhado ou laje (l.84, l.136): falta.
- Paredes cortina: grade de montantes e travessas, painéis de vidro ou opacos, porta num painel (l.85, l.138): falta.
- Pilares (l.86, l.134): falta.
- Vigas (l.86, l.134): falta.
- Lajes e pisos por contorno ou pelo interior de paredes fechadas (l.87, l.135): parcial, existe piso por contorno e por cômodo.
- **Lajes e pisos com camadas** (l.87, l.135): falta. O editor de camadas do 17 deve servir a eles.
- Lajes e pisos com inclinação opcional (l.87): falta.
- Lajes e pisos com furos (l.87, l.135): falta.
- Forros por cômodo ou por contorno, com altura (l.88, l.135): falta.
- Telhados por contorno, com inclinação e beiral por lado: uma água, duas águas, quatro águas, mansarda, plano com platibanda (l.89, l.136): falta.
- Telhado por extrusão de perfil, abóbada (l.89): falta.
- Escadas retas, em L, em U e em caracol, degraus pela altura entre pavimentos, patamares (l.90, l.137): falta.
- Guarda-corpo automático da escada (l.90): falta.
- Rampas com inclinação e patamares (l.91, l.137): falta.
- Guarda-corpos livres, por caminho, ou presos a escadas, rampas e bordas de laje (l.92, l.137): falta.
- Portas e janelas em paredes (l.93): existem.
- Janela de canto (l.93, l.139): falta.
- Claraboias em telhados (l.93, l.139): falta.
- Vãos em lajes, forros e telhados (l.93, l.139): falta.
- Vão vertical por vários pavimentos, poço de escada ou de elevador (l.93): falta.
- Cômodos por clique dentro de paredes, com nome, número, área e perímetro (l.94): existem.
- Cômodos por linhas separadoras (l.94, l.140): falta.
- Cômodos com uso e pé-direito (l.94): falta.
- Zonas (l.94, l.140): falta.
- Terreno por pontos ou curvas de nível (l.95, l.141): falta.
- Platô sob a construção (l.95, l.141): falta.
- Linha de divisa do lote (l.95, l.141): falta.

Objetos e componentes
- Mobiliário, louças, equipamentos e iluminação, livres ou presos a paredes, pisos e forros (l.99, l.143): falta.
- Editor de objetos paramétricos: parâmetros, peças (caixas, cilindros, perfis extrudados e girados), medidas em expressões, prévia ao vivo, objetos como dados (l.100, l.143): falta.
- Exportar e importar objetos (l.100): falta.
- Portas e janelas como objetos paramétricos (l.100): falta.
- Tipos e instâncias: mudar o tipo atualiza as instâncias; sobrescrever com "voltar ao tipo"; virar tipo novo (l.101, l.143): parcial, só tipos de parede, com sobrescrita de topo e base.

Materiais e aparência
- **Biblioteca de materiais do projeto**: cor, textura, rugosidade e escala, editável, aplicável a qualquer elemento ou face, atualizando todos os usos (l.105, l.142): falta. Hoje o material de uma camada é só um id.

Ferramentas de edição (valem para todos os elementos)
- Selecionar por clique e por janela (l.107): existem.
- Selecionar por cerca (l.107): falta.
- Selecionar semelhantes (l.107): falta.
- Conjuntos de seleção salvos (l.107): falta.
- Mover com valores digitados (l.108): parcial, existem arrastar, setas (5 cm, Alt 1 cm) e cota temporária.
- Girar com valores digitados (l.108): parcial, existe a alça de girar.
- Copiar (l.108): falta.
- Espelhar (l.108): falta.
- Escalar quando fizer sentido (l.108): falta.
- Matriz linear (l.108): falta.
- Matriz polar (l.108): falta.
- Matriz por caminho (l.108): falta.
- Alinhar (l.109): parcial. Aberturas (alinhar, distribuir, centralizar entre as paredes ao lado) e paredes
  retas paralelas (alinhar com a primeira, distribuir com espaços iguais, 2026-10-25); falta alinhar
  cômodos e paredes a outros elementos (a um eixo, a uma face).
- Deslocar, offset (l.109): falta.
- Aparar e estender (l.109): parcial. Canto (Shift+T) leva duas paredes até se encontrarem; falta aparar
  ou estender uma parede até outra sem mexer nesta (Trim/Extend Single Element do Revit).
- Cortar pelo meio (l.109): falta.
- Editar contornos: arrastar vértices e lados, inserir e remover vértices, lado reto em arco (l.110): falta.
- Alças e cotas temporárias clicáveis em cada elemento (l.111): parcial, paredes e aberturas; o arco não tem cota nem alça.
- Copiar e colar entre pavimentos na mesma posição (l.112): falta.
- Travar (l.113): falta.
- Ocultar (l.113): parcial, por categoria no navegador.
- Isolar (l.113): falta.
- Camadas com visibilidade e bloqueio (l.113, l.144): parcial, visibilidade por categoria; sem bloqueio.
- Fases: existente, a demolir e novo (l.114, l.144): falta.
- Painel de propriedades dos schemas, vários elementos ao mesmo tempo (l.115): existe.
- Ferramentas de edição genéricas, por um contrato que cada elemento implementa (l.126, l.133): falta.

Documentação
- Cotas permanentes associadas aos elementos (l.117, l.145): falta.
- Cotas de nível (l.117, l.145): falta.
- Textos (l.117, l.145): falta.
- Etiquetas automáticas de nome e área do cômodo (l.117): existem.
- Etiquetas automáticas do tipo da porta e da janela (l.117): falta.
- Plantas de cada pavimento como vistas derivadas (l.118, l.146): parcial, existe a vista em planta; falta a planta como vista de documentação.
- Cortes (l.118, l.146): falta.
- Elevações (l.118, l.146): falta.
- Tabelas de quantitativos (portas, janelas, cômodos com áreas, paredes com comprimentos e áreas), exportáveis em CSV (l.119, l.147): falta.
- Pranchas com carimbo, impressão e PDF (l.120, l.148): falta.

Importar e exportar
- Exportar IFC, cada elemento na sua classe (l.122, l.149): falta.
- Exportar DXF das plantas (l.122, l.149): falta.
- Exportar PDF das pranchas (l.122, l.148): falta.
- Exportar glTF/GLB do modelo (l.122, l.149): falta.
- Importar DXF como referência (l.123, l.149): falta.
- Importar imagem de planta em escala (l.123, l.149): falta.

Regras (l.124-130), a cumprir em cada item acima
- Cada elemento novo numa pasta própria em src/elements, com schema, comandos, cálculo, campos, ferramenta, testes e index.ts, registrado na lista única (l.125).
- Relações guardadas como regras, geometria derivada; relação não cumprida marca o elemento e avisa (l.127).
- Vistas, cortes, tabelas e exportações só leem o modelo (l.128).
- Objetos do usuário são dados e nunca executam código (l.129).
- Toda criação e edição se desfaz num passo e aceita valores digitados (l.130).

Entrega final do adendo 2 (l.152)
- Casa de dois pavimentos montada do zero, com capturas de cada passo e tudo o que a linha lista; IFC aberto e validado num leitor; mudar a altura do térreo e ver tudo se atualizar; desfazer num passo: falta.

## Adendo do passeio virtual (ref/chat.txt:154-192; etapas 13 a 15)

- Modo caminhar: entrar e sair por botão e atalho, clicando onde começar, na planta ou no 3D (l.160, l.187): falta.
- Andar com WASD ou setas, olhar com o mouse, correr com Shift (l.161): falta.
- Joystick na tela e arrastar para olhar, no celular e no tablet (l.161, l.187): falta.
- Altura dos olhos ajustável, padrão 1,60 m (l.162): falta.
- Colisão: paredes bloqueiam, vãos de porta deixam passar (l.163, l.181): falta.
- Trocar de pavimento por seletor ou atalho, no mesmo ponto (l.164, l.187): falta.
- Esc sai e volta à câmera anterior (l.165): falta.
- Máquina de estado do modo caminhar com tabela escrita (l.180): falta.
- Tour guiado: paradas com nome e legenda; reordenar, editar e apagar (l.169, l.188): falta. O tour de 4 passos da interface (l.240) existe e é outra coisa.
- Pontos de interesse numerados com cartão de título e texto (l.170, l.188): falta.
- Reproduzir o tour com transição suave, anterior e próximo, automático com tempo por parada (l.171, l.188): falta.
- Paradas, pontos e configurações do tour no documento, por comandos, no desfazer, salvos com versão e migração (l.178): falta.
- "Exportar para web": pacote com index.html e os arquivos do modelo, sem instalar nada (l.173, l.189): falta.
- Visualizador para visitantes, somente leitura, ponto de entrada separado que reaproveita cálculo e renderização (l.174, l.183): falta.
- O visitante gira e aproxima, caminha com colisão, troca de pavimento, segue o tour, abre pontos de interesse e vê a planta com a sua posição (l.174): falta.
- Título, descrição e contato do autor configuráveis e mostrados (l.175): falta.
- Pacote leve: modelo comprimido, texturas otimizadas, indicador de progresso (l.176): falta.
- O pacote nunca executa código do projeto, só dados validados (l.184): falta.
- Pesquisar na documentação oficial atual as APIs de câmera em primeira pessoa, exportação e compressão antes de usar (l.185): a fazer junto com cada item.
- Entrega final do passeio: caminhar de um cômodo ao outro pela porta, trocar de pavimento, três paradas e dois pontos, tour, exportar, servir e abrir no computador e no celular, tamanho do pacote (l.192): falta.

## Adendo 3: interface (ref/chat.txt:194-257)

Inventário linha a linha feito antes: 44 de 47 itens existem no código. Abertos:
- Modo caminhar na interface (l.203): parcial, existe o botão "Caminhar", desligado; depende do modo caminhar acima.
- Alvos de 44 px no toque (l.244): conferidos só pelos tokens; não testado com toque de verdade.
- **Tudo operável pelo teclado (l.242): parcial.** O fluxo só com teclado da sessão de teste achou
  4 faltas (K1 a K4): Novo projeto, porta e janela sem ponteiro, piso de cômodo sem clique, zoom e
  vista sem mouse. Corrigidas no código; volta a "existe" quando o reteste só com teclado passar.
- Reteste no navegador de l.197, e conferência visual de l.228 (o contraste é medido pelo teste dos tokens).
- Troca 3D ⇄ Planta cerca de 500 ms mais lenta que os outros gestos (D1): medida com ?perf a pedir.
- Capturas de cada modo (3D, planta, caminhar, editor de objetos, prancha) nos dois temas, e lista item a item com "atendido" ou o que falta (l.257): falta; caminhar, editor de objetos e prancha dependem dos adendos acima.
