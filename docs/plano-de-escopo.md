# Plano de escopo: aplicação CAD/BIM paramétrica

Oct 26, 2026 · @Jonathan

## Resumo

O cad2 tem uma base de paredes de nível profissional, mas o resto do modelo ainda é fixo e codificado à mão; para virar uma aplicação paramétrica, o próximo passo não é um elemento novo, e sim um **sistema de objetos paramétricos** sobre o qual portas, janelas, escadas, mobiliário e todo o resto serão construídos.

- **O que está forte:** a engine de junções de paredes (L, T, X, nós, arcos, prioridade de camadas), as regras de posição de portas e janelas, os encaixes, as guias, a entrada digitada com expressões, as ferramentas de modificar, desfazer/refazer por comandos e um sistema genérico de campos para o painel de propriedades.
- **O que é fixo hoje:** porta e janela têm só tipo (porta ou janela), largura, altura, peitoril, dobradiça e lado; a geometria 3D é uma placa (folha ou vidro) e o símbolo em planta é desenhado no código. Material é só um nome; a cor vem da função da camada. Piso é uma placa sem camadas.
- **O que não existe:** lajes com camadas, forros, telhados, escadas, rampas, guarda-corpos, pilares, vigas, paredes-cortina, mobiliário e objetos, biblioteca de materiais, cotas permanentes, textos, pranchas, exportação IFC e PDF, terreno e eixos de projeto.
- **O obstáculo de arquitetura:** cada tipo de elemento tem sua lista própria no documento (`Doc`) e é tratado caso a caso em `app.ts` (2.951 linhas), `input.ts`, `geometry.ts`, `plan-view.ts` e `scene-3d.ts`. Acrescentar dezenas de elementos assim multiplicaria esse custo; o sistema paramétrico resolve isso ao mesmo tempo.

A recomendação, detalhada adiante: um **núcleo de objetos paramétricos definidos como dados** (parâmetros, fórmulas, restrições, peças geométricas, símbolo 2D, pontos de arraste), no espírito das famílias do Revit e dos objetos GDL do Archicad, mas sem linguagem de programação para o usuário, com editor visual e edição ao vivo na planta e no 3D. Portas, janelas, escadas, guarda-corpos, pilares, mobiliário e objetos viram definições nesse núcleo; paredes, lajes, telhados e cômodos continuam como elementos de sistema, com tipos e camadas.

Além do modelo, o plano cobre o que acontece com ele: verificação de **todas as normas e leis** aplicáveis (federais, estaduais e municipais) como regras citadas, **orçamento** pelo CUB e pelo SINAPI a partir dos quantitativos, e a **jornada de aprovação** com documentos, prazos e custos, do terreno à averbação.

Para não ficar lenta quando crescer, a aplicação precisa de **recálculo incremental, índice espacial, trabalho pesado em workers e renderização 3D por instâncias e lotes**, com metas de desempenho testadas a cada commit; isso entra na fase 1, junto com o contrato de elemento.

O plano também inclui **todas as instalações** (estrutura, elétrica, hidráulica, gás, incêndio, rede de dados, climatização, solar e outras) no mesmo modelo, e **simulações** de insolação, luz, temperatura, ventilação, umidade, acústica, Wi-Fi, incêndio e pontos de risco de infiltração e fissura.

## Estado atual por área

Lido no código do repositório em 26/10/2026 (commit b37baa3, revisto até o 6f0535a); os arquivos citados são os de `src/`.

| Área | O que existe | O que é limitado ou falta |
| --- | --- | --- |
| Paredes | Tipos com camadas e funções (estrutura, substrato, térmica, acabamentos), referência eixo/face externa/face interna, arcos, junções L/T/X e nós com prioridade, retângulo, Espaço ao desenhar, dividir, unir, canto, alinhar e distribuir paralelas, alturas por pavimento ou fixas | Referências pelo núcleo, flip que desloca a parede, perfil (empena), parede inclinada, empilhada, cortina, envolvimento de camadas nos vãos |
| Portas e janelas (`elements/opening`) | Tipo porta/janela, largura, altura, peitoril, dobradiça, lado de abertura, regras de posição (da ponta, centrada, de outra abertura, alinhada, em grupo), grupos distribuídos, cotas temporárias, corte exato na parede | Sem tipos nem catálogo; uma folha só; sem correr, folha dupla, basculante, maxim-ar, fixa; sem batente, guarnição, peitoril, verga, soleira, maçaneta; 3D é uma placa (`scene-3d.ts`, `buildOpening`); símbolo em planta fixo (`symbol.ts`) |
| Cômodos (`elements/room`) | Derivados das paredes a partir de um ponto, nome, número, área, perímetro, aviso de cômodo duplicado | Sem separadores, sem uso, pé-direito, acabamentos, zonas |
| Pisos | Placa por cômodo ou por contorno, espessura e deslocamento | Sem camadas, inclinação, furos, bordas; não existe laje estrutural nem forro |
| Pavimentos (`elements/level`) | Cota, altura piso a piso, altura de corte, vista do pavimento de baixo | Paredes não se prendem ao pavimento de cima nem a lajes |
| Guias | Retas infinitas por pavimento, encaixe nelas e nos cruzamentos, paralela a parede | Sem guia por ângulo, por dois pontos, ponto-guia, guias em 3D |
| Grid | Grade visual que se adapta ao zoom; encaixe fixo de 5 cm (`snap.ts`, `GRID_STEP`) | Passo configurável, grade girada, eixos estruturais nomeados (A, B, 1, 2) |
| Encaixes (`tools/snap.ts`) | Ponta, canto, início da cadeia, cruzamento de guias, interseção, origem, meio, sobre parede, face, guia, perpendicular, extensão, paralela, alinhamento, eixos, ângulo, grade | Tab entre candidatos, encaixe em portas e janelas, guias inteligentes entre objetos (estilo Figma), encaixe no 3D |
| Medição e entrada | Expressões com unidades (`core/measure.ts`: mm, cm, m, + − × ÷), comprimento<ângulo, x;y, fita métrica, cotas temporárias editáveis | Coordenada relativa, medir área e ângulo, unidades e precisão configuráveis (a exibição é sempre em metros com 2 casas) |
| Escala e desenho | Zoom contínuo | Escala de desenho (1:50, 1:100), espessuras de linha por escala, hachuras de material |
| Cotas e anotação | Cotas temporárias | Cotas permanentes, textos, etiquetas, cotas de nível, norte, escala gráfica |
| Modificar | Mover, copiar, girar, espelhar, escalar com ponto-base e valor, série de cópias, desunir, empurrar pelo teclado | Offset, aparar/estender até limite, matriz polar e por caminho, colar em outro pavimento |
| Seleção | Clique, janela, teclado, próximo/anterior, ocultar e isolar temporários, categorias no navegador | Semelhantes, cerca, filtro, conjuntos salvos, travar |
| 3D e vistas | three.js, caixa de corte, corte por linha, ortogonal, explodir pavimentos, raio-X, vistas salvas, caminhar, tour | Materiais com textura, iluminação e sol, elevações e cortes documentados |
| Materiais | Nome por camada (`layer-editor.ts`) | A cor vem da função da camada (`render/wall-paint.ts`); sem biblioteca, textura, hachura |
| Interface | Painel gerado de campos declarativos (`ui/fields.ts`), paleta de comandos (Ctrl+K), menu de contexto, tour, temas claro e escuro, pt/en, toque | Atalhos remapeáveis, histórico de desfazer em lista |
| Arquivo | JSON versionado com migração (`io/project-file.ts`, versão 9), gravação automática no navegador | Um projeto só, guardado em `localStorage`; exporta GLB do modelo, DXF R12 da planta de um pavimento e tabelas em CSV; faltam IFC e PDF |

## Defeitos e riscos encontrados no código

O risco maior é de arquitetura: o modelo não escala para dezenas de tipos de elemento sem um contrato comum.

1. **Cada elemento é tratado à mão em vários lugares.** O `Doc` tem uma lista por tipo (`walls`, `openings`, `rooms`, `floors`, `guides`), e `doc.openings` aparece em 11 arquivos e 49 pontos, `doc.rooms` em 11 arquivos. Seleção, painel, encaixe, 3D, planta, mover, copiar, apagar e salvar repetem a lógica para cada um. A própria lista de pendências registra a falta de "ferramentas de edição genéricas, por um contrato que cada elemento implementa".
2. **`app.ts` concentra demais.** São 2.951 linhas com estado da interface, ações, desenho, cotas e regras de vários elementos; `input.ts` tem mais 1.016. Cada elemento novo vai engordar esses arquivos.
3. **Identidade por prefixo de texto.** O tipo de um elemento é descoberto pelo começo do id (`isOpeningId`, `isGuideId`), o que é frágil com muitos tipos.
4. **Material não é dado.** `materialId` é um texto livre; a cor no 3D e na planta vem da função da camada, não do material. Uma biblioteca de materiais exige mudar planta, 3D, painel e arquivo.
5. **Geometria de porta e janela dentro do renderizador.** O 3D das aberturas é montado em `scene-3d.ts` e o símbolo em `symbol.ts`; nada disso é reaproveitável para uma porta definida pelo usuário.
6. **Armazenamento limitado.** Um único projeto em `localStorage` (limite típico de poucos megabytes); texturas, objetos e vários projetos não vão caber.
7. **Encaixe de grade fixo em 5 cm** e exibição fixa em metros com 2 casas: sem escolha de unidade, precisão nem passo.
8. **Da revisão anterior das paredes:** o flip desloca paredes com referência na face, inverte parede por parede, e `deleteWalls` (usado só em testes) deixa portas e janelas órfãs; a pesquisa em `docs/pesquisa/paredes-portas-janelas.md` está desatualizada.

