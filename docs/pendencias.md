# O que falta

Lista viva do que ainda não está feito, com a origem de cada item. Um item sai daqui quando o commit que
o resolve existe e, se for de interface, quando a sessão de teste o viu no navegador.

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

- X com arco.
- **L na ponta de um arco cuja reta alcança os trechos seguintes (transbordo): ainda avisa**
  (wall-joins-spec.md, parte 6). Comum, não raro: 32 de 98 Ls na seed fixa da suíte. Eu tinha escrito
  "nenhum caso real": a busca pulava exatamente esses casos. Próximo item do motor.
- Casos com duas juntas que o gerador da suíte de arcos pula (ponta longe sobre o arco, ou passando
  perto da outra ponta).
- Alturas diferentes entre paredes ligadas.
- Faces de corte no 3D.
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
- Alinhar (l.109): parcial, só aberturas.
- Deslocar, offset (l.109): falta.
- Aparar e estender (l.109): falta.
- Dividir (l.109): falta.
- Unir (l.109): falta.
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
- Reteste no navegador de l.197 e l.242, e conferência visual de l.228 (o contraste é medido pelo teste dos tokens).
- Capturas de cada modo (3D, planta, caminhar, editor de objetos, prancha) nos dois temas, e lista item a item com "atendido" ou o que falta (l.257): falta; caminhar, editor de objetos e prancha dependem dos adendos acima.
