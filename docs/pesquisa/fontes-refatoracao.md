# Fontes da refatoração (2026-10-30)

Pesquisa feita antes de decidir a arquitetura-alvo (ordem 0 do pedido). Dois agentes de pesquisa digeriram as
fontes; cada fato abaixo é rastreável à URL listada. Fatos marcados **não verificado** vieram da memória do
agente sem página aberta. O que a arquitetura usa diretamente foi conferido de novo na fonte local
(`node_modules/three@0.186.1`) quando cabia.

## 1. Projeto de software (Ousterhout, conascência, coesão/acoplamento, fatia vertical)

- Módulos profundos (Ousterhout, *A Philosophy of Software Design*): o melhor módulo dá "poderosa
  funcionalidade por uma interface simples"; módulo raso tem interface complexa em relação ao que entrega.
  Complexidade = o que torna o sistema difícil de entender/mudar; sintomas: amplificação de mudança, carga
  cognitiva, desconhecidos desconhecidos; causas: dependências e obscuridade. Vazamento de informação: a
  mesma decisão de projeto aparece em mais de um módulo. "Classitis" (dividir demais em módulos pequenos)
  multiplica boilerplate. **Como aplicar**: os arquivos-deus de hoje são o oposto de profundos (i18n, app,
  scene-3d expõem tudo); dividir por responsabilidade, não por tamanho; cada pasta de recurso esconde suas
  decisões atrás de uma interface pequena.
  Fontes: https://galowicz.de/blog/book-review-a-philosophy-of-software-design ,
  https://thuva4.com/books/a-philosophy-of-software-design-book ,
  https://daily.dev/posts/book-review-a-philosophy-of-software-design-yhqhqrahh
- Conascência (Page-Jones, connascence.io): tipos estáticos (nome, tipo, significado, posição, algoritmo) e
  dinâmicos (execução, timing, valor, identidade). Regra de localidade: **conascência forte é aceitável
  dentro de um módulo; entre módulos distantes só conascência fraca** (nome/tipo). Remédios: constante com
  nome (significado→nome), tipo próprio no lugar de primitivo (significado→tipo).
  **Como aplicar**: mover os pares `core/vector`↔`app/geometry`, `core/collisions`↔`app/collision` etc. para
  um lugar só; IDs com tipo próprio (branding) trocam conascência de significado (prefixo de string) por
  conascência de tipo, a mais fraca.
  Fontes: https://connascence.io/ , /name.html , /meaning.html , /algorithm.html , /value.html ,
  /timing.html , /strength.html , /locality.html
- Coesão/acoplamento: pior→melhor coesão: coincidental, lógica, temporal, procedural, comunicacional,
  sequencial, funcional. Acoplamento baixo→alto: dados, carimbo (stamp), controle, externo, comum
  (globais), conteúdo. LCOM4 ≥ 2 componentes conectados = dividir a classe nessa peças (diz exatamente o
  que viaja junto ao dividir um arquivo). Acoplamento de controle (flags) é o que as máquinas de estado
  removem. Fontes: https://en.wikipedia.org/wiki/Cohesion_(computer_science) ,
  https://en.wikipedia.org/wiki/Coupling_(computer_science) , https://www.aivosto.com/project/help/pm-oo-cohesion.html
- Fatia vertical / package by feature: "o que muda junto mora junto"; pastas de alto nível nomeiam os casos
  de uso (screaming architecture), não a tecnologia; sem projeto dividido não há barreira de compilação —
  o gate de direção de imports tem de ser script. Fontes:
  https://milanjovanovic.tech/blog/when-to-choose-vertical-slice-architecture ,
  https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html ,
  https://www.markhneedham.com/blog/2012/02/20/coding-packaging-by-vertical-slice/

## 2. Padrões (Nystrom, Harel, fonte única de verdade, imutável, DOD, branded IDs)

- State (Nystrom): flags booleanas criam combinações impossíveis; enum+switch serve; dados por estado
  pertencem ao estado; hierarquia (subestado herda o não-tratado); pilha de estados dá histórico.
  **Como aplicar**: `UiState` de ~40 campos soltos → máquinas (ferramenta→submodo→arrasto/entrada; ciclo de
  vida; vistas; diálogos). https://gameprogrammingpatterns.com/state.html