Não consegui rodar os testes neste ambiente porque o registro do npm está bloqueado aqui; as conclusões vêm da leitura do código.

## O sistema paramétrico

A recomendação é que todo objeto do cad2 seja uma **definição em dados** (parâmetros, fórmulas, peças, símbolo 2D, alças de arraste e comportamento de hospedagem), avaliada ao vivo, editável por um editor visual e sem exigir que o usuário programe.

### Como os programas de referência fazem

| Programa | Como o objeto é definido | O que vale copiar | O que evitar |
| --- | --- | --- | --- |
| [Revit, famílias](https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-09A2439A-FDCB-4233-B08E-6F160D4296DE.htm) | Planos de referência, geometria (extrusão, revolução, varredura, mescla, vazios) presa aos planos, cotas rotuladas como parâmetros, fórmulas, tipos com valores pré-definidos | Separar parâmetros de **tipo** e de **instância**; fórmulas; tipos prontos; testar flexionando os parâmetros | Editor separado e pesado; restrições que quebram sem explicar |
| [Archicad, GDL](https://gdl.graphisoft.com/gdl-basics/components-of-a-libpart/) | Objeto da biblioteca com lista de parâmetros, scripts 2D, 3D e de parâmetros, imagem de prévia e subtipo (porta, mobiliário…) que traz parâmetros e comportamentos herdados | **Subtipo** que dá comportamento (uma porta corta a parede sozinha); símbolo 2D próprio; valores guardados por instância | Exige programar em GDL |
| [Archicad, alças (hotspots)](https://gdl.graphisoft.com/gdl-basics/hotspots-graphical-editing) | Pontos de arraste ligados a parâmetros: base, móvel e referência para comprimento; centro, base e móvel para ângulo; em 2D e 3D | **Arrastar uma alça muda o parâmetro** ao vivo; várias medidas presas à mesma alça | — |
| [Archicad, PARAM-O](https://help.graphisoft.com/AC/30/INT/Topics/065_PARAM-O/065_PARAM-O-5.html) | Editor por nós, com prévia do modelo que se atualiza a cada mudança | Criar objetos sem código, com prévia ao vivo | Prévia diferente do resultado final |
| [SketchUp, componentes dinâmicos](https://help.sketchup.com/cs/sketchup/dynamic-component-predefined-attributes) | Atributos com fórmulas: posição, tamanho (LenX, LenY, LenZ), rotação, material, oculto, número de cópias | **Cópias por fórmula** (uma prateleira a cada 40 cm); visibilidade condicional; simplicidade | Pouca semântica de construção: o componente não vira porta numa tabela nem no IFC |
| [Vectorworks, Marionette](https://app-help.vectorworks.net/2026/eng/VW2026_Guide/Marionette/Editing_Marionette_objects.htm) | Objeto com script por nós e geometria de controle; parâmetros de instância editáveis e de **estilo** compartilhados | Estilo que muda todas as instâncias; geometria de controle | — |
| [IFC (buildingSMART)](https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcWindowType.htm) | Tipos de janela por particionamento em painéis, com propriedades de marco (profundidade, espessura, montantes, travessas) e de painel (operação, posição, quadro); porta com [batente, soleira, bandeira e guarnição](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcDoorLiningProperties.htm) | Usar esses nomes como os **parâmetros padrão** de portas e janelas, para exportar IFC sem perda (no IFC 4.3 a entidade de batente da porta está marcada como obsoleta; os mesmos dados seguem em conjuntos de propriedades) | — |

### Arquitetura recomendada para o cad2

&#91;embedded content: núcleo paramétrico · definição, tipo e instância avaliados em quatro saídas\]

A mesma definição, com os valores do tipo e as sobreposições da instância, produz o símbolo, o 3D, as linhas das tabelas e o IFC; uma alça arrastada grava o novo valor na instância e tudo se recalcula.

**1. Contrato de elemento.** Cada tipo de elemento (parede, laje, objeto, cota…) implementa uma interface única: esquema dos dados, valores padrão, derivação da geometria, símbolo em planta, sólidos 3D, pontos de encaixe, alças, campos do painel, comandos, classe IFC e quantitativos. Seleção, mover, copiar, apagar, salvar, desfazer, encaixe, planta e 3D passam a percorrer um **registro** de tipos, em vez de listas escritas à mão. Isso resolve o defeito 1 e é pré-requisito para todo o resto.

**2. Definição de objeto (a "família") como dados.** Um JSON validado, guardado no projeto e em bibliotecas, com:

- **Parâmetros tipados:** comprimento, ângulo, número, inteiro, sim/não, texto, escolha (lista), material, cor, perfil, outro objeto (aninhado) e lista; com mínimo, máximo, passo, unidade, grupo, condição de visibilidade e **escopo de tipo ou de instância**.
- **Fórmulas seguras:** ampliar o leitor de expressões que já existe (`core/measure.ts`, que não usa eval) com referências a parâmetros, `se/então`, mínimo, máximo, arredondar, funções trigonométricas e valores do hospedeiro (espessura da parede, altura do pavimento).
- **Peças geométricas:** caixa, extrusão de perfil, revolução, varredura ao longo de caminho, mescla entre perfis, cilindro, esfera; repetição linear, polar e em grade com quantidade por fórmula; espelhar; união e subtração; cada peça com condição de existir e material por parâmetro.
- **Perfis 2D paramétricos:** retângulo, L, U, T, I, círculo, arco, polígono e contorno livre com vértices presos a parâmetros; restrições geométricas (paralelo, perpendicular, tangente, distância) resolvidas por um solucionador como o [planegcs](https://cdn.jsdelivr.net/npm/@salusoft89/planegcs@1.1.7/README.md), o mesmo do FreeCAD, compilado para WebAssembly.
- **Símbolo em planta** próprio, por nível de detalhe (simples, médio, detalhado), com linhas, arcos, preenchimentos e hachuras, distinguindo o que é cortado do que é visto; se não houver, gerado do corte do 3D.
- **Alças de arraste** declaradas, ligadas a parâmetros, como os hotspots do GDL: comprimento, ângulo, alternância (abrir para dentro ou fora) e escolha; em planta e no 3D, com cota ao vivo e valor digitável.
- **Comportamento de hospedagem (subtipo):** livre, hospedado em parede (corta a parede com um sólido de vazio, como as portas de hoje), em piso, em forro, em face, por linha (guarda-corpo ao longo de um caminho) e por caminho com regras (escada).
- **Tipos** com valores prontos (catálogo) e **sobreposição por instância**, o mesmo padrão "valor próprio × valor do tipo" que as paredes já usam (`ownValuesOnly`).
- **Objetos aninhados** (a maçaneta dentro da porta, a cadeira dentro do conjunto de mesa), **pontos de conexão** para encaixe e **regras de validação** (uma escada fora da regra de Blondel gera aviso).

**3. Motor de geometria.** Avaliação das definições num Web Worker, com cache pela combinação de parâmetros (o código já chaveia malhas por JSON), instâncias repetidas desenhadas com `InstancedMesh` do three.js, e operações booleanas com uma biblioteca de sólidos garantidamente fechados como a [manifold-3d](https://www.npmjs.com/package/manifold-3d), em WebAssembly. Conferir as licenças antes de adotar cada biblioteca.

**4. Editor de objetos sem código.** Tabela de parâmetros, árvore de peças, prévia 2D e 3D ao vivo, fórmulas com autocompletar, controles deslizantes para "flexionar" (o teste do Revit), tipos prontos e importação/exportação de bibliotecas. Um editor por nós, como o PARAM-O, pode vir depois para usuários avançados. E sempre a **edição no próprio modelo**: selecionar uma mesa na planta e arrastar a alça do comprimento muda o parâmetro na hora.

**5. Armazenamento.** Projetos, bibliotecas e texturas em IndexedDB ou no sistema de arquivos privado do navegador, no lugar do `localStorage`; formato de biblioteca em arquivo para trocar objetos entre projetos e pessoas.

## Desempenho, arquitetura e qualidade

Hoje o cad2 recalcula a geometria do projeto inteiro a cada mudança e grava o projeto inteiro a cada passo; isso funciona numa casa, mas não num prédio mobiliado. A arquitetura de desempenho precisa entrar **junto com o contrato de elemento (fase 1)**, porque trocá-la depois de dezenas de elementos prontos custa muito mais.

### O que o código faz hoje

| Ponto | Hoje | Risco |
| --- | --- | --- |
| Recálculo | `deriveGeometry` (`app/geometry.ts`) refaz paredes, junções, aberturas, cômodos e pisos de todos os pavimentos a cada mudança, inclusive durante arrastes; há cache por versão do documento (`geometryOf` em `app/carry.ts`), não por elemento | O tempo cresce com o projeto inteiro, mesmo quando só uma parede mudou |
| Busca de vizinhos | Junções comparam pares de pontas e de paredes (`join/discover.ts`); portas são comparadas duas a duas (`geometry.ts`); não há índice espacial | Custo quadrático: dobrar o projeto quadruplica o tempo |
| Gravação | `saveDocument` transforma o projeto inteiro em JSON e grava no `localStorage` a cada comando, na thread principal (`app/persist.ts`) | Travadas perceptíveis e limite de espaço |
| 3D | Malhas por elemento, refeitas quando a chave muda; descarte de recursos e renderização só quando algo muda já existem; seleção com o Raycaster padrão | Muitos objetos viram muitas chamadas de desenho; seleção lenta em modelos grandes |
| Medição | `?perf` no endereço registra o tempo de cada fase do desenho; a troca 3D ⇄ planta está anotada como cerca de 500 ms mais lenta | Sem metas nem testes automáticos de tempo |
| Qualidade | TypeScript estrito (com `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`), testes de propriedade (fast-check), oráculos de junções, testes de mutação (Stryker) | Sem integração contínua, sem linter, testes no navegador feitos à mão |

### Arquitetura de desempenho recomendada

1. **Recálculo incremental por grafo de dependências.** Cada resultado derivado registra do que dependeu (seu tipo, as paredes que encontra, o pavimento, o hospedeiro). Uma mudança marca só os afetados; mover uma parede recalcula ela, as vizinhas, suas aberturas e os cômodos ao lado, nunca o prédio todo.
2. **Índice espacial por pavimento** para junções, encaixes, seleção por janela, cômodos e verificações: um R-tree empacotado como o [Flatbush](https://www.npmjs.com/package/flatbush), que cabe num único ArrayBuffer e passa entre threads, ou o RBush quando o índice precisa inserir e remover. O custo deixa de ser quadrático.
3. **Trabalho pesado fora da thread principal.** Junções, objetos paramétricos, booleanas, cômodos, quantitativos, verificação de normas e orçamento num conjunto de Web Workers, com dados em ArrayBuffers transferíveis. Durante um arraste, um caminho rápido calcula só o elemento e os vizinhos; o resultado completo chega logo depois, sem travar a tela.
4. **3D:**
   - Objetos repetidos (cadeiras, balaústres, degraus, luminárias) com `InstancedMesh`; muitas geometrias diferentes do mesmo material num único desenho com [`BatchedMesh`](https://threejs.org/docs/pages/BatchedMesh.html), que também faz descarte por objeto fora da câmera.
   - Um material por material do projeto, nunca um por objeto; texturas comprimidas com mipmaps.
   - Níveis de detalhe: ferragens, puxadores e frisos somem de longe; o símbolo 2D se simplifica com a escala.
   - Descarte por pavimento, por caixa de corte e por câmera antes de enviar à placa de vídeo.
   - Seleção e encaixe no 3D com BVH ([three-mesh-bvh](https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.9.9/README.md)), que constrói o índice num worker.
   - Renderização sob demanda (já existe) e meta de 60 quadros por segundo ao orbitar e arrastar.
   - WebGPU: o `WebGPURenderer` do three.js cai sozinho para WebGL 2, mas ainda é tratado como experimental e não aceita `ShaderMaterial` nem o `EffectComposer` ([guia de migração](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)). Recomendação: manter o `WebGLRenderer` agora e escrever materiais sem shaders próprios, para migrar depois sem retrabalho.
   - Opção de desenhar o 3D num worker com [OffscreenCanvas](https://web.dev/articles/offscreen-canvas), para a interface nunca disputar a thread com a renderização.
5. **Planta 2D:** camadas desenhadas uma vez num canvas fora da tela (paredes paradas, hachuras) e só o que muda redesenhado; índice espacial para desenhar só o que está na tela; simplificação por escala.
6. **Documento e desfazer:** o documento imutável já compartilha a estrutura entre versões (bom); tipos e definições ficam normalizados (instâncias só referenciam); se o histórico crescer demais, guardar as diferenças em vez de versões inteiras.
7. **Armazenamento:** gravação incremental, agrupada a cada poucos segundos e feita num worker, no [sistema de arquivos privado do navegador (OPFS)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system) ou no IndexedDB; pedido de armazenamento persistente; texturas e bibliotecas separadas do projeto; arquivo compactado.
8. **Carregamento:** código dividido por ferramenta; editor de objetos, IFC, orçamento e os módulos WebAssembly (manifold, planegcs, web-ifc) carregados só quando usados.
9. **Memória:** geometrias, texturas e objetos WebAssembly liberados explicitamente (o manifold exige `delete()`), caches com limite.

### Metas de desempenho propostas

Metas a medir em três projetos de referência gerados por script: casa térrea, sobrado mobiliado e prédio de 10 pavimentos com apartamentos mobiliados. São propostas iniciais, a calibrar na primeira medição.

| Ação | Meta |
| --- | --- |
| Resposta a clique ou tecla | menos de 100 ms |
| Arrastar uma parede ou objeto, orbitar o 3D | 60 quadros por segundo num notebook comum |
| Recálculo visível durante o arraste, no prédio de 10 pavimentos | menos de 16 ms por quadro |
| Recálculo completo depois de soltar | menos de 300 ms, fora da thread principal |
| Abrir o projeto de referência maior | menos de 3 s |
| Trocar planta ⇄ 3D | menos de 200 ms |

### Qualidade

- **Integração contínua** a cada commit: typecheck, testes, build e testes de desempenho com os projetos de referência, falhando quando uma meta é ultrapassada; testes de mutação periódicos.
- **Linter e formatador** para TypeScript.
- **Testes de navegador automatizados** com Playwright (hoje as rodadas são feitas à mão) e **regressão visual** por capturas da planta e do 3D.
- **Testes de propriedade** para cada elemento novo e para o núcleo paramétrico: definições aleatórias não podem travar a aplicação nem gerar sólido aberto.
- **Arquivos corrompidos** testados com dados aleatórios; a leitura atual já repara e descarta o que é inválido.
- **Registro de erros e de tempos** em uso real, com consentimento do usuário.
- **Acessibilidade verificada automaticamente** e decisões de arquitetura em ADRs, como o projeto já faz.

## Catálogo de elementos e parâmetros

São dois grupos: **elementos de sistema**, que dependem do contexto (paredes, lajes, telhados, cômodos) e têm tipos com camadas, e **objetos paramétricos**, feitos de definições como descrito acima. Todos exportam para a classe IFC correspondente.

### Elementos de sistema

| Elemento | Como se cria | Parâmetros principais | Comportamentos | Hoje |
| --- | --- | --- | --- | --- |
| Laje / piso estrutural | Por contorno, por cômodo, por paredes selecionadas | Tipo com camadas (como paredes), espessura, cota, deslocamento, inclinação por seta ou por borda, furos, borda (frisos, pingadeiras) | Paredes se prendem embaixo e em cima; recorta escadas e poços; camada variável para caimento; [inclinação](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-5220FA75-4761-4277-9FE0-6E9370D5AC4B.htm) | Só placa simples |
| Contrapiso e revestimento de piso | Por cômodo | Camadas de acabamento, paginação (tamanho da peça, junta, padrão, ângulo, ponto inicial) | Segue o cômodo; quantitativo de peças | Falta |
| Forro | Por cômodo ou contorno | Altura, tipo com camadas, rebaixos, sancas, inclinação | Cortado por pilares e vigas; luminárias se prendem nele | Falta |
| Telhado | Por contorno ou por paredes, com beiral; [inclinação por borda](https://help.autodesk.com/cloudhelp/2020/ENU/RevitLT-Model/files/GUID-4EE804D4-CF0B-46C9-AE61-339B78E4EA8D.htm); por extrusão de perfil | Inclinação em % ou graus por borda, beiral, platibanda, tipo com camadas (telha, manta, estrutura), cumeeira, rufos, calhas | Uma, duas, quatro águas, mansarda, plano com platibanda; paredes se prendem ao telhado (empenas); claraboias | Falta |
| Cômodo | Ponto dentro das paredes ou separadores | Nome, número, uso, pé-direito, acabamentos de piso, parede, forro e rodapé | Área útil e de piso; volume; acabamento por ambiente | Parcial |
| Zona | Agrupando cômodos | Nome, categoria (social, íntima, serviço), cor | Áreas por zona; legendas | Falta |
| Parede-cortina | Como parede, por linha | [Grade vertical e horizontal](https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-B9263125-74EA-4C78-AAAA-F40916EFE2DB.htm) por distância fixa, número fixo ou espaçamento máximo; montantes de borda e internos; painéis (vidro, opaco, porta) | Embutir em parede; painel substituível por objeto paramétrico | Falta |
| Terreno | Por pontos cotados, curvas de nível ou malha | Cotas, material, platôs, cortes e aterros | Volume de terra; edifício assentado no platô | Falta |
| Eixos de projeto | Linhas nomeadas (A, B, 1, 2) | Nome, cor, bolha | Pilares e paredes presos aos eixos; cotas entre eixos | Falta |
| Pavimento | Já existe | Cota, altura, altura de corte | Topo de paredes e pilares "até o pavimento X" | Parcial |

### Objetos paramétricos (definições)

| Objeto | Parâmetros essenciais (todos editáveis, com tipos e sobreposição por instância) | Comportamentos |
| --- | --- | --- |
| Porta | Largura, altura, número de folhas, operação (abrir, correr, pivotante, sanfonada, basculante, de enrolar), lado e mão, ângulo de abertura, batente (profundidade, espessura, posição na parede), [guarnição, soleira, bandeira](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcDoorLiningProperties.htm), folha (espessura, almofadas, visores, vidros), maçaneta e ferragens aninhadas, materiais por parte | Corta a parede com vazio e envolvimento de camadas; símbolo em planta por operação e escala; área de varredura; etiqueta e tabela |
| Janela | Largura, altura, peitoril, verga, [particionamento em painéis](https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcWindowType.htm) (montantes e travessas com posição), operação por painel (fixa, correr, abrir, basculante, maxim-ar, guilhotina, pivotante), marco, perfis, vidro (camadas, espessura), peitoril externo, venezianas, grade | Igual à porta; janela de canto, em arco, bay window; peitoril e verga presos ao pavimento |
| Escada | Tipo (reta, L, U, em caracol, helicoidal, com leques), largura, altura a vencer (do pavimento ao de cima), número de degraus, altura do espelho e profundidade do piso calculados, bocel, patamares, estrutura (laje, viga central, laterais, balanço), degraus vazados, guarda-corpo aninhado | Regras configuráveis com aviso: fórmula de Blondel (2 espelhos + 1 piso entre 63 e 65 cm), espelho de 16 a 18 cm, piso de 26 a 32 cm, patamar a cada 3,20 m de altura ([NBR 9050, resumida aqui](https://professor.pucgoias.edu.br/sitedocente/admin/arquivosUpload/17452/material/ESCADA.pdf)); recorta a laje de cima; símbolo com linha de corte e seta de subida; [componentes como no Revit](https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-26053199-6B08-44B9-907C-F5D9AA7CEC81.htm) (lances e patamares editáveis) |
| Rampa | Inclinação (%), largura, patamares, guias de balizamento | Aviso quando passar da inclinação máxima configurada; recorte de laje |
| Guarda-corpo e corrimão | Caminho, altura, corrimão (perfil, altura, afastamento), [montantes e balaústres por padrão](https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-426BE12E-A906-457B-A205-A5DFF08B07D7.htm) (espaçamento, alinhamento, preenchimento do que sobra), painéis de vidro, postes de início, canto e fim | Por caminho desenhado, ou preso a escada, rampa e borda de laje; aviso de altura mínima configurável (1,10 m na [NBR 14718](https://cbic.org.br/publicada-revisao-da-norma-de-guarda-corpos-para-edificacao/) onde o desnível é de 1 m ou mais) |
| Pilar | Seção (retangular, circular, perfil I, H, L, perfil livre), dimensões, rotação, base e topo (pavimentos), material, revestimento | Preso aos eixos; corta paredes e lajes por prioridade de material |
| Viga | Perfil, dimensões, caminho, alturas nas pontas, material | Apoia em pilares e paredes; recorta forro |
| Mobiliário | Largura, profundidade, altura e **todas as partes**: tampos, pés (formato, posição, quantidade), gavetas e portas (quantidade, puxadores), prateleiras (quantidade por fórmula), almofadas, materiais por parte | Livre ou preso a parede; alças de arraste; conjuntos aninhados (mesa com cadeiras) |
| Marcenaria | Módulos (inferior, superior, torre), divisões, portas, gavetas, tampo, rodapé, puxadores | Corre ao longo de paredes; quantitativo de chapas |
| Louças e metais | Bacia, lavatório, cuba, chuveiro, banheira, bancada | Presos a parede ou piso; áreas de uso |
| Equipamentos e eletrodomésticos | Dimensões e afastamentos de uso | Áreas livres; conexões |
| Iluminação | Tipo (embutida, pendente, arandela, perfil), dimensões, potência, temperatura de cor, intensidade | Luz real no 3D; presa a forro ou parede |
| Vegetação e entorno | Espécie, altura, copa | Símbolo em planta por escala |
| Objeto genérico | Qualquer definição criada pelo usuário | Todos os comportamentos de hospedagem |

### Materiais e texturas (também paramétricos)

- **Material** com nome, categoria, cor, textura de cor, rugosidade, metal, relevo (normal), transparência, escala e rotação da textura (materiais PBR do three.js), **hachura de corte** e **hachura de superfície** para a planta, e dados de quantitativo (unidade, custo).
- **Texturas procedurais paramétricas:** revestimento por tamanho da peça, largura e cor do rejunte, padrão (alinhado, amarração, espinha de peixe, xadrez), variação de cor; madeira por largura de régua; tijolo por fiada. Geradas no próprio navegador, sem imagens.
- **Biblioteca do projeto e bibliotecas compartilhadas**, com importação de texturas e de materiais.

## Interface e precisão

Os encaixes já são bons; o que mais falta é **escala de desenho, cotas permanentes, unidades configuráveis e alinhamento entre objetos**, que hoje só existe para paredes paralelas.

| Recurso | Hoje | O que fazer | Referência |
| --- | --- | --- | --- |
| Grade | Visual adaptativa; encaixe fixo de 5 cm | Passo de encaixe configurável; grade girada e plano de trabalho (UCS) por pavimento, para terrenos tortos; grade no 3D | Archicad e SketchUp |
| Encaixes | 17 tipos (`tools/snap.ts`) | Símbolo próprio por tipo; Tab percorre candidatos; encaixe em portas, janelas, objetos, centros e quadrantes de arcos; no 3D em faces e arestas; **divisão do segmento** (meio, terços, n partes, distância mais próxima que divide sem sobra) | [Archicad, pontos de divisão](https://help.graphisoft.com/AC/19/INT/AC19Help/NewFeatures/NewFeatures-5.htm) |
| Travar direção | Encaixe de eixos e ângulo | **Travar a inferência**: Shift trava a direção atual, setas travam eixo, paralela e perpendicular; parar o cursor sobre um ponto o "encoraja" como referência | [SketchUp, inferências](https://help.sketchup.com/en/article/3000083) |
| Guias | Retas infinitas, paralela a parede | Guias temporárias que surgem ao passar o mouse sobre pontos e arestas e somem ao fim do comando; guia por ângulo, por dois pontos, círculo-guia, ponto-guia, guias em 3D; ponto de referência temporário como origem da medida digitada | [Archicad, guias](https://help.graphisoft.com/AC/19/INT/AC19Help/NewFeatures/NewFeatures-5.htm) |
| Guias inteligentes entre objetos | Alinhamento a pontas de paredes | Ao arrastar qualquer objeto: linhas de alinhamento com bordas e centros dos vizinhos, e marcação de **espaçamentos iguais** | [Figma, seleção inteligente](https://www.figma.com/blog/introducing-smart-selection/) |
| Alinhar e distribuir | Só paredes retas paralelas | Para qualquer seleção: alinhar bordas, centros e eixos; distribuir com espaço igual ou vão fixo; "arrumar" (tidy up); arrastar o espaçamento entre vários de uma vez | Figma, Revit |
| Entrada numérica | Rodapé: expressões, unidades, comprimento<ângulo, x;y | Campo junto ao cursor (como o Tracker do Archicad); coordenada relativa; Tab entre comprimento, ângulo, largura e altura; variáveis nomeadas no projeto (pé-direito, módulo) | Archicad |
| Unidades e precisão | Sempre metros, 2 casas | Configuração do projeto: m, cm, mm, pés e polegadas; casas decimais; arredondamento; ângulos em graus, % ou razão; áreas em m² | Revit (Project Units) |
| Medir | Fita métrica entre dois pontos | Medir área, perímetro, ângulo, soma de trechos; medida fica como cota se o usuário quiser | SketchUp, Archicad |
| Escala de desenho | Não existe | Escala por vista (1:20 a 1:500): espessura de linha, tamanho de texto, densidade de hachura e nível de detalhe dos símbolos mudam com a escala; conjunto de penas configurável | Revit, Archicad |
| Cotas permanentes | Só temporárias | Linear, alinhada, angular, raio, diâmetro, comprimento de arco, em cadeia, de base, coordenada, **cota de nível**, inclinação; presas aos elementos; **trava** e **EQ** (igual) que restringem a geometria; [como no Revit](https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-B3F3A810-5372-49E8-8E00-DDBD729EA49E.htm); estilos | Revit, Archicad |
| Cotagem automática | Não existe | Cotar paredes com vãos, eixos e totais com um clique; cotas internas de cômodos | Archicad |
| Anotação | Etiquetas de cômodo | Textos, chamadas com linha, etiquetas de portas e janelas (P1, J1), selos de cômodo configuráveis, norte, escala gráfica, marcas de corte e elevação, nuvens de revisão | Revit, Archicad |
| Visibilidade | Categorias no navegador, ocultar e isolar temporários | Camadas com combinações salvas; modelos de vista; substituição gráfica por filtro (ex.: paredes a demolir em vermelho); profundidade de vista | Revit (View Templates), Archicad (Layer Combinations) |
| Atalhos | Fixos | Remapeáveis e desligáveis (WCAG 2.1.4) | — |

## Documentação e troca de arquivos

Hoje o projeto já sai do cad2 como GLB, DXF da planta e tabelas em CSV; sem pranchas para impressão e sem IFC, o modelo ainda não chega à obra nem a outros profissionais.

| Recurso | O que fazer |
| --- | --- |
| Plantas como vistas | Planta de cada pavimento como vista de documentação, com escala, nível de detalhe, profundidade de vista e modelo de vista; planta de forro, de layout, de pontos elétricos |
| Cortes e elevações | Gerados do modelo, com linhas cortadas e vistas em espessuras diferentes, hachura de corte por material, cotas de nível; elevações internas por cômodo; detalhes ampliados com chamada |
| Tabelas | Já existem tabelas de portas, janelas, cômodos e paredes com totais, salvas em CSV; faltam acabamentos, materiais e objetos, campos e fórmulas escolhidos pelo usuário e exportação em planilha |
| Pranchas | Formatos A0 a A4, carimbo paramétrico, vistas posicionadas em escala, lista de pranchas, numeração; imprimir e gerar PDF vetorial |
| IFC | Exportar e importar IFC (paredes com camadas, aberturas, lajes, escadas, objetos com seus tipos e propriedades). A biblioteca [web-ifc](https://github.com/thatopen/engine_web-ifc) lê e escreve IFC no navegador, em WebAssembly, sob licença MPL-2.0 |
| DXF | Já existe DXF R12 da planta de um pavimento (faces, linhas de camada, portas, janelas, cômodos); faltam cortes e elevações, hachuras, cotas e a importação de DXF como referência |
| Imagens e PDF de referência | Importar imagem ou PDF de planta e calibrar a escala por dois pontos |
| 3D | Já existe exportação GLB, com um grupo por pavimento e um nó por elemento; faltam OBJ e a importação de glTF/OBJ como objeto da biblioteca (com parâmetros de escala e material) |
| Renderização | Imagens com sol por data, hora e localização, sombras, luz das luminárias; passeio web já planejado em `docs/pendencias.md` |

## Normas, legislação, custos e aprovação

O cad2 pode verificar o projeto contra normas e leis, orçar a obra e conduzir a aprovação, desde que as regras sejam **dados versionados e citados**, e não código fixo: os textos da ABNT são protegidos e vendidos, e cada município tem as suas próprias leis de obra e de uso do solo.

### Como as regras entram no sistema

- **Pacotes de regras** por jurisdição (federal, estadual, municipal) e por norma, com versão, data de vigência e citação do artigo. Cada exigência mostra de onde vem.
- **Cada regra é uma condição sobre o modelo** ("espelho da escada entre X e Y", "largura livre da porta de pelo menos Z", "taxa de ocupação até T"), com mensagem, gravidade e o elemento onde aparece.
- **Os valores são preenchidos e conferidos por um profissional** a partir do texto oficial; o cad2 não reproduz o texto das normas, só o número e a referência.
- **Editor de regras sem código**, com importação e exportação de pacotes, para que escritórios e a comunidade publiquem os pacotes das suas cidades.
- **Verificação ao vivo no desenho** e **relatório de conformidade** com a lista de pendências, cada uma com o artigo citado.
- **Dados do lote:** zona e parâmetros urbanísticos lidos da lei do município, guardados no projeto.

### Normas e leis a cobrir

| Tema | Normas e leis | O que o cad2 verifica ou gera |
| --- | --- | --- |
| Representação e etapas do projeto | [NBR 6492:2021](https://arquivos.ufrrj.br/arquivos/2021103028882828758439fd707c0a63a/NBR_6492_2021.pdf), NBR 16636 | Escalas usuais, carimbo, formatos A0 a A4, conteúdo de cada etapa (levantamento, programa, viabilidade, estudo preliminar, anteprojeto, projeto legal, executivo, *as built*) |
| Acessibilidade | NBR 9050, Lei 13.146/2015, Decreto 5.296/2004 | Largura livre de portas e circulações, área de giro, sanitários acessíveis, rampas, alturas de alcance, vagas |
| Escadas, rampas e saídas de emergência | NBR 9050, NBR 9077, regulamento de cada estado (em SP, o [Decreto 69.118/2024](https://www.fef.unicamp.br/wp-content/uploads/sites/70/2026/03/Decreto-69.118_24-Institui-o-regulamento-de-Seguranca-Contra-Incendios-das-edificacoes-e-areas-de-risco-no-Estado-de-Sao-Paulo.pdf) e as Instruções Técnicas dos Bombeiros) | Espelho, piso, Blondel, patamares, larguras, número de saídas, distâncias; classificação por ocupação, altura e carga de incêndio e as medidas que cada classe exige |
| Guarda-corpos | NBR 14718 | Altura mínima onde há desnível, vãos |
| Desempenho | [NBR 15575](https://sienge.com.br/blog/nbr-15575/) (6 partes), NBR 15220-3:2024 (12 zonas bioclimáticas) | Propriedades térmicas e acústicas das camadas dos tipos, vida útil de projeto por sistema, iluminação natural |
| Iluminação, ventilação e áreas mínimas | Código de obras municipal, código sanitário estadual | Área de janela por área de piso, pé-direito mínimo, área e dimensão mínima de cada cômodo |
| Uso e ocupação do solo | Plano diretor e lei de zoneamento do município ([conceitos](https://gestaourbana.prefeitura.sp.gov.br/wp-content/uploads/2016/03/Glossário.pdf)) | Taxa de ocupação, coeficiente de aproveitamento, permeabilidade, recuos, gabarito; quadro de áreas automático |
| Estrutura e instalações | NBR 6118, 6120, 6122, 6123, 8800, 7190, 16868 (alvenaria estrutural), NBR 5410, 5626, 8160, 10844 | Só avisos de pré-dimensionamento e de compatibilização; o cálculo continua com o engenheiro responsável |
| Reforma | NBR 16280 | Plano de reforma a partir das fases (existente, a demolir, novo) |
| Uso e manutenção | NBR 14037 | Manual de uso, operação e manutenção gerado do modelo |
| Incorporação | [NBR 12721](https://sienge.com.br/blog/nbr-12721/) | Quadros de áreas e de custos exigidos para o registro da incorporação |

Os números de norma desta tabela que não têm link vêm de conhecimento geral e devem ser confirmados no catálogo da ABNT antes de virar regra.

### Custos

| Nível | Base de preços | Como funciona |
| --- | --- | --- |
| Estimativa rápida (estudo) | CUB do Sinduscon do estado, pelos projetos-padrão da NBR 12721, divulgado todo mês | Área equivalente × CUB do padrão; o CUB não inclui fundações especiais, elevadores, terreno e impostos, que entram como itens à parte |
| Orçamento por quantitativos | [SINAPI](https://sienge.com.br/blog/tabela-sinapi/), da Caixa e do IBGE: mensal, por estado, desonerado ou não, com insumos e composições | Quantitativos do modelo ligados às composições; importação dos arquivos mensais de cada estado; BDI, transporte, licenças e seguros em campos próprios, porque o SINAPI não os inclui |
| Base própria | Preços do escritório e de fornecedores | Sobrepõe a base oficial item por item |

O que sai daí: planilha orçamentária, curva ABC, cronograma físico-financeiro, custo por cômodo e por elemento, e **comparação ao vivo** (trocar o tipo de uma parede mostra a diferença de custo na hora). Os custos que não são de material e mão de obra também entram, em tabelas configuráveis por cidade: honorários, RRT e ART, taxas municipais (alvará, habite-se), cartório, contribuição previdenciária da obra e taxas dos bombeiros.

### Processo de aprovação e documentos

O cad2 acompanha a obra do terreno à averbação, com uma lista de etapas configurável por cidade; cada etapa traz os documentos, quem emite, prazo e custo estimados, e o que o próprio cad2 gera.

1. **Levantamento:** topografia, matrícula do imóvel e consulta dos parâmetros urbanísticos do lote.
2. **Viabilidade:** verificação urbanística automática e estimativa pelo CUB.
3. **Projeto legal:** pranchas e quadro de áreas no padrão da prefeitura; [RRT do arquiteto e ARTs dos engenheiros](https://www.orcafascio.com/papodeengenheiro/art-ou-rrt) (Lei 12.378/2010 e Lei 6.496/1977), um documento por profissional.
4. **Aprovação:** prefeitura e alvará de construção; quando aplicável, Corpo de Bombeiros (em SP o regulamento exclui residências unifamiliares), meio ambiente, patrimônio histórico e concessionárias.
5. **Antes da obra:** [inscrição da obra no CNO da Receita Federal](https://planning.com.br/cno-construcao-civil/) (IN RFB 2.061/2021) e ART ou RRT de execução.
6. **Obra:** orçamento, cronograma, medições e diário.
7. **Conclusão:** AVCB ou CLCB quando exigidos, habite-se, aferição da contribuição previdenciária da obra e certidão, averbação no cartório de imóveis.
8. **Entrega:** *as built* e manual de uso (NBR 14037).

Documentos gerados pelo cad2: memorial descritivo, quadro de áreas, relatório de conformidade, planilha orçamentária, cronograma, quadros da NBR 12721 e uma pasta do projeto com tudo o que foi emitido e recebido em cada etapa.

## Instalações e sistemas complementares

Sim, é possível e faz sentido: todas as disciplinas de uma obra podem viver no mesmo modelo, usando o núcleo paramétrico (objetos com **pontos de conexão**) e uma ferramenta comum de **traçado de redes** (tubos, eletrodutos, cabos, dutos) com conexões automáticas. O cad2 calcula, verifica e documenta; o dimensionamento final de estrutura e instalações continua sob responsabilidade do engenheiro de cada área, com ART.

| Disciplina | O que se modela | Cálculos e verificações | Normas de referência |
| --- | --- | --- | --- |
| Estrutura | Fundações, pilares, vigas, lajes, alvenaria estrutural, aço, madeira; modelo analítico ligado ao físico | Cargas por área de influência, pré-dimensionamento, vãos e flechas indicativos; exportação para o software de cálculo do engenheiro | NBR 6118, 6120, 6122, 6123, 8800, 7190, 16868, 15575-2 |
| Elétrica de baixa tensão | Entrada, quadros, circuitos, tomadas, interruptores, pontos de luz, eletrodutos e cabos | Quadro de cargas, demanda, divisão e balanceamento de circuitos, seção dos condutores, queda de tensão, DR e DPS, diagrama unifilar | NBR 5410 e padrão da concessionária local |
| Iluminação artificial | Luminárias com fotometria do fabricante | Iluminância e uniformidade por cômodo e por tarefa | NBR ISO/CIE 8995-1 |
| SPDA e aterramento | Captores, descidas, anéis, malha | Análise de risco e posicionamento | NBR 5419 |
| Água fria e quente | Entrada, reservatórios, bombas, colunas, ramais, pontos, aquecedores | Vazões, pressão disponível em cada ponto, perdas de carga, diâmetros, consumo | NBR 5626 |
| Esgoto | Ramais, tubos de queda, ventilação, caixas, fossa, filtro e sumidouro | Declividades, diâmetros, unidades de contribuição | NBR 8160, 7229, 13969 |
| Águas pluviais e reúso | Calhas, condutores, caixas, cisterna | Área de contribuição, chuva de projeto local, capacidade; balanço do reservatório de chuva | NBR 10844, 15527 |
| Gás | Abrigo, medidores, rede, pontos | Diâmetros, ventilação dos ambientes com aparelhos | NBR 15526, 13103 |
| Incêndio | Extintores, hidrantes, chuveiros automáticos, iluminação de emergência, sinalização, alarme e detecção, rotas | Medidas exigidas pela classificação da edificação, alcance e cobertura | Regulamento e ITs do Corpo de Bombeiros do estado; NBR 12693, 10898, 17240, 13714 |
| Rede de dados e telecomunicações | Entrada da operadora, rack, pontos RJ45, fibra, pontos de acesso Wi-Fi, CFTV, interfone | Comprimento dos cabos até o rack, contagem de pontos, cobertura Wi-Fi (simulada) | NBR 14565 |
| Climatização e ventilação | Splits e VRF (unidades e infraestrutura), dutos, exaustão de banheiros e cozinhas, renovação de ar | Carga térmica por ambiente, vazões de ar, drenos | NBR 16401 |
| Energia solar | Módulos fotovoltaicos, inversor, coletores de aquecimento | Geração mensal estimada com sombreamento, área útil de telhado | NBR 16690, 15569 |
| Automação e segurança | Sensores, câmeras, alarme, controle de acesso, fechaduras | Cobertura e lista de equipamentos | — |
| Impermeabilização | Sistemas por área (lajes, banheiros, baldrames, reservatórios), detalhes | Áreas e camadas, pontos de risco (ver Simulações) | NBR 9575, 9574 |
| Transporte vertical | Elevadores, plataformas | Dimensões de caixa e poço | Normas de elevadores e NBR 9050 |
| Terreno, drenagem e contenções | Terraplenagem, platôs, drenos, muros de arrimo | Volumes de corte e aterro | — |
| Canteiro e segurança do trabalho | Layout do canteiro, proteções coletivas, acessos | Áreas e etapas | NR-18 (Ministério do Trabalho) |
| Resíduos da obra | Plano de gerenciamento | Volumes estimados por etapa | Resolução CONAMA 307 |

Recursos comuns a todas: **sistemas** (circuito, rede de água, rede de dados) como entidades com origem e destinos; **traçado automático** de rotas com curvas e conexões; vistas e filtros por disciplina; **detecção de conflitos** entre disciplinas e com a estrutura (tubo atravessando viga, duto contra forro); isométricos e diagramas; quantitativos para o orçamento; exportação IFC com sistemas de distribuição. Os números de norma desta tabela vêm de conhecimento geral e devem ser confirmados no catálogo da ABNT antes de virar regra.

## Simulações e análises

Quase tudo o que você listou é simulável, em **dois níveis**: uma estimativa rápida no navegador, enquanto se projeta, e um cálculo detalhado com motores validados e de código aberto, rodando num servidor ou em segundo plano. O cad2 gera a entrada de cada motor a partir do modelo e mostra o resultado sobre a planta e o 3D (mapas de cor, gráficos, lista de problemas).

| Simulação | O que responde | Estimativa rápida | Cálculo detalhado |
| --- | --- | --- | --- |
| Insolação e sombras | Horas de sol por fachada e por cômodo; sombra sobre vizinhos e quintal | Posição do sol por data, hora e local; sombras do 3D | — |
| Iluminação natural | Iluminância, autonomia de luz natural, ofuscamento | Fator de luz diurna aproximado por cômodo | [Radiance](https://www.energy.gov/eere/buildings/downloads/radiance), motor de iluminação gratuito e validado com medições |
| Iluminação artificial | Lux por cômodo e uniformidade | Cálculo ponto a ponto com a fotometria das luminárias | Radiance |
| Temperatura e energia | Temperatura interna hora a hora, horas de desconforto, consumo de climatização, etiqueta de eficiência | Transmitância e capacidade térmica de cada tipo de parede, laje e telhado | [EnergyPlus](https://www.nrel.gov/research/software/energyplus), de código aberto, que modela aquecimento, resfriamento, ventilação, iluminação e água; é o motor usado no método de simulação do [RTQ-R do Inmetro](https://seer.ufrgs.br/index.php/ambienteconstruido/article/download/40213/28755/186874) |
| Ventilação natural | Fluxo de ar entre aberturas, renovações por hora, ventilação cruzada | Modelo de rede de fluxo entre cômodos | Rede de fluxo de ar do EnergyPlus; CFD para casos especiais |
| Qualidade do ar | CO₂ por ocupação e ventilação, umidade interna | Balanço por cômodo | EnergyPlus |
| Condensação e mofo | Se a umidade condensa dentro das camadas de paredes e coberturas e se seca depois; risco de mofo nas superfícies | [Método de Glaser](https://mikewye.co.uk/knowledge/articles-faqs/glaser-or-wufi/) (ISO 13788) para cada tipo, automático | Simulação higrotérmica dinâmica (EN 15026) para casos críticos; pontes térmicas em 2D |
| Infiltração de água | Onde a água pode entrar | Verificação por regras dos pontos de risco: caimento de pisos e coberturas, rufos, pingadeiras, cota do piso em relação ao terreno, barreira contra umidade ascendente, calhas subdimensionadas, ralos, juntas | — (a causa é de detalhe e de execução, não se simula por física) |
| Acústica | Isolamento entre cômodos e unidades, ruído de impacto em lajes, reverberação | Lei da massa pelas camadas; tempo de reverberação por cômodo (Sabine) | Cálculo por ISO 12354 ou traçado de raios |
| Wi-Fi e celular | Mapa de calor do sinal em cada pavimento; onde pôr os pontos de acesso | Perda por distância e por paredes e lajes conforme o material, no [modelo de atenuação interna da UIT](https://en.wikipedia.org/wiki/ITU_model_for_indoor_attenuation) | Traçado de raios para 2,4, 5 e 6 GHz |
| Estrutura | Vãos e cargas fora do usual, elementos subdimensionados | Pré-dimensionamento e alertas | Elementos finitos no software do engenheiro (exportação) |
| Fundações e recalque | Capacidade do solo, recalque diferencial (causa de trincas) | Alerta a partir dos dados de sondagem informados | Análise do engenheiro de fundações |
| Fissuras e trincas | Pontos com risco de fissura | Regras: faltas de vergas e contravergas, juntas de dilatação em lajes de cobertura e muros longos, alvenaria sobre vigas muito deformáveis, mudança brusca de fundação; as [causas mais comuns](https://sienge.com.br/blog/principais-patologias-de-obras-e-como-evita-las/) são carga, retração, variação térmica e recalque | — |
| Incêndio | Tempo de evacuação, gargalos nas rotas; propagação da fumaça | Distâncias e larguras pelas regras dos bombeiros; tempo de saída estimado | [FDS do NIST](https://pages.nist.gov/fds-smv/), de domínio público, para fumaça e calor |
| Hidráulica | Pressão nos pontos, vazões, declividades do esgoto, capacidade das calhas | Cálculo direto na rede modelada | — |
| Elétrica | Queda de tensão, balanceamento de fases, proteção | Cálculo direto nos circuitos | — |
| Energia solar | Geração mensal e retorno do investimento | Irradiação local com sombreamento do modelo | — |
| Água | Consumo e aproveitamento de chuva | Balanço mensal do reservatório | — |
| Conflitos entre disciplinas | Tubo em viga, duto contra forro, porta contra pilar | Verificação geométrica contínua | — |
| Obra no tempo e no custo | Sequência de execução e desembolso mês a mês | Simulação 4D e 5D ligando modelo, cronograma e orçamento | — |
| Manutenção | O que revisar e quando, pela vida útil de cada sistema | Calendário gerado das camadas e dos sistemas | — |

Desabamento não é algo que o cad2 deva prever sozinho: ele aponta elementos fora do pré-dimensionamento e inconsistências (pilar sem apoio, viga sem pilar, vão excessivo), e a segurança estrutural fica com o cálculo do engenheiro responsável. Todo resultado de simulação vem marcado como estimativa, com as premissas usadas.

## Diferenciais possíveis

O maior diferencial é unir a liberdade do SketchUp (qualquer objeto, ajustado arrastando) com a semântica do Revit (o objeto sabe que é uma porta, corta a parede, entra na tabela e no IFC), no navegador e sem programar.

1. **Objetos paramétricos sem código e editados no modelo:** criar uma porta, uma escada ou um armário escolhendo partes e regras, e ajustar arrastando alças na planta ou no 3D, com a cota aparecendo e aceitando valor digitado.
2. **Orientação de paredes que não depende do gesto** e flip que não desloca nada (já em andamento).
3. **Desenhar pela medida interna** do cômodo e **manter o vão livre** ao trocar o tipo da parede.
4. **Acabamento por ambiente:** revestimentos de piso, parede e forro definidos no cômodo, com paginação e quantitativo.
5. **Verificação de normas brasileiras embutida e configurável:** escadas (Blondel, espelho, piso, patamar), guarda-corpos (altura), acessibilidade (largura livre de portas, giro de cadeira de rodas em sanitários, inclinação de rampas), com aviso no próprio desenho e lista de pendências.
6. **Modulação de alvenaria** e **quantitativo de obra** saindo das camadas: blocos, argamassa, reboco por face, revestimento por peça, descontando vãos.
7. **Diagnóstico explicado** de junções e de objetos (por que este canto virou topo, por que esta escada está fora da regra), com correção em um clique.
8. **Texturas procedurais paramétricas** (rejunte, paginação, madeira) sem depender de imagens.
9. **Bibliotecas compartilháveis** de objetos e materiais por link, e importação de glTF como objeto com parâmetros.
10. **Funciona em tablet e celular** com as mesmas ferramentas, o que Revit e Archicad não oferecem.

11) **Normas, orçamento e aprovação num só lugar:** todas as normas e leis aplicáveis como regras citadas e verificadas ao vivo, orçamento pelo CUB e pelo SINAPI saindo do modelo, e a jornada da prefeitura ao cartório com documentos e custos de cada etapa.

## Estudo de interface do ponto de vista do usuário

O primeiro protótipo partiu da lista de recursos e repetiu o modelo de painéis de sempre; este estudo parte de quem usa e do que essa pessoa faz com mais frequência, e é a base do protótipo 2.

### Quem usa

| Pessoa | Trabalho típico | O que mais pesa para ela |
| --- | --- | --- |
| Arquiteta autônoma ou de escritório pequeno (principal) | Residências, reformas e apartamentos; vários projetos por ano, do programa de necessidades à aprovação | Começar rápido, estudar alternativas, mostrar ao cliente, aprovar na prefeitura sem retrabalho, saber o custo cedo |
| Designer de interiores | Layout, marcenaria, acabamentos, imagens para o cliente | Objetos e materiais editáveis arrastando, orçamento de acabamentos |
| Engenheira parceira | Estrutura ou instalações sobre o modelo da arquiteta | Ver só a própria disciplina, sem atrapalhar a arquitetura |
| Cliente | Ver, comentar, aprovar | Abrir um link e entender, sem instalar nada |
| Estudante | Aprender a projetar com o programa | Ajuda no momento certo, sem tutorial obrigatório |

### O que se faz com mais frequência

Em qualquer sessão de projeto, a maior parte do tempo vai para **navegar** (aproximar, deslocar, girar), **selecionar e ajustar** (mover, esticar, mudar uma medida, trocar um tipo) e **desenhar** paredes, portas, janelas e cômodos. Pranchas, normas, orçamento e análises são marcos que se visitam de tempos em tempos. Pelo princípio de Pareto, a tela deve servir primeiro a esses poucos atos frequentes, e o resto deve estar a um clique, sem ocupar espaço permanente.

### Jornadas

1. **Começar.** Em branco, a partir de uma planta existente (PDF, imagem ou DWG, para reforma ou levantamento), a partir do programa de necessidades (lista de cômodos e áreas), a partir de um modelo, ou reabrindo um projeto recente.
2. **Estudar.** Desenhar e ajustar rápido, digitando medidas a qualquer momento, comparando alternativas.
3. **Apresentar.** Planta e 3D para o cliente, comentários, link.
4. **Compatibilizar.** Engenheiros trabalham cada um na sua disciplina sobre o mesmo modelo.
5. **Aprovar.** Pranchas no padrão da prefeitura, quadro de áreas, conformidade, documentos.
6. **Orçar.** Estimativa desde o primeiro traço e orçamento detalhado depois.

### O que o protótipo 1 errou

1. **Não dava para começar em branco.** A primeira tela era um formulário obrigatório (modelo, endereço, uso, unidades) antes de qualquer traço: exatamente o que usuários do [SketchUp reclamam da escolha de modelo na abertura](https://forums.sketchup.com/t/fr-ux-let-people-start-sketchup-without-selecting-a-template/51523), por exigir decisões antes de a pessoa saber do que precisa.
2. **Sem tela inicial nem projetos recentes**, ao contrário do [Revit](https://resources.ascented.com/ascent-blog/revit-2026-how-to-make-the-home-screen-work-for-you) e do Figma.
3. **Painéis demais abertos ao mesmo tempo:** ferramentas, navegador, inspetor, painel inferior, barra de opções e abas de vistas deixavam menos da metade da tela para o desenho, o mesmo "painel de avião" de que [usuários do Revit se queixam](https://forums.autodesk.com/t5/revit-ideas/make-revit-user-friendly/idi-p/6464362).
4. **Ambientes de trabalho como compartimentos:** para ver custo, regras ou uma análise, era preciso trocar de ambiente, embora sejam preocupações contínuas do projeto.
5. **Ferramentas frequentes escondidas em grupos:** porta e janela exigiam dois cliques.
6. **Ícones sem rótulo** na barra lateral e na barra flutuante: obriga a lembrar em vez de reconhecer.
7. **Jargão técnico** para o arquiteto e para o cliente ("definição", "hospedada", "IfcDoor", "pacote de regras").
8. **Medidas digitadas sem lugar visível:** o SketchUp mostra que o certo é [digitar a qualquer momento, sem clicar num campo](https://forums.sketchup.com/t/how-to-enter-values-into-measurements-box/13620), com o valor junto ao cursor.
9. **Problemas de norma abertos em destaque o tempo todo**, alarmando em vez de ajudar no momento da edição.
10. **Inspetor denso**, com todos os grupos de propriedades de uma vez, sem destacar os poucos campos mais usados.

### Princípios do protótipo 2

1. **O desenho primeiro:** por padrão, só a barra superior fina, a barra de ferramentas e o desenho; painéis aparecem quando há algo para eles.
2. **Começar sem perguntas:** projeto em branco em um clique, com padrões sensatos; endereço e lote são pedidos só quando necessários (normas, aprovação), seguindo a orientação de que [usuários raramente mudam padrões](https://www.nngroup.com/videos/the-danger-of-defaults/).
3. **O frequente à mão, com rótulo:** as ferramentas mais usadas visíveis e nomeadas, numa barra no centro inferior (menor distância, pela lei de Fitts); o restante em "Mais" e na busca.
4. **Editar onde se olha:** barra que se adapta à seleção, como a [interface adaptativa do Shapr3D](https://discourse.shapr3d.com/t/ipad-adaptive-ui-the-key-to-quick-streamlined-modeling/7942); cotas editáveis e alças no desenho; números digitados a qualquer momento.
5. **Um só espaço de modelagem:** disciplinas e análises são camadas da vista, não ambientes separados; escolher a disciplina troca só as ferramentas.
6. **Documentos são lugares:** Modelo, Pranchas, Orçamento e Aprovação como abas do projeto, porque são produtos diferentes.
7. **Ajuda no contexto:** estado vazio com caminhos diretos e dicas junto ao cursor, como recomendam a NN/g para [estados vazios](https://nngroup.com/articles/empty-state-interface-design) e para [ajuda contextual no lugar de tutoriais](https://www.nngroup.com/articles/onboarding-tutorials/).
8. **Resumo vivo e calmo:** área, custo e avisos num indicador discreto sempre visível, que abre o detalhe quando clicado.
9. **Linguagem do arquiteto**, sem siglas de sistema.
10. **O mesmo aplicativo no tablet**, com a mesma barra inferior.

## Fases de implementação

A ordem é ditada pelas dependências: o contrato de elemento vem antes de qualquer elemento novo, e o núcleo paramétrico vem antes de portas, escadas e mobiliário.

&#91;embedded content: fases de implementação · 4 etapas, 15 fases, 4 portões\]

Cada coluna só começa depois do portão da anterior; a fase 9 (precisão) pode correr em paralelo a partir da fase 1.

0. **Paredes consolidadas.** O prompt já entregue: orientação e flip, seleção de cadeia, junções, limpeza, offset, aparar e estender. *Pronto quando:* `npm run check` passa e os testes de invariância do flip passam com todas as referências.
1. **Contrato de elemento.** Interface única por tipo (dados, geometria, planta, 3D, encaixes, alças, campos, comandos, IFC, quantitativos), registro de tipos, tipo explícito no id, `app.ts` e `input.ts` divididos por ferramenta e por elemento; paredes, aberturas, cômodos, pisos e guias migrados; recálculo incremental por grafo de dependências, índice espacial, núcleo de geometria em workers, gravação incremental, integração contínua e testes de desempenho com os projetos de referência. *Pronto quando:* nada muda para o usuário, todos os testes antigos passam e um elemento de teste novo exige só o seu próprio arquivo de definição, e as metas de desempenho são cumpridas no prédio de referência.
2. **Dados base.** Unidades e precisão do projeto; materiais como dados (cor, PBR, hachuras de corte e superfície) com migração dos nomes atuais; projetos em IndexedDB com vários projetos; avaliação de geometria em Web Worker. *Pronto quando:* trocar um material muda a planta e o 3D, e um projeto grande salva e abre sem perda.
3. **Núcleo de definições.** Esquema validado de parâmetros, fórmulas, peças, perfis com restrições, booleanas, repetições, condições, símbolo 2D por nível de detalhe, alças, hospedagem, tipos com sobreposição por instância, aninhamento e regras de validação; cache e instâncias no 3D. *Pronto quando:* uma mesa, uma estante e um armário existem só como dados, com alças funcionando na planta e no 3D e um passo de desfazer por arraste.
4. **Editor sem código.** Tabela de parâmetros, árvore de peças, prévia ao vivo, fórmulas com autocompletar, flexionar, tipos, bibliotecas, importação e exportação, importação de glTF. *Pronto quando:* um usuário cria uma porta de correr de três folhas sem tocar em código.
5. **Portas e janelas como definições.** Parâmetros no padrão IFC (marco, painéis, operação, guarnição, soleira, bandeira), símbolo por operação e escala, envolvimento de camadas no vão, catálogo inicial; regras de posição e grupos preservados. *Pronto quando:* arquivos da versão 9 abrem com a mesma aparência.
6. **Lajes, forros, telhados e cômodos.** Laje com camadas, inclinação e furos; piso com paginação; forro; telhado por contorno ou paredes, com inclinação por borda e platibanda; paredes presas a lajes e telhados; cômodos com uso, acabamentos e separadores; zonas; eixos; topo "até o pavimento". *Pronto quando:* uma casa térrea com telhado de quatro águas e forro é montada só com gestos.
7. **Circulação e estrutura.** Escadas por componentes, rampas, guarda-corpos por caminho ou presos, pilares, vigas, parede-cortina e verificação de normas configurável. *Pronto quando:* um sobrado com escada em U recorta a laje de cima e recebe guarda-corpo dentro da regra.
8. **Mobiliário e biblioteca.** Objetos paramétricos iniciais de cada categoria (mesas, cadeiras, sofás, camas, armários, marcenaria modular, louças, metais, eletrodomésticos, luminárias com luz, vegetação), materiais PBR e texturas procedurais. *Pronto quando:* cada categoria tem ao menos um objeto inteiramente paramétrico e editável por alças.
9. **Precisão e interface.** Escala de desenho e penas, encaixes com símbolo, Tab e divisão, travas de inferência, guias temporárias, guias inteligentes, alinhar e distribuir para tudo, entrada junto ao cursor, unidades na interface, camadas, modelos de vista e atalhos remapeáveis. *Pronto quando:* a mesma planta impressa em 1:50 e 1:100 muda espessuras, textos e detalhe sozinha.
10. **Cotas e documentação.** Cotas permanentes associativas com trava e EQ, cotagem automática, anotações e etiquetas, cortes e elevações documentados, tabelas, pranchas com carimbo e PDF. *Pronto quando:* mover uma parede atualiza cotas, tabelas e pranchas.
11. **Troca e diferenciais.** IFC, DXF, glTF, importação de referências, terreno, renderização e os diferenciais desta página. *Pronto quando:* o IFC exportado abre num visualizador independente com classes, tipos e camadas corretos.

12) **Normas, custos e aprovação.** Motor de regras como dados com pacotes por jurisdição e citação de artigo, editor de regras, verificação ao vivo e relatório de conformidade; dados do lote e quadro de áreas; estimativa pelo CUB, orçamento pelo SINAPI com importação mensal por estado, base própria, BDI, curva ABC e cronograma físico-financeiro; jornada de aprovação por cidade com documentos, prazos e custos; geração de memorial, quadros e pasta do projeto. As regras de escadas, guarda-corpos e acessibilidade entram já nas fases 6 e 7, sobre o mesmo motor. *Pronto quando:* um sobrado em São Paulo sai com relatório de conformidade, orçamento pelo SINAPI do estado e a lista de etapas de aprovação preenchida.

13. **Instalações e sistemas.** Pontos de conexão nos objetos, traçado de redes (tubos, eletrodutos, cabos, dutos) com conexões automáticas, sistemas como entidades, estrutura com modelo analítico, elétrica, água, esgoto, pluvial, gás, incêndio, dados, climatização, solar, automação, impermeabilização; cálculos de cada disciplina, detecção de conflitos, isométricos e diagramas. *Pronto quando:* o sobrado de referência tem todas as instalações modeladas, quadro de cargas, pressões nos pontos e nenhum conflito com a estrutura.
14. **Simulações.** Nível rápido no navegador (sol e sombras, transmitância, Glaser, lei da massa, Wi-Fi, regras de infiltração e fissuras, hidráulica e elétrica diretas) e nível detalhado com motores validados (EnergyPlus, Radiance, FDS) gerados do modelo e executados fora da interface; resultados como mapas de cor e relatórios com premissas. *Pronto quando:* o sobrado de referência tem relatórios de insolação, luz natural, temperatura, condensação, acústica, Wi-Fi e pontos de risco de infiltração e fissura.

## Fontes

Código: repositório [designathan1988/cad](https://github.com/designathan1988/cad), commit b37baa3, lido em 26/10/2026. Páginas abertas para este plano:

- [Revit: fluxo de criação de famílias carregáveis](https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-09A2439A-FDCB-4233-B08E-6F160D4296DE.htm)
- [Archicad GDL: componentes de um objeto da biblioteca](https://gdl.graphisoft.com/gdl-basics/components-of-a-libpart/)
- [Archicad GDL: alças e edição gráfica](https://gdl.graphisoft.com/gdl-basics/hotspots-graphical-editing)
- [Archicad: editor PARAM-O](https://help.graphisoft.com/AC/30/INT/Topics/065_PARAM-O/065_PARAM-O-5.html)
- [Archicad: pontos de encaixe e linhas-guia](https://help.graphisoft.com/AC/19/INT/AC19Help/NewFeatures/NewFeatures-5.htm)
- [SketchUp: atributos dos componentes dinâmicos](https://help.sketchup.com/cs/sketchup/dynamic-component-predefined-attributes)
- [SketchUp: inferências](https://help.sketchup.com/en/article/3000083)
- [Vectorworks: edição de objetos Marionette](https://app-help.vectorworks.net/2026/eng/VW2026_Guide/Marionette/Editing_Marionette_objects.htm)
- [IFC 4.3: IfcWindowType](https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcWindowType.htm)
- [IFC 4.3: IfcDoorLiningProperties](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcDoorLiningProperties.htm)
- [Revit: telhado por contorno](https://help.autodesk.com/cloudhelp/2020/ENU/RevitLT-Model/files/GUID-4EE804D4-CF0B-46C9-AE61-339B78E4EA8D.htm)
- [Revit: escada por componentes](https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-26053199-6B08-44B9-907C-F5D9AA7CEC81.htm)
- [Revit: padrão de balaústres](https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-426BE12E-A906-457B-A205-A5DFF08B07D7.htm)
- [Revit: propriedades de tipo de parede-cortina](https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-B9263125-74EA-4C78-AAAA-F40916EFE2DB.htm)
- [Revit: propriedades de piso](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-5220FA75-4761-4277-9FE0-6E9370D5AC4B.htm)
- [Revit: cotas e restrições](https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-B3F3A810-5372-49E8-8E00-DDBD729EA49E.htm)
- [Figma: seleção inteligente](https://www.figma.com/blog/introducing-smart-selection/)
- [Escadas segundo a NBR 9050 (material didático PUC Goiás)](https://professor.pucgoias.edu.br/sitedocente/admin/arquivosUpload/17452/material/ESCADA.pdf)
- [CBIC: revisão da NBR 14718 (guarda-corpos)](https://cbic.org.br/publicada-revisao-da-norma-de-guarda-corpos-para-edificacao/)
- [manifold-3d (npm)](https://www.npmjs.com/package/manifold-3d)
- [planegcs (README)](https://cdn.jsdelivr.net/npm/@salusoft89/planegcs@1.1.7/README.md)
- [web-ifc (ThatOpen)](https://github.com/thatopen/engine_web-ifc)

Normas, custos e aprovação:

- [NBR 6492:2021 (cópia da UFRRJ)](https://arquivos.ufrrj.br/arquivos/2021103028882828758439fd707c0a63a/NBR_6492_2021.pdf)
- [NBR 15575, resumo (Sienge)](https://sienge.com.br/blog/nbr-15575/)
- [NBR 12721 e CUB, resumo (Sienge)](https://sienge.com.br/blog/nbr-12721/)
- [SINAPI, resumo (Sienge)](https://sienge.com.br/blog/tabela-sinapi/)
- [Decreto 69.118/2024 de São Paulo, segurança contra incêndio](https://www.fef.unicamp.br/wp-content/uploads/sites/70/2026/03/Decreto-69.118_24-Institui-o-regulamento-de-Seguranca-Contra-Incendios-das-edificacoes-e-areas-de-risco-no-Estado-de-Sao-Paulo.pdf)
- [Prefeitura de São Paulo, glossário de gestão urbana](https://gestaourbana.prefeitura.sp.gov.br/wp-content/uploads/2016/03/Glossário.pdf)
- [ART ou RRT (OrçaFascio)](https://www.orcafascio.com/papodeengenheiro/art-ou-rrt)
- [CNO na construção civil (Planning)](https://planning.com.br/cno-construcao-civil/)

Desempenho:

- [three.js: BatchedMesh](https://threejs.org/docs/pages/BatchedMesh.html)
- [Guia de migração para WebGPU no three.js (Utsubo, 2026)](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- [three-mesh-bvh (README)](https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.9.9/README.md)
- [Flatbush (npm)](https://www.npmjs.com/package/flatbush)
- [web.dev: OffscreenCanvas](https://web.dev/articles/offscreen-canvas)
- [MDN: Origin private file system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)

Instalações e simulações:

- [EnergyPlus (NREL)](https://www.nrel.gov/research/software/energyplus)
- [Radiance (Departamento de Energia dos EUA)](https://www.energy.gov/eere/buildings/downloads/radiance)
- [FDS e Smokeview (NIST)](https://pages.nist.gov/fds-smv/)
- [Modelo de atenuação interna da UIT (ITU-R P.1238)](https://en.wikipedia.org/wiki/ITU_model_for_indoor_attenuation)
- [Glaser ou WUFI: análise de umidade](https://mikewye.co.uk/knowledge/articles-faqs/glaser-or-wufi/)
- [RTQ-R e simulação no EnergyPlus (Ambiente Construído)](https://seer.ufrgs.br/index.php/ambienteconstruido/article/download/40213/28755/186874)
- [Principais patologias de obras (Sienge)](https://sienge.com.br/blog/principais-patologias-de-obras-e-como-evita-las/)

As normas brasileiras foram consultadas por fontes secundárias; antes de implementar as regras de verificação, confirmar os valores nos textos vigentes da ABNT.
