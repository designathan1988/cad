# Motor de juntas de parede — especificação técnica

> Prosa em português (é o documento de revisão). **Todo identificador, nome de
> arquivo, tipo, função, mensagem de erro e código é em inglês**, conforme a
> regra do projeto.

Versão 1 · escrita antes de qualquer linha de código.

---

## 0. Por que este documento existe

A tentativa anterior tratou encontros de parede como **booleana de polígonos
arbitrários em ponto flutuante**. Essa escolha gera, por construção, frestas de
escala nanométrica, vértices duplicados, vértices colineares extras e slivers —
a própria documentação do Clipper2 avisa que soluções livres de slivers não
devem ser esperadas. O motor passou a perseguir defeitos de 1 nm (10⁻⁹ m) num
modelo cuja tolerância real é 1 mm, e cada seed nova do fuzzer achava mais um.
Era um alvo que não existe.

Esta especificação troca a abordagem: **toda peça de geometria permanece
convexa e todo corte é um semiplano**. O recorte de um polígono convexo por um
semiplano (Sutherland–Hodgman) é exato: não há etapa de arredondamento onde
fresta, sliver ou vértice duplicado possa nascer.

Referência de projeto: o PR #205 do [hito](https://github.com/hito-project/hito/pull/205)
(app BIM em Rust) resolve o mesmo problema com essa arquitetura.

---

## 1. Escopo

**Dentro:** paredes retas e em arco, com camadas; juntas em L, T e X; nós com 3
e 4 pontas; paredes com alturas diferentes; geração da pegada em planta e do
sólido 3D; avisos para configurações inválidas.

**Fora:** aberturas (vão na parede é etapa posterior e entra como mais um
conjunto de cortes), paredes inclinadas, paredes cortina, topo preso a telhado.
O motor é desenhado para receber esses cortes depois sem mudar de forma.

---

## 2. Modelo de dados

### 2.1 O que é guardado e o que é derivado

A regra do projeto diz "nunca guardar encontros". Isso está certo para a
**geometria** e errado para a **decisão do usuário**: o Revit permite
*Disallow join* e escolher Butt / Miter / Square-off por canto, e essa escolha
precisa de onde morar. A resolução:

| | Guardado | Derivado |
|---|---|---|
| Conjunto de juntas (quem encosta em quem) | — | `deriveJoins()` |
| Geometria da junta | — | `footprint()` |
| Decisão do usuário sobre uma junta | `WallJoinOverride` | — |

`WallJoinOverride` só nasce de um comando do usuário. Sem override, tudo é
automático.

### 2.2 Tipos

```ts
// src/elements/wall/schema.ts

type WallEnd = 'start' | 'end';

type LayerFunction =
  | 'structure'   // núcleo
  | 'substrate'
  | 'thermal'
  | 'finish1'
  | 'finish2';

interface WallLayer {
  thickness: number;        // m, > 0
  function: LayerFunction;
  materialId: MaterialId;
}

interface WallType {
  id: WallTypeId;
  name: string;
  layers: WallLayer[];      // ordenadas, exterior primeiro
}

type ReferenceLine = 'centerline' | 'interiorFace' | 'exteriorFace';

interface Wall {
  id: WallId;
  wallTypeId: WallTypeId;
  referenceLine: ReferenceLine;
  start: Point2;            // m
  end: Point2;              // m
  bulge: number;            // 0 = reta; senão tangente de 1/4 do ângulo do arco
  baseLevelId: LevelId;
  baseOffset: number;       // m
  top: { kind: 'level'; levelId: LevelId; offset: number }
     | { kind: 'height'; height: number };
}
```

O **núcleo** (`core`) de um tipo vai da primeira à última camada `structure`,
inclusive. Se não houver camada `structure`, o núcleo é a parede inteira.

### 2.3 Override

```ts
type JoinKey = string;      // `${wallId}:${end}` — estável sob movimento

interface WallJoinOverride {
  key: JoinKey;
  allowJoin: boolean;              // false = Disallow join (Revit)
  config: 'auto' | 'miter' | 'butt' | 'squareOff';
  priority?: WallId;               // qual parede passa, em butt
}
```

A chave é estável porque `WallId` é um ID aleatório estável e `end` não muda
quando a parede é movida ou esticada.

### 2.4 Grafo derivado

```ts
interface EndJoin   { nodeId: NodeId; members: { wallId: WallId; end: WallEnd }[] }
interface Abutment  { abutting: { wallId: WallId; end: WallEnd }; hostId: WallId; t: number }
interface Crossing  { throughId: WallId; cutId: WallId; point: Point2 }

interface JoinGraph {
  nodes: EndJoin[];
  abutments: Abutment[];
  crossings: Crossing[];
  warnings: JoinWarning[];
}

function deriveJoins(
  walls: readonly Wall[],
  types: ReadonlyMap<WallTypeId, WallType>,
  levels: ReadonlyMap<LevelId, Level>,
  overrides: readonly WallJoinOverride[],
): JoinGraph;   // pura, determinística, sem three.js, sem I/O
```

---

## 3. Tolerâncias

Um lugar só, `src/core/tolerance.ts`. **Mudar qualquer valor aqui exige um ADR
novo; o CI falha se o arquivo mudar sem ele.** Foi afrouxar tolerância
silenciosamente que escondeu os defeitos da primeira tentativa.

```ts
export const POINT_TOLERANCE   = 1e-3;   // m   — 1 mm: pontas que se encontram
export const COLLINEAR_ANGLE   = 0.6;    // °   — abaixo disso é "em linha"
export const MITER_LIMIT       = 10;     // ×   — do maior dos dois espessuras
export const MIN_WALL_LENGTH   = 1e-3;   // m   — parede mais curta é inválida
export const AREA_EPSILON      = 1e-9;   // m²  — peça menor que isso é descartada
export const ARC_SAG           = 5e-4;   // m   — flecha máxima da segmentação
```

Não existe tolerância em escala de nanômetro. Se o algoritmo precisar de uma,
o algoritmo está errado.

---

## 4. Geometria básica — o único núcleo exato

`src/elements/wall/geometry/convex.ts`, ~80 linhas, **o único lugar do projeto
com primitivas de recorte**.

```ts
interface HalfPlane { nx: number; ny: number; d: number }  // mantém nx·x + ny·y ≤ d
type ConvexPolygon = readonly Point2[];                    // CCW, sem vértice repetido

function clipHalfPlane(poly: ConvexPolygon, h: HalfPlane): ConvexPolygon;
function clipOut(poly: ConvexPolygon, region: readonly HalfPlane[]): ConvexPolygon[];
function area(poly: ConvexPolygon): number;
```

`clipHalfPlane` é Sutherland–Hodgman de um semiplano só: percorre as arestas,
mantém vértices de dentro, insere o ponto de interseção quando a aresta cruza.
Para entrada convexa a saída é convexa e **exata** — nenhum caso especial,
nenhuma auto-interseção possível.

`clipOut` remove uma região convexa dada como interseção de semiplanos: para
cada semiplano, guarda a parte de fora dele e segue com a parte de dentro. Os
pedaços que sobram são convexos e somam exatamente a área original menos a
região. É assim que o entalhe do T é feito. *(Entrega 2: substitui o
`clipOutBand`, que só removia uma faixa infinita — ver §7.2.)*

Peças com `area < AREA_EPSILON` são descartadas na saída de qualquer corte.

---

## 5. Bandas e segmentação

### 5.1 Parede reta

Da linha de referência saem dois deslocamentos:

| `referenceLine` | offset exterior | offset interior |
|---|---|---|
| `centerline` | −T/2 | +T/2 |
| `exteriorFace` | 0 | +T |
| `interiorFace` | −T | 0 |

onde T = soma das espessuras. A camada *k* ocupa a faixa entre os offsets
acumulados `d_k` e `d_{k+1}`, medidos a partir da face exterior. Cada camada é
**um retângulo** — convexo.

### 5.2 Parede em arco

Os offsets de um arco são arcos concêntricos (mesmo centro, raios r−d).
Segmentação determinística:

```
n = ceil(|θ| / (2 · acos(1 − ARC_SAG / r)))
```

Depende só de raio e ângulo — **nunca do zoom, nunca da vista**. Cada segmento
é um trapézio, convexo.

> **Regra crítica:** os pontos de corte das juntas são calculados na
> **circunferência exata** (interseção círculo–reta) e **entram na lista de
> parâmetros de segmentação antes de segmentar**. Segmentar primeiro e cortar
> depois é o que produzia a fresta no T contra a face curva. Nunca inverter a
> ordem.

---

## 6. Descoberta das juntas

`deriveJoins()` — pura, determinística. Paredes percorridas em ordem crescente
de `WallId`, sempre.

1. Descarta paredes com comprimento `< MIN_WALL_LENGTH` (aviso `WallTooShort`).
2. Pares candidatos por *bounding box* inflada em `POINT_TOLERANCE`.
3. Para cada par, só continua se as faixas de altura se sobrepõem.
4. Classifica:

| Condição | Resultado |
|---|---|
| ponta de *a* a `≤ POINT_TOLERANCE` de ponta de *b* | **EndJoin** |
| ponta de *a* dentro da banda de *b* (as faces com folga de `POINT_TOLERANCE`), com projeção a `> POINT_TOLERANCE` das duas pontas de *b* | **Abutment** (*a* encosta em *b*) |
| interiores se cruzam, longe das pontas das duas | **Crossing** |
| ângulo `< COLLINEAR_ANGLE` e sobreposição no comprimento | **nenhuma junta**, aviso `WallsOverlap` |

5. Agrupa EndJoins por aglomerado de pontos coincidentes (union-find com
   `POINT_TOLERANCE`) → nós. O nó é o ponto médio das pontas.
6. **Encosto mútuo** — a ponta de *a* está na faixa de *b* **e** a de *b* na
   faixa de *a*: não são dois T, é um canto em que as pontas passaram uma da
   outra. Vira **um canto**, com o nó na **interseção das linhas de
   referência**. Se esse nó fica a mais de `MITER_LIMIT × max(T)` de qualquer
   das pontas, as paredes correm lado a lado (quase em linha, sobrepostas) →
   aviso `WallsOverlap`. *(Achado do spike: tratar como dois T corta as duas
   paredes uma contra a outra e deixa o canto vazio.)*
7. Aplica os overrides: `allowJoin: false` remove a junta daquela ponta; a
   ponta passa a corte quadrado.

**Crossing** *(entrega 3)*: as linhas de referência se cruzam no interior das
duas paredes **e** nenhuma ponta de uma está dentro da faixa da outra (aí é T
ou canto, já tratados). Passa a de **núcleo mais grosso**; núcleos a menos de
`POINT_TOLERANCE` um do outro empatam, e passa o **menor `WallId`**. Nunca por
ordem de inserção. A espessura do núcleo é a **soma das camadas** do núcleo,
não a diferença dos offsets: um mesmo tipo em referências diferentes dá
diferenças de offset que variam em 1 ulp, e o empate se perdia.

**Arcos (cadeia de trechos, §5.2)** *(2026-10-24)*: os encontros entre trechos de
um mesmo arco não são pontas de parede. Três regras decorrem disso, cada uma com
o seu controle em `arcs.test.ts` (com a regra desligada, o caso falha):

- **Banda até o plano radial.** Numa ponta de trecho que encontra o trecho
  seguinte, a banda vai até o plano que os dois dividem ali (radial: a normal é a
  bissetriz das direções dos dois), não até a ponta quadrada. *Controle:* uma
  parede de 30 cm em x = 3 contra um arco de r = 3 (88 trechos, um encontro a 90°)
  terminava exatamente no encontro, não achava junta nenhuma e só avisava pela
  verificação final de sobreposição. O teste antigo "avisa" passava por acaso.
- **Encontro não forma nó com outras pontas.** Uma ponta de outra parede sobre o
  ponto de encontro de dois trechos fica fora do aglomerado deles: os dois
  trechos seguem como o canto da cadeia, e a ponta é livre, então encosta no arco.
  *Controle:* uma parede terminando em (3, 3) formava um nó de 3 com
  `ComplexJoin`.
- **Cruzamento dentro do mesmo T.** Uma parede cuja ponta encosta num arco pode
  cruzar a linha de referência de um trecho vizinho no caminho, inclinada. Isso é
  o mesmo T, não um X, quando o eixo dela fica dentro da banda do arco desse ponto
  até a ponta. *Controle:* o caso achado pela suíte de propriedade (parede de
  1,2 cm a 50°) era recusado como cruzamento.

---

## 7. Resolução por tipo de junta

### 7.1 Nó com 2 pontas — L

Sejam `u` e `v` as direções unitárias das duas paredes **saindo** do nó P, e θ
o ângulo entre elas. *(Regras revisadas pelo spike — ver §16.)*

- θ `< COLLINEAR_ANGLE` → paredes **dobradas uma sobre a outra** → sem junta,
  aviso `WallsOverlap`. *(Corte quadrado aqui sobrepõe as duas.)*
- θ `> 180° − COLLINEAR_ANGLE` → paredes em linha → **um único corte** pela reta
  que passa por P, perpendicular à direção média `u − v`. As duas usam a mesma
  reta, em lados opostos: sem fresta e sem sobreposição, com degrau se as
  espessuras diferem. *(Dois cortes quadrados separados abrem uma cunha.)*
- Senão, calcula os dois **cantos de face**: a interseção das duas faces
  internas e a das duas faces externas. A reta por esses dois pontos é a
  **linha de miter** — a diagonal do paralelogramo onde as faixas se cruzam. Os
  semiplanos das duas paredes são **complementares**, então sobreposição é
  impossível por construção, para qualquer referência e qualquer espessura.
- Se qualquer canto fica **além da ponta livre** de qualquer das paredes → o
  canto engole a parede curta → sem junta, aviso `WallsOverlap`.
  *(Esclarecimento de "ponta livre", 2026-10-24: num arco, o trecho da ponta
  não tem ponta livre no encontro com o trecho seguinte, porque o arco continua
  ali (§5.2: o arco é uma cadeia de trechos, não paredes soltas). A ponta livre
  dele é a outra ponta do arco, e o alcance é o comprimento da cadeia. O canto
  que passa do trecho da ponta, mas não da outra ponta do arco, é um L. A regra
  vale inteira para a ponta livre da reta e para a outra ponta do arco: passar
  delas continua sem junta, com aviso.)*
- θ ≥ 90° e algum canto a mais de `MITER_LIMIT × max(T)` de P → **corte único
  por P** (degrau). É o caso quase em linha com faces desalinhadas, em que o
  miter viraria uma rampa de metros.
- θ < 90° e o canto externo a mais de `MITER_LIMIT × max(T)` → mantém o miter e
  **chanfra a ponta** com um semiplano perpendicular a P→canto, a essa distância.
- **Miter ou butt** *(entrega 4, decisão do usuário)*: se a sequência de
  camadas **lida a partir da face externa do canto** é a mesma nas duas paredes
  (mesmas funções, espessuras a menos de `POINT_TOLERANCE`), o canto é o miter
  acima. Senão é **butt**: passa a parede de **núcleo mais grosso** (empate a
  menos de `POINT_TOLERANCE`: menor ID, a mesma regra do X). Uma parede desenhada
  ao contrário lê as camadas invertidas e por isso entra em butt.
- **Butt camada por camada** *(entrega 6, 25/10/2026, entre duas paredes retas)*:
  como o Revit limpa um L entre dois tipos, os núcleos se encontram, as camadas
  de fora dos núcleos **dão a volta no canto externo** e as de dentro se
  encontram no **canto interno**. Cada camada é "interna" (do lado do corpo da
  outra parede), "núcleo" ou "externa", e para numa linha da outra:
  - a que passa (*t*): externas na **face externa** da outra, núcleo na **face
    externa do núcleo** da outra, internas na **face interna do núcleo** da outra
    (o núcleo da outra passa por elas, como um núcleo passa acabamentos no T);
  - a que encosta (*c*): internas na **face interna** de *t*, núcleo na **face
    interna do núcleo** de *t*, externas **por cima do núcleo de *t*** até a
    **face externa do núcleo** de *t*.

  Assim nenhum acabamento interno nem núcleo nu aparece do lado de fora. Não há
  entalhe: nenhuma camada atravessa a faixa de outra. Sem camada `structure` o
  núcleo é a parede inteira e o canto vira um butt reto. *(Achado do teste de uso
  de 25/10/2026: como T, o reboco interno da parede que passa ia até a face
  externa da outra e o tijolo dela ficava exposto na quina.)*
- **Com o segmento de um arco**, e na passagem de um nó (§7.4), o butt continua
  o da entrega 4: a outra **encosta como um T**, com a regra de prioridade e o
  entalhe da §7.2, e a que passa é cortada inteira na face externa da outra.
  As cadeias dos arcos e os nós dependem disso (pendência em `docs/pendencias.md`).
- O butt cobre a **mesma região** do miter (faces externas até o canto externo,
  internas até o interno), então todas as regras de canto acima valem para ele.
  Ele tem mais pontos próprios: onde as **bordas da faixa de cada camada** das
  duas paredes encontram a linha em que ela para (no butt como T: o **canto do
  butt**, a face interna da que passa na face externa da outra, e os **pontos
  mais fundos** de cada camada que encosta).

  Qualquer desses pontos além de uma ponta livre → sem junta, aviso
  `WallsOverlap` (a ponta engole a parede curta). Ângulo θ ≥ 90° com algum deles
  a mais de `MITER_LIMIT × max(T)` de P → **corte único por P**, como no miter (a
  ponta reta viraria uma cunha de metros). No chanfro, o mesmo semiplano corta
  as duas paredes.
- Se `config` do override for `butt`: a parede com prioridade (override, senão
  núcleo mais grosso, senão menor ID) passa reto e é cortada quadrada; a outra é
  cortada na **face** da primeira.
- Se `config` for `squareOff`: corte quadrado nas duas.