- Command: comando = chamada reificada; desfazer guarda só o que mudou — snapshot inteiro "é desperdício";
  lista + ponteiro; novo comando descarta o futuro. **Como aplicar**: medir o custo do histórico atual
  (versões inteiras) no projeto grande antes de trocar. https://gameprogrammingpatterns.com/command.html
- Observer / Event Queue: notificação desacopla quem muda de quem observa; fila separa *quando* do *agora*,
  mas fila central é variável global e evento não devolve resposta. **Como aplicar**: derivados (cena,
  planta, painel) atualizados por marcação de sujo (dirty flag) e não por cópia sincronizada na mão.
  https://gameprogrammingpatterns.com/observer.html , /event-queue.html , /dirty-flag.html
- Harel (statecharts 1987): hierarquia, ortogonalidade (regiões AND: custo soma, não multiplica), guards,
  ações de entrada/saída, estados de histórico. Fatos lidos de fontes secundárias (o PDF de 1987 não abriu):
  https://en.wikipedia.org/wiki/UML_state_machine , https://statecharts.dev/ ,
  https://statecharts.dev/glossary/history-state.html ; PDF: https://www.state-machine.com/doc/Harel87.pdf
- Fonte única de verdade: cada dado editado num lugar só; o resto é referência ou derivação (CQRS).
  https://en.wikipedia.org/wiki/Single_source_of_truth
- Estado imutável + compartilhamento estrutural: novas versões reutilizam as partes que não mudaram
  (Immutable.js/Redux); desfazer por snapshot inteiro `{past[], present, future[]}` é a receita padrão, com
  detecção por referência; alternativa por diferença (zundo `diff`, limite `limit`). **não verificado**:
  frase "make illegal states unrepresentable" (sem página). Fontes: https://immutable-js.com/ ,
  https://redux.js.org/usage/structuring-reducers/immutable-update-patterns ,
  https://redux.js.org/usage/implementing-undo-history , https://github.com/charakour/zundo
- Data-Oriented Design (Fabian): organize pelos dados que o caminho quente percorre; AoS vs SoA decide pela
  localidade de cache medida, não por dogma (x,y,z separados pode PIORAR se sempre lidos juntos); SIMD em
  fluxos homogêneos. **Como aplicar**: nas listas de elementos por tipo ( já é table-based), o custo está
  mais em recalcular tudo do que em layout; medir antes de mudar layout de dados.
  Fontes: https://www.dataorienteddesign.com/dodbook/ , /dodbook/node9.html
- Branded IDs no TS: `type Brand<K,B> = K & {__brand:B}`; construtor esperto evita `as` espalhado; não existe
  em runtime; escolher UMA abordagem nominal no código todo. Fonte:
  https://michalzalecki.com/nominal-typing-in-typescript/
- Alocação zero por quadro no V8: GC pausa tudo; reduzir alocação em caminho por-quadro diminui coletas
  (conhecimento geral, sem página única autoritativa; medir com heap profile do DevTools — fontes no §4).

## 3. three.js 0.186 e bibliotecas (conferido em fontes + código local 0.186.1)

- WebGLRenderer: render sob demanda com flag + rAF (o manual recomenda para editores/CAD);
  `setAnimationLoop` é para loops contínuos. `renderer.info`: `memory.geometries/textures`,
  `render.calls/triangles/points/lines/programs`; **zera a cada quadro** (`autoReset` true) — para medir um
  quadro inteiro, ler antes do próximo. Dispose explícito de geometry/material/texture; remover da cena não
  libera nada; material.dispose não descarta texturas. `onBeforeCompile` exige `customProgramCacheKey` para
  variantes por instância (programas são compartilhados).
  Fontes: https://raw.githubusercontent.com/mrdoob/three.js/r186/docs/pages/WebGLRenderer.html.md ,
  .../manual/pages/rendering-on-demand.html , .../manual/pages/how-to-dispose-of-objects.html
- InstancedMesh: muitas geometrias+materiais idênticos com transformes diferentes = menos draw calls;
  `setMatrixAt` + `instanceMatrix.needsUpdate`; bounding sphere única para o conjunto (culling por
  instância não existe; recomputar depois de mover instâncias); raycast suportado com `instanceId`;
  `count` desenhável menor que o alocado. Fontes: .../docs/pages/InstancedMesh.html.md , .../src/objects/InstancedMesh.js
- BatchedMesh r186: API NOVA (verificada no código local): `new BatchedMesh(maxInstanceCount,
  maxVertexCount, maxIndexCount=maxVertexCount*2, material)`; `addGeometry` devolve geometryId,
  `addInstance(geometryId)` devolve instanceId (uma geometria, muitas instâncias); `setVisibleAt`/
  `getVisibleAt` (não existe mais `setActive`, nem `setGeometryRange` — ler com `getGeometryRangeAt`);
  `sortObjects` ordena instâncias (transparente trás-frente), `perObjectFrustumCulled` por instância com
  esfera por geometria; `computeBoundingSphere` até ser chamada; raycast suportado com `batchId`;
  `optimize()` compacta; matrizes com escala negativa não suportadas. Fontes: .../docs/pages/BatchedMesh.html.md ,
  .../src/objects/BatchedMesh.js
- three-mesh-bvh (0.9.17): `computeBoundsTree`/`acceleratedRaycast` no prototype ou `geom.boundsTree`;
  `raycaster.firstHitOnly`; refit só quando vértices mudam in place (transform não exige rebuild);
  suporte a BatchedMesh (`computeBatchedBoundsTree`); workers `GenerateMeshBVHWorker`. Fonte:
  https://raw.githubusercontent.com/gkjohnson/three-mesh-bvh/master/README.md
- three-bvh-csg (0.0.18): Brush + Evaluator.evaluate(A,B,op); exige two-manifold; resultados via drawRange;
  worker ainda não; experimental. Fonte: https://raw.githubusercontent.com/gkjohnson/three-bvh-csg/main/README.md
- three-gpu-pathtracer (0.0.27, o do projeto): WebGLPathTracer é a entrada atual do pacote WebGL
  (PathTracingRenderer deprecado); `setScene`/`setSceneAsync` reconstrói BVH (bloqueia em cena grande);
  `updateCamera`/`updateMaterials`/`updateLights`/`updateEnvironment` só reiniciam o acúmulo;
  `renderSample()` por quadro; `filterGlossyFactor`, MIS (não desligar — vira ruído), clamps de firefly
  escurecem. Memória photoreal-trace do projeto já cobre os defeitos históricos. Fontes:
  https://registry.npmjs.org/three-gpu-pathtracer/latest , https://unpkg.com/three-gpu-pathtracer@0.0.27/src/index.js ,
  .../src/core/WebGLPathTracer.js , https://raw.githubusercontent.com/gkjohnson/three-gpu-pathtracer/master/CHANGELOG.md
- DevTools/Canvas2D: Performance panel (throttle CPU, forçar GC, long tasks >50 ms, trilha de memória/heap);
  heap snapshot comparação por @id; allocation timeline (barras azuis = sobrevivem = vazamento no passo
  repetível); PerformanceObserver (measure, longtask, long-animation-frame). Canvas 2D: camadas de canvas
  separadas para o estático; pré-renderizar em offscreen e drawImage; evitar trocas de estado (agrupar por
  cor, uma polyline); dpr via canvas.width*dpr + scale; willReadFrequently só com leitura frequente.
  Fontes: https://developer.chrome.com/docs/devtools/performance , /performance/reference ,
  /memory-problems/heap-snapshots , /memory-problems/allocation-profiler ,
  https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver/observe ,
  https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas ,
  https://web.dev/articles/canvas-performance

## 4. Decisões que a pesquisa already determina (para o ADR 0004)

1. Pastas por recurso com gate de direção por script (sem barreira de compilador em TS único).
2. Conascência de significado (prefixo de id) → tipos próprios (branded) nos pontos de fronteira.
3. Flags soltas do UiState → máquinas de estado (ferramenta/submodo/arrasto; ciclo de vida; vistas), com
   hierarquia onde couber (Harel) e sem custo de runtime além de um enum + transições nomeadas.
4. Derivados (cena 3D, planta, painel, navegador) por dirty flag/notificação, nunca cópia sincronizada.
5. Paradigma do Doc: decidir pela medição do histórico (versões inteiras × compartilhamento estrutural que
   já existe) no projeto grande; o custo medido manda.
6. 3D: BatchedMesh/InstancedMesh onde houver muitas malhas por material (API r186 confirmada no fonte local);
   renderer.info com autoReset para comparar draw calls antes/depois; zero recompilação de shader sem
   customProgramCacheKey.
7. Planta 2D: camada estática pré-renderizada + redesenho do que mudou; sem alocação por quadro no arrasto.