> Não existe teste de "miter bem-formado" por sinal de projeção. A primeira
> versão tinha um, com folga de 1 mm, e ele rejeitava cantos normais com
> referência na face fora de 90°, caindo num degrau. O spike achou isso porque
> mediu a distribuição de regras nas cenas, não só o verde.

**Camadas** *(revisado na entrega 1)*: cada camada é a sua faixa, cortada pelos
**mesmos semiplanos** da parede. Cortar camada por camada é o mesmo que dividir
a parede cortada nas linhas das camadas, então as camadas ladrilham a parede
sem fresta nem sobreposição.

Não é preciso um miter por camada. O canto da linha a uma distância *s* da face
externa, nas duas paredes, anda linearmente com *s*: todos os cantos de camada
ficam **sobre a mesma diagonal** do canto externo ao interno. Então, se a
sequência de espessuras **lida a partir da face externa do canto** é a mesma
nas duas paredes, a camada *k* de *a* encontra a camada *k* de *b* ao longo da
diagonal — reboco com reboco, tijolo com tijolo. Isso vale para qualquer linha
de referência; o que importa é a ordem das camadas vista do canto. Uma parede
desenhada no sentido inverso (exterior virado para dentro do canto) lê as
camadas ao contrário, e por isso a sequência deixa de ser a mesma: vira butt
(acima). *(Até a entrega 4, sequências diferentes recebiam a mesma diagonal, e as
camadas se encontravam onde caíssem.)*

### 7.2 Abutment — T

Parede *a* encosta no flanco da parede *b*.

**Prioridade** *(entrega 4, regra do Revit)*: Estrutura 1, Substrato 2,
Térmica 3, Acabamento 1 = 4, Acabamento 2 = 5; 1 é a maior. Fica em
`LAYER_PRIORITY`, derivada da função.

- Camadas de **núcleo** de *a*: cortadas no semiplano da **face do núcleo** de
  *b*, do lado de onde *a* chega, passando por tudo o que está fora dele.
- **Demais** camadas de *a*: entram em *b* pela face externa e atravessam as
  camadas de *b* fora do núcleo, daquele lado, enquanto a prioridade delas for
  **estritamente menor**; param na primeira de prioridade **igual ou maior**, e
  no núcleo de *b* no máximo (a face do núcleo é sempre uma camada `structure`).
  Cada uma é cortada no semiplano da face onde parou.
- Cada camada de *b* fora do núcleo, daquele lado, recebe um **entalhe**
  (`clipOut`) que é **exatamente a região das camadas de *a* que a
  atravessam**: para cada sequência contígua delas, a sua faixa, do lado de
  dentro da ponta livre de *a*. As que atravessam não precisam ser vizinhas
  (térmica, acabamento 2, núcleo contra um acabamento 2: a térmica e o núcleo
  passam, o acabamento 2 de *a* para), e então a camada de *b* fica com um
  pedaço entre elas. *(Achado da entrega 2: com uma faixa infinita, uma parede
  curta, grossa e rasa cuja ponta livre cai dentro do acabamento da hospedeira
  deixava uma fresta — o entalhe continuava onde o núcleo já tinha terminado.)*
- Sem camada `structure`, o núcleo é a parede inteira: tudo vai até a face do
  núcleo da hospedeira. Se a hospedeira não tem acabamento daquele lado, não há
  entalhe e o corte é o da face.

A região total coberta não muda: o que cada entalhe tira é preenchido pela
camada que passa. Por isso o oráculo de região do T vale sem mudança.

Resultado: reboco encontra reboco, tijolo encontra tijolo. É o mesmo princípio
da *Building Material priority* do ArchiCAD (a pele de prioridade maior corta a
menor) e da *Function* da camada no Revit.

A ponta de *a* **nunca** ultrapassa a face oposta de *b*: o corte é sempre um
semiplano com a normal apontando para dentro de *a*, então a penetração é
exatamente zero por construção, não por tolerância.

### 7.3 Crossing — X

A parede cortada vira **trechos**, um de cada lado de cada cruzamento,
ordenados ao longo dela (uma parede cruzada *k* vezes tem *k* + 1 trechos). Cada
lado de um cruzamento é um T contra a parede que passa: o trecho tem a mesma
normal e os mesmos offsets da parede inteira, então `resolveAbutment` serve sem
mudança. A parede que passa recebe o entalhe de cada lado. A região coberta é
a união das duas faixas: o X só redistribui o material.

Para IFC, o X não tem par padrão em `IfcRelConnectsPathElements` (L é
ATSTART/ATEND, T é ATPATH + ATSTART); exporta-se como dois T.

### 7.4 Nó com 3 ou 4 pontas

1. Procura o par de pontas mais próximo de colinear (ângulo entre direções mais
   próximo de 180°, dentro de 10°). Esse par vira uma **passagem** única: as
   duas paredes se unem entre si como um L (§7.1: corte único quando em linha,
   miter ou butt).
2. As demais pontas viram **abutments** contra essa passagem (§7.2, com
   prioridade), mas só quando isso é exato *(entrega 5)*:
   - **contra uma parede só**: tudo o que a ponta põe dentro dela (os pontos na
     face próxima e os pontos mais fundos das camadas) fica do lado dela no
     corte da passagem e aquém da ponta livre dela, e nada da ponta além da face
     toca a outra parede da passagem. Não vale se essa parede é a que encosta
     num butt da passagem;
   - **contra as duas**, quando a passagem está em linha e as duas mostram as
     mesmas camadas e as mesmas linhas daquele lado: corta numa, entalha as
     duas. "As mesmas linhas" quer dizer que a diferença só produziria lascas
     menores que `AREA_EPSILON`, que o motor já descarta, na zona do encontro.
     Diferença bit a bit de arredondamento numa passagem desenhada em qualquer
     direção não pode virar aviso.

   Fora disso a ponta fica com corte quadrado e aviso `ComplexJoin` (a parede
   que encosta e as duas da passagem). Desenhar algo que se sobrepõe seria pior.
3. Se não houver par quase-colinear, a passagem é formada pelas duas paredes de
   **núcleo mais grosso** (a regra do X: empate a menos de `POINT_TOLERANCE`,
   menor ID).
4. Nó com **mais de 4 pontas**: corte quadrado em todas, aviso `ComplexJoin`.
   (O Revit também limita a configuração de junta a 4 paredes ou menos.)

### 7.5 Alturas diferentes

Para cada parede, monta o conjunto de cotas
`Z = {base própria, topo próprio} ∪ {bases e topos dos vizinhos unidos}`,
recortado ao intervalo próprio e deduplicado com `POINT_TOLERANCE`.

Cada intervalo `[z_i, z_{i+1}]` é uma **slice**. A pegada de cada slice é
calculada **só com os vizinhos vivos naquela faixa de altura**. Slices
adjacentes com pegada idêntica são fundidas.

Isso elimina o limite conhecido "paredes unidas com alturas diferentes: a face
de encontro fica oculta no 3D": a face passa a existir de verdade, só na parte
onde o vizinho não está.

*(Decisão de implementação, 2026-10-24: as cotas são as de todas as paredes do
pavimento, não só as dos vizinhos. Dá o mesmo resultado, porque uma parede que
não encosta não muda a pegada, e as slices iguais seguidas são fundidas.)*

**Planta (2026-10-24, revisado pelo VIGIA):** a planta é um corte na **altura
de corte** do pavimento (ref/chat.txt:118, "linhas cortadas e vistas
distintas"), 1,20 m acima da cota do pavimento por padrão (`CUT_HEIGHT`, como o
view range do Revit). Ela é guardada no pavimento (`cutHeight`, opcional) e
editada na caixa de Pavimentos.
- A parede que **atravessa** a altura de corte mostra a slice que a contém,
  cortada (preenchida, com as camadas).
- A parede **abaixo** dela (topo na altura de corte ou abaixo) aparece **em
  vista**: a sua slice mais alta, só o contorno fino, sem preenchimento.
- A parede **acima** dela (base na altura de corte ou acima) aparece em vista
  com a sua slice mais baixa, em contorno tracejado.

Começar ou terminar exatamente na altura de corte não é atravessar. A primeira
versão mostrava a slice mais baixa, e com ela uma parede sobre `baseOffset`
aparecia sobreposta à vizinha. No corte, as duas ficam em meia-esquadria.

---

## 8. Pegada e sólido

```ts
interface Piece  { layerIndex: number; polygon: ConvexPolygon; cutFaces: FaceTag[] }
interface Slice  { zBottom: number; zTop: number; pieces: Piece[] }
interface Footprint { wallId: WallId; slices: Slice[] }

function footprint(wall: Wall, graph: JoinGraph, ctx: Context): Footprint;
```

Pipeline, por parede e por slice:

1. bandas por camada (§5) → peças convexas
2. para cada junta que toca esta parede, monta a lista de semiplanos e faixas (§7)
3. aplica `clipHalfPlane` / `clipOutBand` em sequência
4. descarta peças com área `< AREA_EPSILON`

**A ordem dos cortes não importa** — interseção de semiplanos é comutativa.
Isso é verificável (invariante I4) e é o que torna o motor estável sob
reordenação da entrada.

**3D:** cada peça convexa de cada slice vira um prisma extrudado de `zBottom` a
`zTop`. As peças são disjuntas por construção, então **não existe booleana no
3D** — a malha é a concatenação dos prismas.

**Faces de corte:** cada aresta cortada carrega um `FaceTag`:

| Tag | Renderização |
|---|---|
| `join` (corte vindo de uma junta permitida) | **não renderizada** — o vizinho ocupa o espaço |
| `freeEnd` (corte quadrado sem junta) | renderizada, com os materiais reais da seção |
| `layer` (interface entre camadas) | não renderizada |

É isso que elimina os pontinhos laranja nos encontros, mantendo o corte
cerâmico visível numa ponta solta — que é o comportamento correto.

**Planta:** preenche cada peça sem traço e desenha só as arestas que **não** são
`join` nem `layer`. Resultado: contorno único, sem linha entre paredes unidas,
**sem nenhuma união booleana**.

---

## 9. Comportamento em caso inválido

O motor **nunca lança exceção, nunca devolve geometria vazia e nunca apaga uma
parede**. Em todo caso duvidoso ele desenha o melhor que consegue e emite um
aviso, que o painel mostra em EN e PT. É o que Revit ("Highlighted walls
overlap") e ArchiCAD ("Check for Linear Overlaps") fazem.

| Aviso | Quando |
|---|---|
| `WallTooShort` | comprimento `< MIN_WALL_LENGTH` |
| `WallsOverlap` | paredes paralelas sobrepostas no comprimento |
| `ComplexJoin` | nó com mais de 4 pontas |
| `MiterTooLong` | miter cortado quadrado por exceder `MITER_LIMIT` |
| `JoinDisallowed` | override do usuário removeu a junta |

---

## 10. Tabela de casos degenerados

Esta tabela **é** a resposta aos casos que travaram a tentativa anterior.
Caso degenerado não se resolve com geometria mais esperta; resolve-se com uma
regra que o elimina.

| Condição | Regra |
|---|---|
| ângulo `< 0,6°` (dobradas) | sem junta; `WallsOverlap` |
| ângulo `> 179,4°` (em linha) | um único corte por P, compartilhado; degrau se espessuras diferem |
| obtuso, canto além de `10 × max(T)` | um único corte por P (degrau) |
| agudo, ponta externa além de `10 × max(T)` | miter com chanfro na ponta |
| canto além da ponta livre de uma das paredes | sem junta; `WallsOverlap` |
| sequências de camadas diferentes no canto | butt: o núcleo mais grosso passa, a outra encosta como T |
| butt: canto próprio ou camada que encosta além de uma ponta livre | sem junta; `WallsOverlap` |
| butt obtuso, canto próprio além de `10 × max(T)` | um único corte por P (degrau) |
| ponta de cada uma dentro da faixa da outra | um canto, nó na interseção das linhas de referência |
| idem, com o nó a mais de `10 × max(T)` das pontas | sem junta; `WallsOverlap` |
| comprimento `< 1 mm` | parede inválida; não participa de junta |
| paredes paralelas sobrepostas | sem junta; `WallsOverlap` |
| ponta a `< 1 mm` de uma ponta da hospedeira | é EndJoin, não T |
| as duas pontas dentro da mesma hospedeira | a parede está dentro dela; sem junta; `WallsOverlap` |
| peça com área `< 1e-9 m²` | descartada |
| nó com > 4 pontas | todas quadradas; `ComplexJoin` |
| faixas de altura sem sobreposição | sem junta |
| arco com raio `< T` (offset degenerado) | parede inválida; aviso |

---

## 11. Invariantes

São o contrato do motor. Cada um é verificável **sem reimplementar o motor**.

| | Invariante | Como verificar |
|---|---|---|
| **I1** | Peças de paredes distintas não se sobrepõem | amostragem em grade de 0,1 mm, contando coberturas |
| **I2** | `volume(malha) = Σ área(peça) × altura(slice)` | medida no mesh final, independente do gerador |
| **I3** | Sem fresta: num disco de raio `min(T)` centrado num nó com junta permitida, todo ponto coberto pelas bandas não-cortadas e a `≥ 1 mm` da fronteira externa está coberto por **exatamente uma** peça | mesma grade de I1 |
| **I4** | Determinismo e comutatividade: permutar a ordem das paredes na entrada não muda a saída, bit a bit | roda duas vezes, compara golden file |
| **I5** | Reversibilidade: mover uma parede por δ e voltar reproduz a geometria original exatamente | comparação de golden file |
| **I6** | Penetração zero no T: a ponta que encosta não ultrapassa a face da hospedeira — **por construção**, não por tolerância | assertiva de sinal do semiplano |
| **I7** | Topologia: a planta de uma cena fechada tem o número esperado de contornos e furos | contagem de componentes |
| **I8** | Cada peça de camada fica dentro da faixa da própria camada | offsets das camadas calculados pelo oráculo, conferidos em cada vértice |
| **I10** | No T, entre a face externa e a face do núcleo da hospedeira, dentro da faixa da parede que encosta e antes da ponta livre: onde o núcleo passa, só o núcleo cobre; no resto, só a hospedeira | 400 pontos sorteados por T, com trava contra teste vazio |
| **I9** | Continuidade: no miter entre paredes com a mesma sequência de camadas vista do canto, a camada *k* encontra a camada *k* | 200 pontos ao longo da diagonal, dos dois lados; o teste exige um mínimo de cantos e pontos conferidos, para não passar vazio |

> **I1 e I3 usam amostragem em grade, e não as primitivas de `convex.ts`.** Foi
> exatamente o contrário disso — um "verificador independente" escrito com os
> mesmos pressupostos do motor — que deixou os defeitos passarem antes. O
> oráculo não pode compartilhar código com o que ele julga.

---

## 12. Testes

### 12.1 Três camadas

**A. Suíte visível** — `tests/elements/wall/`

Mesa de casos por tipo de junta, com a **geometria esperada escrita à mão**,
não gerada pelo motor:

- L a 90°, 120°, 30°, 5°, 0,3° (degenerado), nas 3 referências, 15 e 20 cm
- T reto, T oblíquo, T de 15 em 20 cm, T com arco como hospedeira
- X iguais, X 20 cruza 15, X oblíquo
- nó de 3 pontas (colinear + 1), nó de 4 pontas, nó de 5 pontas (aviso)
- alturas diferentes: 2 slices, 3 slices
- arco + reta; arco + T no meio do arco
- sala 8×6 fechada com divisória interna

**B. Propriedade** — fast-check, verifica I1–I7

Gerador de cenas em dois modos:

- `normal`: paredes de 1 a 12 m, ângulos de 15° a 165°
- `degenerate`: ângulos de 0,1° a 5°, pontas a 0,1–2 mm umas das outras,
  paredes de 2 mm, arcos de raio próximo da espessura

CI roda 200 casos com seeds fixas; a noturna roda 20 000 com seeds aleatórias e
grava toda falha como caso de regressão permanente.

**C. Suíte held-out** — `tests-holdout/`, **fora do repositório de trabalho**

Cenas compostas que o agente nunca lê e nunca roda: casa de dois pavimentos
completa, 4 paredes num nó com 3 tipos diferentes, arco encostando em arco.
Rodada só pelo revisor.

Justificativa: o [SpecBench](https://arxiv.org/html/2605.21384v1) mostra que
todos os modelos saturam a suíte visível, e que o *reward hacking* aparece
justamente como a diferença entre a suíte visível e uma held-out. Enriquecer a
suíte visível **não** resolve de forma confiável.

### 12.2 Mutation testing

Stryker sobre `src/elements/wall/geometry/` e `src/elements/wall/join/`.

- portão: score ≥ 90% no pacote
- portão: **zero mutantes sobreviventes** em `convex.ts`, `cut-l.ts`,
  `cut-t.ts`, `cut-x.ts`

Cobertura de linha não vale como prova: a literatura de mutação registra 13
mutantes sobreviventes num arquivo com 100% de cobertura de statements.

### 12.3 Golden files

Cada cena grava os vértices em **micrômetros inteiros** (`Math.round(x * 1e6)`).
Mudança de geometria vira um diff legível na revisão, em vez de uma imagem que
"parece igual". Imagem é complemento, não a prova.

### 12.4 Regressão visual

- **Planta:** compara o **SVG** (estrutura), com tolerância **zero**.
- **3D:** compara bitmap com tolerância pequena, só para pegar cor e sombra.

Tolerância de 20 px num bitmap esconde uma fresta de 15 cm numa vista afastada.

---

## 13. Portões de CI (anti-fraude)

Estes portões existem porque a tentativa anterior passou com "isenções e
tolerâncias frouxas" e só foi pega numa auditoria manual.

1. Commit que toca `src/` **e** `tests/` ao mesmo tempo é **rejeitado** por hook.
   Teste novo entra em commit `test:` sozinho, e tem que falhar antes.
2. `src/core/tolerance.ts` só muda junto com um ADR novo; o CI confere.
3. Lint proíbe em teste: `it.skip`, `it.todo`, `expect.soft`, `try/catch`,
   `toBeCloseTo` com precisão menor que a tolerância declarada.
4. CI roda de checkout limpo, com `npm ci`, sem cache.
5. O relatório de cada etapa publica: nº de testes, score de mutação, e o
   **diff do golden file**. "Passou" sem esses três números não conta.
6. A suíte held-out é rodada pelo revisor, não pelo agente.

---

## 14. Estrutura de arquivos

Cada arquivo abaixo de ~400 linhas, tudo dentro da pasta do elemento, sem
`utils/` nem `helpers/`, conforme as regras do projeto.

```
src/core/tolerance.ts

src/elements/wall/
  schema.ts                  // Wall, WallType, WallLayer, WallJoinOverride
  commands.ts                // createWall, moveWall, setJoinOverride, ...
  geometry/
    convex.ts                // clipHalfPlane, clipOutBand, area      (o núcleo exato)
    offset.ts                // linha de referência -> bandas por camada
    arc.ts                   // segmentação determinística, cortes na circunferência
    slices.ts                // fatiamento por altura
    footprint.ts             // orquestra: bandas -> cortes -> peças
  join/
    discover.ts              // deriveJoins
    node.ts                  // nós de 2, 3, 4 e 5+ pontas
    cut-l.ts                 // miter / butt / squareOff
    cut-t.ts                 // abutment + entalhe
    cut-x.ts                 // crossing
  panel.ts
  tool.ts
  index.ts                   // registro na lista única de elementos

tests/elements/wall/         // suíte visível
tests-holdout/               // fora do repo de trabalho
```

Nada em `geometry/` ou `join/` importa three.js, DOM, rede ou armazenamento.

---

## 15. Ordem de implementação — com portão

### Dia 0 — spike de 4 horas, critério binário

Implementar **só**: `convex.ts`, `offset.ts`, miter em L e abutment em T, para
paredes retas de uma camada. Rodar o gerador de propriedade com **2 000 cenas**
nos modos normal e degenerado, verificando **I1, I3 e I6**.

- **Verde** → a abordagem está provada; segue o resto.
- **Vermelho** → a abordagem é **rejeitada** e paramos para decidir juntos.
  Nada mais é construído antes.

Esse portão é o que faltou da última vez: a etapa 7 entrou na fila como se
fosse igual às outras, foi "concluída" três vezes e custou três rodadas de
revisão antes de alguém descobrir que o kernel estava errado.

### Depois do portão

| # | Entrega | Pronto quando |
|---|---|---|
| 1 | camadas + núcleo; L com camadas | mesa de casos L verde |
| 2 | T com entalhe | mesa T verde + I6 por construção |
| 3 | X | mesa X verde |
| 4 | nós de 3, 4 e 5+ pontas | mesa de nós verde |
| 5 | arcos (segmentação após cortes) | mesa de arcos verde + I1/I3 no modo degenerado |
| 6 | slices de altura | mesa de alturas verde + I2 |
| 7 | 3D com `FaceTag` | I2 no mesh + captura revisada |
| 8 | planta sem booleana | I7 + SVG golden |
| 9 | overrides (disallow / butt / miter / squareOff) | mesa de overrides verde |
| 10 | mutação ≥ 90%, zero sobreviventes no núcleo | relatório Stryker |

Cada entrega publica os três números do §13, item 5 (testes, score de mutação,
diff do golden file). Nenhuma entrega "quase pronta".

---

## 16. Resultado do spike do Dia 0 — 24/10/2026

**Portão: verde.** A abordagem está provada para L e T em paredes retas de uma
camada.

| Medida | Resultado |
|---|---|
| Mesa de casos (geometria calculada à mão) | 22/22 |
| Primitivas de recorte | 9/9 |
| Propriedade, seed fixa do CI | 2 000 cenas, 6/6 grupos |
| Propriedade, 6 seeds novas × 10, no código final | 120 000 cenas, sem falha |
| Mutantes injetados no motor | 20/20 detectados |

Cenas por grupo: L normal 400, L degenerado 400, T normal 300, T degenerado
300, canto cruzado 300, sala com divisória 300. Na seed fixa, o L normal exercita
397 miters e 3 avisos; o L degenerado, 176 miters, 9 chanfros, 53 cortes únicos
e 162 avisos de sobreposição; o canto cruzado, 300 miters. A sala varia referência e espessura
por parede e o sentido do desenho de cada uma.

**Quatro furos que o spike achou nesta própria spec** (já corrigidos acima):

1. "Corte quadrado nas duas" para ângulo `< 0,6°` sobrepõe as paredes, e para
   `> 179,4°` abre uma cunha. → aviso, e corte único compartilhado.
2. "Corte quadrado" quando o miter passa do limite sobrepõe as paredes num
   canto agudo. → chanfro no agudo, degrau no obtuso.
3. O teste de "miter bem-formado" por sinal de projeção rejeitava cantos
   normais com referência na face. → removido; o miter é seguro por construção.
4. Encosto mútuo não estava previsto: virava dois T e deixava o canto vazio.
   → vira canto; ou aviso, se o cruzamento fica longe das pontas.

**Dois erros meus no oráculo**, também achados pelos testes e corrigidos no
oráculo, não no motor: o T assumia a ponta livre inteira fora da face (uma
parede curta e grossa em ângulo raso mergulha o canto 30 µm), e o L contava um
hexágono dobrado quando o canto passava da ponta livre.

**Um teste que faltava, achado pela mutação:** com coordenadas de obra em UTM
(10⁶ m), a interseção a 3×10⁻¹¹ m de um vértice arredonda para o próprio
vértice. A deduplicação já existia; nenhum teste a exercitava. Agora tem.

**O que o spike não cobre ainda:** camadas e entalhe do T, X, nós de 3 e 4
pontas, arcos, alturas, 3D e planta. Segue a ordem do §15.

### Entrega 1 — camadas e núcleo

A parede guarda só `wallTypeId`; espessura, faixas de camada e núcleo saem de
`shapeOf()` a cada cálculo (`geometry/shape.ts`). Tipo ausente ou inválido gera
aviso (`missingWallType`, `invalidWallType`), a parede não é desenhada e as
outras seguem normalmente.

| Medida | Resultado |
|---|---|
| Testes (mesa à mão + recorte + camadas + propriedade) | 46/46 |
| I9 na seed fixa | 726 cantos, 144 326 pontos, nenhum descasamento |
| Mutantes | 27/27 detectados (os 20 anteriores + 7 de camada) |
| Propriedade, 6 seeds novas × 10 | 120 000 cenas, sem falha; I9 em 40 512 cantos e 8 052 084 pontos |

Todas as cenas aleatórias agora têm tipos de 1 a 4 camadas com funções
sorteadas, e metade dos L, dos cantos cruzados e das salas usa o mesmo tipo nas
duas paredes. O oráculo passou a contar **peças**, não paredes: duas camadas da
mesma parede se sobrepondo reprovam.

Achado desta entrega: a regra da spec ("mesmo tipo **e** mesma referência")
era mais estreita que o necessário e errada no critério. O que decide é a
sequência de camadas vista da face externa do canto (§7.1).

### Entrega 3 — X

| Medida | Resultado |
|---|---|
| Testes | 69/69, suíte inteira em 8 s |
| Mutantes | 41/41 detectados |
| Propriedade | seed fixa e mais 2 seeds novas, 2 000 cenas cada, sem falha |

Achados:

1. **Defeito do motor:** empate de núcleo comparado por igualdade de float, com
   a espessura tirada da diferença de offsets. Mesmo tipo em referências
   diferentes não empatava. → soma das camadas e tolerância de 1 mm. Dois
   casos fixos na mesa cobrem cada metade da defesa.
2. **Erro no oráculo:** peças atribuídas ao lado do cruzamento pela posição ao
   longo da parede cortada; em ângulo raso, uma camada do lado de lá tem o
   centro antes do cruzamento. → classificar pelo lado da linha média do
   núcleo da parede que passa.
3. **Gerador quase inútil:** o fast-check favorece as pontas dos intervalos, e
   o cruzamento caía na ponta da parede (que é T, não X). 1 227 638 de 1 227 644
   cenas eram rejeitadas e a suíte passou de 8 s para mais de 8 minutos. →
   cruzamento sorteado só no interior (15–85%).
4. **Mutante equivalente esclarecido:** "núcleo por diferença de offsets", sozinho,
   não muda nada, porque a tolerância já absorve 1 ulp. O mutante que importa é
   tirar a tolerância, e ele é morto por dois núcleos a 0,5 mm um do outro.

### Entrega 5 — nós com 3, 4 e 5+ pontas

| Medida | Resultado |
|---|---|
| Testes | 133/133 no `npm run check` final (o total inclui os testes que a sessão da interface vem acrescentando) |
| Casos à mão novos ou mudados | 11 em `nodes.test.ts` e 1 em `joins.test.ts`, todos vermelhos antes |
| Cena aleatória de nó | 300 cenas; I10 em 220 troncos (piso: 100); vermelha no motor anterior |

Achados:

1. **Regra que faltava:** um tronco que cruza o nó passa por cima das duas
   paredes da passagem. Encostar só numa deixava a outra sem entalhe, com
   sobreposição. → as duas regras de exatidão acima, e aviso fora delas.
2. **Critério que não podia ser exato:** comparar as linhas da passagem com
   `===` fazia toda passagem desenhada em direção qualquer cair no aviso, pelo
   arredondamento. → igualdade medida pelo que o motor já descarta
   (`AREA_EPSILON`).
3. **Limite conhecido:** um Y sem par em linha, com o terceiro ramo cruzando o
   canto da passagem, cai no aviso `ComplexJoin`. O Revit também não documenta
   regra para esse caso (§17).

Por pedido do usuário não houve seeds extras, rodadas grandes nem laço de
mutantes nesta entrega; o portão foi o `npm run check`.

### Entrega 6 — butt camada por camada no L entre paredes retas

Pedido do usuário no teste de uso de 25/10/2026 ("olha o que aconteceu com o
canto da parede"): numa casa de Alvenaria 15 cm, uma parede trocada para
Alvenaria 20 cm deixava, na quina, o reboco interno dela na face externa da casa
e o tijolo à mostra. Era a regra da entrega 4 funcionando como escrita: a que
passa ia inteira até a face externa da outra.

| Medida | Resultado |
|---|---|
| Oráculo novo (`buttRule`, `buttPenetration`, `buttOwnership` em `oracle-x.ts`) | cada camada das duas paredes para na sua linha; cada ponto da sobreposição das faixas é da camada que a regra dá |
| Seed fixa | 1 403 cantos em butt, 418 710 pontos conferidos (pisos: 600 e 20 000) |
| Seeds 1, 777 e 4242 | sem falha; 1 443 a 1 451 cantos, 431 a 434 mil pontos |
| Mutantes à mão | reboco interno de *t* até a face externa (o defeito) e reboco externo de *c* parando na face de *t*: os dois pegos |
| Casos à mão refeitos | 5 (`layers.test.ts`), com os valores trabalhados de novo; a parede de 2 cm que avisava como T agora fecha |

### Entrega 4, parte 2 — butt no L entre sequências diferentes

Decisão do usuário, 24/10/2026: no L entre tipos diferentes, butt com a regra
de prioridade (§7.1). Com a mesma sequência, o miter fica.

| Medida | Resultado |
|---|---|
| Testes | 80/80, suíte inteira em ~8 s |
| Casos à mão novos ou mudados | 8, e 1 regressão fixa |
| Butt conferido como T (I6 por camada e I10) | 1 395 cantos na seed fixa (piso: 600) |
| Seeds extras (1, 777, 4242, 9, 31337), 2 000 cenas cada | sem falha no código final |
| Mutantes de `cut-l.ts` | 12/12 detectados (um sobreviveu de início: o caso de 1 mm era fraco e foi reforçado) |

Achados, todos pelo gerador e não pela mesa:

1. **Regra que faltava:** o butt tem um canto que o miter não tem. A ponta reta
   da parede que passa alcança a face externa da outra na largura toda, e o
   canto dessa largura caía 0,05 mm além da ponta livre de uma parede curta. →
   aviso, como o canto do miter.
2. **Regra que faltava:** a 177°, paredes de 5 cm, esse mesmo canto ficava a
   1,1 m do nó. A cunha virava lascas abaixo de `AREA_EPSILON`, que eram
   descartadas e abriam fresta. → corte único, como o miter obtuso.
3. **Regra que faltava** (seed 1): o núcleo que encosta entra nos acabamentos da
   que passa, como num T, mas a que passa era curta. O núcleo saía 0,12 mm além
   da ponta livre dela. → os pontos mais fundos das camadas que encostam também
   não podem passar das pontas.
4. **Erro meu num teste:** um vértice procurado com `===` num valor calculado.
   Corrigido no teste.
5. **Erro meu no oráculo** (rodada de 20 000 cenas, seed 55555): no butt a
   hospedeira do I10 é a parede que passa, que pode ser curta, e o I10 amostrava
   além da ponta livre dela. → o I10 só vale ao longo da hospedeira; a cena virou
   regressão fixa. Por pedido do usuário, rodadas grandes e laços de mutantes
   saíram do ciclo; fica o `npm run check`.

### Entrega 4, parte 1 — prioridade de camadas no T e no X

A regra foi conferida de novo na página da Autodesk ("Function and Priority of
a Layer", 2026) antes de implementar: camada de prioridade menor não atravessa
camada de prioridade igual ou maior; camada do núcleo vai até o núcleo da outra
parede mesmo com prioridade 5. O X usa a mesma regra, porque cada lado é um T.

| Medida | Resultado |
|---|---|
| Testes | 73/73, suíte inteira em ~8 s |
| Casos à mão novos ou mudados | 5, todos vermelhos no motor antigo |
| Prioridade exercitada na seed fixa | 553 T, 11 178 pontos com uma camada fora do núcleo atravessando a hospedeira (piso: 300 e 5 000) |
| Seeds extras (1 e 777), 2 000 cenas cada | sem falha |
| Mutantes da lógica nova | 10/10 detectados |

Os 41 mutantes das entregas anteriores **não foram rodados de novo** nesta
parte. Eles não estão gravados no repositório: eram injeções manuais. Os 10
desta parte estão listados na mensagem do commit.

Mudou o comportamento esperado de dois casos da mesa: o acabamento 1 de uma
parede que encosta no lado do acabamento 2 da hospedeira agora atravessa até o
núcleo (4 é maior que 5). Antes ele parava na face. É a divergência que a §17
apontou, não um afrouxamento.

**Parte 2, o L:** ver abaixo.

**Numeração:** a §17 pôs a prioridade como entrega 4. A tabela da §15 ainda
lista os nós de 3 a 5+ pontas como entrega 4, e eles passam a ser a 5; as
seguintes descem uma posição.

### Entrega 2 — T com núcleo e entalhe

O núcleo da parede que encosta vai até a face do núcleo da hospedeira, os
acabamentos param na face externa, e as camadas da hospedeira entre as duas
recebem o entalhe exato do núcleo (§7.2). A região total coberta não muda — o
entalhe é preenchido pelo núcleo — então o oráculo de região de antes continua
valendo, e entram I6 por camada e I10.

| Medida | Resultado |
|---|---|
| Testes | 56/56 |
| I10 na seed fixa | 741 T, 75 008 pontos |
| Mutantes | 34/34 detectados |
| Propriedade, 6 seeds novas × 10 | 120 000 cenas, sem falha; I10 em 43 222 T e 4 340 175 pontos |

Achados:

1. **Defeito do motor:** o entalhe como faixa infinita deixava fresta quando a
   ponta livre de uma parede curta, grossa e rasa caía dentro do acabamento da
   hospedeira. → `clipOut` com a região exata do núcleo.
2. **Regra que faltava:** parede com as duas pontas dentro da mesma hospedeira
   sumia e deixava entalhes vazios. → aviso, sem junta.
3. **Erro no oráculo:** o I10 também esquecia a ponta livre. Corrigido no
   oráculo.
4. **Cobertura:** com funções de camada sorteadas, só ~21% das hospedeiras
   tinham acabamento do lado do T, e a trava contra teste vazio reprovou. O
   limite não foi baixado; metade dos tipos gerados passou a ser
   acabamento/núcleo/acabamento.

---

## 17. Pesquisa de referências e decisões (entrega 3)

| Pendência | Revit / ArchiCAD / hito | Decisão |
|---|---|---|
| Camadas entre tipos diferentes; camadas fora do núcleo | Revit: cada camada tem prioridade (pela função, Estrutura 1 … Acabamento 2 = 5); as de prioridade maior se ligam primeiro e **atravessam** as de prioridade menor para achar a de mesma prioridade da outra parede; não atravessam prioridade igual ou maior; camadas do núcleo vão até o núcleo da outra parede passando por tudo fora dele; mesmo material limpa, material diferente deixa linha. ArchiCAD: "Intersection Priority" do material, empate pela "Junction Order" da parede (0–16). | **Adotar o modelo de prioridade** (entrega 4). O atual bate com ele no T (núcleo até o núcleo) e no L de mesmo tipo (camada *k* com *k*), e diverge em duas coisas: uma camada de prioridade alta fora do núcleo deve atravessar o acabamento da outra parede, e o L entre tipos diferentes deve casar camadas por prioridade, não por uma diagonal só. |
| Alturas diferentes | Revit tem limitação conhecida com miter entre alturas diferentes; o contorno documentado pelos usuários é fatiar a parede alta na altura da baixa. hito fatia. | Confirma §7.5. |
| Nó com 3+ paredes | Revit não documenta regra; a Autodesk desaconselha a ferramenta de junta com mais de 4 paredes. No ArchiCAD, usuários recorrem a remendos 2D. | Manter a regra do hito (§7.4). |
| Arco com reta | Revit faz miter; algoritmo não documentado. | Manter: cantos na circunferência exata (§5.2). |
| Desfazer junta | Revit: "Disallow Join" por ponta, persiste mesmo se a parede for movida; exibição Clean / Don't Clean. | Confirma §2.3 (override por ponta). |

Fontes desta seção: [Autodesk — Function and Priority of a Layer](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-1CCD1005-CBDA-4338-8D60-489095D4BB25.htm),
[What Revit Wants — Wall layers and their ability to barge](https://wrw.is/wall-layers-and-their-ability-to-barge/),
[MGFX — Revit 2026 changes to layer function and priority](https://mgfx.co.za/blog/building-architectural-design/revit-2026-changes-to-wall-structure-layer-function-and-priority/),
[Graphisoft — Specific Element Intersections and Junctions](https://help.graphisoft.com/AC/24/INT/_AC24_Help/040_ElementsVB/040_ElementsVB-268.htm),
[Graphisoft Community — Plaster priority in wall junction](https://community.graphisoft.com/t5/Design-forum/Plaster-priority-in-wall-junction/td-p/259039),
[Autodesk — Specify Wall Join Cleanup Options](https://knowledge.autodesk.com/support/revit-products/learn-explore/caas/CloudHelp/cloudhelp/2018/ENU/Revit-Model/files/GUID-130A65BC-8C57-4C31-8C07-F96041771539-htm.html),
[Autodesk Ideas — Wall join behavior when using miter](https://forums.autodesk.com/t5/revit-ideas/wall-join-behavior-when-using-mitter/idc-p/11186644/highlight/true),
[buildingSMART — IfcConnectionTypeEnum](https://standards.buildingsmart.org/IFC/DEV/IFC4_3/HTML/lexical/IfcConnectionTypeEnum.html).

**Mudança de processo:** a rodada de 120 000 cenas por entrega não achou
nenhuma falha em três entregas; todos os achados vieram da suíte de 2 000
cenas, da contagem de regras e dos mutantes. Ela continua disponível
(`FUZZ_SCALE=10`) para rodar à noite, e saiu do ciclo de cada entrega.

---

## 18. Fontes

- [Clipper2 — Robustness](https://angusj.com/clipper2/Docs/Robustness.htm) — por que booleana em float produz sliver e fresta
- [hito PR #205 — domínio de juntas de parede](https://github.com/hito-project/hito/pull/205) — a arquitetura de referência
- [hito #206 — disallow join e tipo de junta](https://github.com/hito-project/hito/issues/206)
- [Revit — About Wall Joins](https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-6B18982C-1FBA-4E5C-AE30-6FAE4022CE35.htm) — butt padrão, limite de 4 paredes
- [Revit — Change the Configuration of a Wall Join](https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-19EAF7A9-331F-4271-94CC-43B76B13011E.htm) — miter / butt / square-off
- [Graphisoft — How Walls are Connected in Archicad](https://community.graphisoft.com/t5/Getting-started/How-Walls-are-Connected-in-Archicad/ta-p/303922) — prioridade de material entre camadas
- [SpecBench (arXiv 2605.21384)](https://arxiv.org/html/2605.21384v1) — suíte visível satura; held-out mede o buraco
- [Mutation testing com Stryker](https://qaskills.sh/blog/mutation-testing-stryker-guide)
- [Computing Mitered Offset Curves Based on Straight Skeletons](https://www.tandfonline.com/doi/full/10.1080/16864360.2014.997637) — base teórica do offset com miter

### Entrega 6, parte 1 — arcos

Parede em arco (`bulge`, convenção DXF) expandida numa cadeia de trechos retos (`geometry/arc.ts`): as
cordas de círculos concêntricos entre os mesmos ângulos são paralelas, então cada trecho é uma parede
reta com os offsets das camadas multiplicados por cos(Δ/2), e o miter entre trechos vizinhos cai na
radial. Contagem de trechos pela fórmula da §5.2 com `ARC_SAG` (ADR 0001). Pontas livres radiais.
Arco com face de raio ≤ 0: aviso `arcTooTight`, nada desenhado.

Juntas: L nas pontas do arco e nós sobre a cadeia usam o motor de sempre. Um T contra o arco só é
feito se tudo o que a parede põe dentro dele cabe num trecho (setor radial); senão, e para todo X com
arco, aviso `arcJoinUnsupported` e as paredes ficam como desenhadas. Uma última verificação acusa
qualquer sobreposição que sobrar entre um arco e outra parede, com o mesmo aviso.

O arco que termina contra uma parede (o arco é a haste do T) não precisa caber num trecho: o trecho
da ponta recebe o corte de T, e cada trecho anterior que ainda entra na faixa da hospedeira recebe o
seu próprio corte de T (sem alongar) e os seus entalhes na hospedeira, limitados pelas radiais do
seu setor, onde as camadas são unidas em miter. A volta para trás para no primeiro trecho que não
entra, para que os planos (infinitos) nunca cortem outra parte do arco. Antes disso o caso era
sempre recusado com aviso, e o aviso dizia "paredes demais num mesmo ponto".

| Medida | Resultado |
|---|---|
| Testes | 13 casos à mão de arcos; suíte inteira 146/146 |

**Defeito investigado e encerrado (2026-10-24):** o caso (arco de 1 cm, `interiorFace`, bulge
0,0437, de (0, 0) a (1, 0), com parede reta de 1 cm a 30° na ponta inicial) não era do motor, e sim do
oráculo de arcos. Num L agudo, a ponta reta de uma parede sai além da face externa da outra, e a
região do L da spec (§7.1, `expectedL`) a corta. O oráculo exigia cobrir essa ponta. Com a mesma
configuração com duas paredes retas, o mesmo oráculo acusa a mesma "fresta", e o motor bate com
`expectedL`. Agora o oráculo (`arcCorner`) usa, perto do nó, o L da spec entre o trecho da ponta (a
corda, com camadas × cos(Δ/2)) e a parede. `arc-corner.test.ts` confere as 18 combinações de
referência e lado desse caso. A suíte de propriedade dos arcos (`arcs.property.test.ts`) entrou no
repositório. O caso de sobreposição que ela acusou perto da outra ponta de um semicírculo também era
do oráculo: a zona do canto não excluía os outros trechos do arco.

**L na ponta de um arco que alcança os trechos seguintes (2026-10-24):** no butt em que o arco
encosta e a reta passa, o corpo da reta ainda pode entrar nos trechos antes do da ponta (paredes
grossas, trechos curtos). O motor agora leva o corte adiante como numa haste de arco num T
(`carryArcStem`), em vez de recusar com `arcJoinUnsupported`. Controle: o caso achado pela suíte
com paredes grossas falha no motor anterior e passa no novo (`arc-corner.test.ts`).

Dois erros do oráculo achados nesse caminho, cada um com controle:

1. `arcCorner` usava `expectedL`, que só tem as regras do miter. Faltava a regra do butt da §7.1
   (canto do butt ou ponto mais fundo de camada além de uma ponta livre → `WallsOverlap`). Controle:
   o mesmo L com o trecho da ponta desenhado como parede reta comum também dá `WallsOverlap` no motor,
   e o oráculo das retas (`cornerJoin`) também diz que não há junta. Agora `arcCorner` usa
   `expectedCorner`, o mesmo das retas.
2. O gerador não pulava uma reta cujo corpo passa pela outra ponta do arco (segunda junta, que o
   oráculo não modela). Agora pula, e conta: 3 de 100 na seed fixa.

A suíte não tem mais faixa de empate nem `cornerOverreach`: o aviso é exigido quando o L da spec é
`overlap` ou quando a reta toca outro trecho do arco (`touchesArcElsewhere`, com casos à mão em
`oracle-arc.test.ts`), e todo o resto precisa juntar e cobrir exato.

**Ficava aberto (fechado abaixo, "L que passa do trecho da ponta"):** um L na ponta de um arco cujo
corpo da reta alcança os trechos seguintes continuava recusado com `arcJoinUnsupported` (a última
verificação). **Correção (2026-10-24):** escrevi aqui que
nenhum caso assim aparecia em 12 000 rodadas nem numa busca de 141 742 Ls. Estava errado: a suíte e a
busca pulavam (ou exigiam aviso de) toda reta que tocasse o arco fora do trecho da ponta
(`touchesArcElsewhere`), e esse é justamente o caso. Separado da segunda junta, ele é comum: na seed
fixa da suíte, 32 de 98 Ls (os outros 2 são segunda junta) são recusados por esse transbordo. É o
próximo item do motor. Uma primeira versão da busca achou 4 candidatos, mas a ponta longe da reta caía a menos de 1 mm de um
trecho do arco: uma segunda junta (§6), não um L. `arc-corner.test.ts` prova os dois lados: a ponta a
≤ 1 mm (`distanceToSegments`) e, com ela recuada 5 mm, o L sozinho junta e cobre exato. A tabela da
§6 agora diz a folga que o motor já usava na banda: `POINT_TOLERANCE`.

**T contra um arco mais largo que um trecho (2026-10-24):** antes recusado com `arcJoinUnsupported`.
Perto da ponta, a parede é dividida pelas cunhas radiais dos trechos que alcança, e cada parte recebe
o T daquele trecho (§7.2: camadas param nas faces pela prioridade; o trecho é entalhado onde elas
passam). Numa cunha, as faces do trecho são as do arco, então as partes encontram a cadeia exatamente.
A zona da ponta é medida: onde a faixa da parede cruza o corpo do arco, só no cruzamento mais perto da
ponta (a faixa pode atravessar o anel e encontrar o arco de novo do outro lado, o que não é deste T),
com 1 cm de folga para cada lado.

Fora de toda cunha (além da ponta livre do arco), a parede guarda o próprio corpo, com a ponta
quadrada, e perde só a extensão além da ponta: ali não há face onde parar. **Diferença conhecida:**
contra uma hospedeira reta, uma parede mais larga que o fim da hospedeira é aparada na linha da face
prolongada além do fim. É uma simplificação daquele caso, não copiada aqui.

Oráculo: em volta da ponta, cobertura estrita (dentro de um corpo, exatamente uma peça; fora, nenhuma),
com dois casos modelados, cada um com casos à mão em `oracle-arc.test.ts`: o que o T preenche entre a
ponta quadrada e a face curva (`tFill`) e o que da parede fica além do arco e o T não guarda
(`tBeyond`). De que lado a parede vem é decidido andando o eixo para trás a partir da ponta
(`comesFromOutside`): uma parede pode ser corda do círculo, com a ponta longe sobre ele.

| Medida | Resultado |
|---|---|
| Casos à mão em `arcs.test.ts` | 6 novos ou mudados (de dentro, de fora, em camadas pela prioridade, além da ponta do arco, ponta sobre um encontro, parede fina cruzando a referência do trecho vizinho) |
| Suíte de propriedade, seed fixa, 100 rodadas | 99 juntam e cobrem exato, 0 avisos, 1 pulado (outra ponta perto do arco: segunda junta), limite 5 |
| Os 4 candidatos com segunda junta (`arc-corner.test.ts`) | agora juntam nas duas pontas; L exato perto do nó e T exato perto da ponta longe, os 4 |

Achados pelo caminho (todos meus, cada um com contraexemplo): a zona da ponta medida pela extensão de
junta (metros) saía da varredura; a faixa atravessando o anel contava o outro lado; uma ponta a menos de
1 mm fora do arco não achava o cruzamento pela tolerância medida ao longo da parede inclinada. Do lado do
oráculo: o canto preenchido e a ponta que atravessa um arco fino não eram modelados, e o lado de
chegada saía por arredondamento numa parede-corda.

**X com arco (2026-10-24):** antes recusado com `arcJoinUnsupported`. A regra do X vale como entre
retas (§6, Crossing): passa o núcleo mais grosso, a outra é cortada em dois vãos, cada um um T contra a
que passa.
- O arco passa: cada vão da reta leva o T contra o arco espalhado pelos trechos (acima), por vão, para
  que o corte de um lado não mexa no outro.
- A reta passa: o trecho do arco é cortado no cruzamento, e cada lado termina contra a reta como um
  arco termina (o trecho leva o T, os anteriores o carregam: `carryArcStem`). Num cruzamento exatamente
  sobre o encontro de dois trechos, o canto da cadeia ali cede: um trecho termina, o seguinte começa.
- Descoberta (§6): os encontros de um arco não são pontas na regra "ponta dentro da faixa" (as pontas
  de trecho dentro da faixa da reta não fazem dele um T), e um cruzamento sobre um encontro é achado
  (uma vez, no primeiro dos dois trechos).

| Medida | Resultado |
|---|---|
| Casos à mão em `arcs.test.ts` | 3: o arco passando a 90° sobre um encontro, a reta passando, inclinado com camadas |
| Suíte de propriedade, seed fixa, 100 rodadas | 96 cruzam exato, nenhum aviso (é falha: a spec faz todo X), 4 pulados (sem espaço além da faixa antes de a reta voltar ao arco: segunda junta), limite 5 |
| Controle | com o motor anterior, os 3 casos à mão e a suíte falham |

A suíte do L passou a separar o transbordo da segunda junta pela geometria, não por um número solto:
o contato com os outros trechos que começa dentro do alcance do canto do L (`cornerReach`: o mais
longe dos quatro encontros das faces da reta com as do trecho da ponta, com caso à mão) é o
transbordo; além dele, segunda junta. Separou os mesmos 32 casos que o corte de 0,3 m separava.

**L que passa do trecho da ponta (2026-10-24):** antes recusado com `arcJoinUnsupported` (32 de 98 Ls
na seed fixa). Com o esclarecimento de "ponta livre" na §7.1, a spec faz esse L.

- Motor: o alcance do trecho da ponta, no L, é o comprimento da cadeia (`resolveCorner` recebe o
  alcance de cada lado; `cut-l.ts`). Perto do nó, a reta é dividida pelas cunhas radiais dos trechos
  (`spillOverArc`), até o mais longe entre o cruzamento da faixa dela com o arco e o canto (os encontros
  das linhas de camada do trecho da ponta com as faces da reta), mais 1 cm. Na cunha do trecho da ponta
  e nas cunhas cujo corpo a faixa não alcança, a parte recebe o corte do L; nas outras, o T contra
  aquele trecho (§7.2). Fora de toda cunha, o corte do L. No butt em que o arco encosta, os entalhes
  do trecho da ponta param no plano radial dele. O corte levado adiante pelos trechos seguintes
  (`carryArcStem`) só age dentro dos pedaços desses trechos (antes valia numa faixa infinita).
- Oráculo: `arcCorner` usa o mesmo alcance (`expectedCorner` com o comprimento da cadeia). A região é
  feita com a corda do trecho da ponta prolongada (a região com a ponta do trecho como vértice se
  dobrava quando o canto passava dela). Onde ela decide: na cunha do trecho da ponta, ou fora da
  varredura do lado do nó, nunca nos corpos dos outros trechos. `cornerReach` é limitado pelas
  regras da §7.1 (`MITER_LIMIT × max(T)` e o tipo de canto). Na cobertura do L, o que da reta passa
  do arco não é guardado (`tBeyond`, como num T, §7.2).

| Item | Resultado |
|---|---|
| Casos à mão em `arc-corner.test.ts` | 4 que passam do trecho da ponta e juntam exato (paredes de 40 e 60 cm a 100° e 140° de um arco de 88 trechos de 10,7 cm); 2 que passam de uma ponta livre de verdade e avisam (arco de 10 cm com parede de 50 cm; parede de 30 cm de comprimento e 60 cm de espessura) |
| Controle no oráculo | nos 4 casos, com o trecho da ponta livre na própria ponta (regra antiga), `cornerJoin` dá `overlap` |
| Controle no motor | sem o alcance da cadeia, os 4 casos à mão e a suíte do L voltam a avisar |
| Suíte de propriedade do L, seed fixa, 100 rodadas | 95 juntam e cobrem exato (29 deles passando do trecho da ponta), 0 avisos, 5 pulados (a reta passa perto da outra ponta do arco: segunda junta, que o oráculo não modela; 3 deles também passavam do trecho da ponta), limite 5 |

Dos 32, 29 viraram L exatos no oráculo estrito; os outros 3 não são avisos, são pulados como segunda
junta. Nenhum aviso sobrou na suíte; os avisos que a §7.1 manda estão nos 2 casos à mão.

**Alturas diferentes (2026-10-24):** antes, as juntas ignoravam a altura. Uma parede baixa unida a uma
alta cortava a alta na altura toda, e paredes com faixas de altura sem sobreposição se uniam. Agora é a
§7.5: as bases e os topos das paredes do pavimento dividem a altura em faixas, e cada faixa é unida só
com as paredes de pé nela (`app/geometry.ts`, `wallPieces`). Acima do topo da vizinha, a parede termina
como sozinha (ponta livre, quadrada). Faixas que só se tocam não se unem. A planta é o corte na altura
de corte do pavimento (§7.5): 6 casos à mão a mais (as duas paredes da sobreposição cortadas em
meia-esquadria, parede baixa em vista, parede alta em vista, começar ou terminar na altura de corte,
altura de corte do pavimento, pavimento de cima), mais o comando e o arquivo. No motor anterior, os 8
falham.

| Item | Resultado |
|---|---|
| Casos à mão em `tests/app/wall-heights.test.ts` | 8 testes em 6 situações: L entre paredes de 1 m e 2,8 m (miter abaixo, só a alta e quadrada acima, blocos 0–1 e 1–2,8), T com a hospedeira mais baixa, T com a que encosta mais baixa, parede sobre `baseOffset`, faixas separadas e faixas que se tocam |
| Propriedade | L, T, X e um L com T, 60 rodadas cada: em 300 pontos e alturas sorteados, os blocos que contêm o ponto são as peças da junta das paredes de pé naquela altura (`computeWallGeometry` só com elas), e o volume é o I2 |
| Controle | no motor anterior, 10 de 12 falham; os 2 que passam são casos em que nada muda (as duas de pé na altura testada, ou a hospedeira inteira) |
