# Inventário da refatoração — cada arquivo, seu destino (passo 3)

Legenda: **ação** manter · mover · dividir · juntar · apagar · renomear. **Destino** pela árvore do ADR 0004
(`project/ model/ wall/ opening/…/ session/ canvas/ ui/ library/`). O portão `scripts/check-inventario.mjs`
confere que cada arquivo de src/ aparece aqui; as ações são executadas nos passos do plano (work.md).
Estado mutável e caminhos quentes por arquivo estão nos cadernos de leitura (resumo em work.md, passo 3);
aqui fica a decisão por arquivo.

## model/ — geometria e utilidades sem dono de elemento

| Arquivo | Ação | Destino | Nota |
| --- | --- | --- | --- |
| src/model/hull.ts | manter | model/hull.ts | a única cópia de hull (collision ≡ select-drag); import-mesh e evaluate têm regras de empate próprias, documentadas no arquivo |
| src/model/vector.ts | manter | model/vector.ts | acrescenta pointToSegment/polygonDistance (hoje 3 cópias: geometry, carry, dimension/anchor) |
| src/model/tolerance.ts | manter | model/tolerance.ts | os TOUCH/LENGTH_EPS/TOL locais de faces/edges/seams/sectors voltam para cá |
| src/core/id.ts | manter+mover | project/id.ts | junto do formato (emite ids do projeto) |
| src/core/guards.ts | manter+mover | project/guards.ts | os `finite`/`isPoint`/`isColor` locais (5 arquivos) passam a importar daqui |
| src/model/rtree.ts | manter | model/rtree.ts | passa a ser usado pela descoberta de juntas e seams (hoje bruto O(n²)) |
| src/core/measure.ts | manter+mover | model/measure/parse.ts | o parser de expressões; separado do leitor de fita (tools) |
| (apagado no passo 5) src/core/collisions.ts | apagado | — | a flag virou estado da sessão, passado por KindFieldContext.floorLocked e PanelInput.collisions |
| src/core/store.ts | mover | project/store.ts | sem mudança (ADR §5) |
| (movido no passo 4) (movido no passo 4) src/elements/sat.ts | mover | model/sat.ts | hull (1 das 4 cópias) vira model/hull.ts único |
| (movido no passo 4) src/project/carry.ts | dividir | project/derive/cache.ts | geometryOf + keepRooms; apaga carriedRooms (morto) e toSegment (cópia) |
| (movido no passo 4) src/elements/opening/keep.ts | mover | opening/keep.ts | anda com wall-stops |
| (movido no passo 4) src/elements/wall/stops.ts | mover | wall/stops.ts | funde com a ideia de jointsIn/endsIn (uma implementação só) |
| (movido no passo 4) src/project/derive.ts | dividir | project/derive/*.ts | deriveGeometry vira o orquestrador; jointsIn/endsIn fundidos em wall/stops; helpers p/ model; hideCategories → session |
| (novo no passo 6) src/project/derived-queries.ts | manter | project/derived-queries.ts | consultas à geometria derivada (hostsIn, wallAt, openingAt, boundsOf), antes em derive.ts |
| (novo no passo 6) src/project/derived-filters.ts | manter | project/derived-filters.ts | categorias ocultas e vista temporária sobre a geometria, antes em derive.ts |
| (movido no passo 4) src/session/keep-in-view.ts | mover | session/view/keep.ts |  |
| (movido no passo 4) src/session/dim-labels.ts | mover | canvas/plan/labels.ts |  |
| (movido no passo 4) src/model/section-box.ts | mover | session/view/section-box.ts | topAt duplicado funde com section-drawing |
| (movido no passo 4) src/session/view/view-3d.ts | mover | session/view/view-3d.ts | a máquina de vistas (ADR §3) |
| (movido no passo 4) src/session/browser-data.ts | juntar | ui/browser.ts | 14 linhas de typeUsage |

## project/ — documento, formato, persistência

| Arquivo | Ação | Destino | Nota |
| --- | --- | --- | --- |
| (movido no passo 4) src/project/doc.ts | dividir | project/doc.ts + level/… | Doc/niveis em project; wallHeights/wallBand → wall; covers WeakMap junto do roof |
| (movido no passo 4) src/project/file.ts | mover | project/file.ts | valida via guards; migrações intactas (formato congelado) |
| (novo no passo 6) src/project/file-guards.ts | manter | project/file-guards.ts | os guardas dos registros do arquivo (níveis, materiais, tipos, paredes, aberturas), antes em file.ts |
| (movido no passo 4) src/project/typed-ids.ts | mover | project/typed-ids.ts | passa a emitir branded ids |
| (movido no passo 4) src/project/db.ts | mover | project/db.ts | tira os 2 bytes NUL literais (arquivo lido como binário); 'points' vestigial sai |
| (movido no passo 4) src/project/persist.ts | mover | project/persist.ts | pending/target viram o dono único da gravação |
| (movido no passo 4) src/project/boot.ts | mover | project/boot.ts |  |
| (movido no passo 4) src/project/projects.ts | mover | project/projects.ts | switchTo funde com app-files newProject/openFile (sequência de reset duplicada) |
| (movido no passo 4) src/project/files.ts | mover | project/files.ts |  |
| (movido no passo 4) (movido no passo 4) src/project/saved-views.ts | mover | session/views.ts | nextViewName funde com layer-sets nextName (model/names.ts) |
| (movido no passo 4) src/project/layer-sets.ts | dividir | project/layer-sets.ts | dados+comandos no project; cores no canvas |
| src/io/library-file.ts | mover | library/file.ts | deflate duplicado do pdf-canvas: um utilitário só |
| src/io/import-dxf.ts | mover | library/import-dxf.ts |  |
| src/io/import-mesh.ts | mover | library/import-mesh.ts | hull (4ª cópia) → model/hull.ts |

## wall/ — a parede inteira num lugar

| Arquivo | Ação | Destino | Nota |
| --- | --- | --- | --- |
| src/elements/wall/schema.ts | mover | wall/schema.ts |  |
| src/elements/wall/types.ts | mover | wall/types.ts |  |
| src/elements/wall/library-types.ts | mover | wall/library-types.ts |  |
| src/elements/wall/commands.ts | mover | wall/commands.ts |  |
| src/elements/wall/fields.ts | dividir | wall/fields.ts | bloco de referência duplicado (fields vs next-fields) vira um helper |
| src/elements/wall/type-fields.ts | mover | wall/type-fields.ts |  |
| src/elements/wall/flip.ts | mover | wall/flip.ts |  |
| src/elements/wall/geometry/convex.ts | mover | wall/geometry/convex.ts | a fonte única de recorte (spec §4) |
| src/elements/wall/geometry/offset.ts | mover | wall/geometry/offset.ts |  |
| src/elements/wall/geometry/arc.ts | mover | wall/geometry/arc.ts |  |
| src/elements/wall/geometry/shape.ts | mover | wall/geometry/shape.ts | shapeOf memoizado por derivação |
| src/elements/wall/geometry/footprint.ts | dividir | wall/geometry/footprint.ts + spans.ts | ~18 linhas verbatim de spreadOverArc/spillOverArc fundem; região/corta helpers únicos |
| (novo no passo 6) src/elements/wall/geometry/arc-joints.ts | manter | elements/wall/geometry/arc-joints.ts | parede reta contra cadeia de arcos (antes em footprint.ts) |
| (novo no passo 6) src/elements/wall/geometry/pieces.ts | manter | elements/wall/geometry/pieces.ts | peças entre entalhes e avisos únicos (antes em footprint.ts) |
| src/elements/wall/geometry/faces.ts | mover | wall/geometry/faces.ts | tolerâncias locais → model/tolerance |
| src/elements/wall/geometry/edges.ts | mover | wall/geometry/edges.ts | idem; outline vs faces.subtract: uma implementação |
| src/elements/wall/geometry/seams.ts | mover | wall/geometry/seams.ts | passa a usar rtree (hoje O(pieces²)) |
| src/elements/wall/geometry/under-roof.ts | mover | wall/geometry/under-roof.ts | regionOf (4ª cópia) → wall/geometry/region.ts |
| src/elements/wall/join/types.ts | mover | wall/join/types.ts |  |
| src/elements/wall/join/discover.ts | mover | wall/join/discover.ts | withinBand/insideBand fundem; candidatas por rtree |
| src/elements/wall/join/node.ts | mover | wall/join/node.ts |  |
| src/elements/wall/join/sectors.ts | mover | wall/join/sectors.ts | predicados de banda compartilhados |
| src/elements/wall/join/junctions.ts | mover | wall/join/junctions.ts |  |
| src/elements/wall/join/cut-l.ts | mover | wall/join/cut-l.ts |  |
| src/elements/wall/join/cut-t.ts | mover | wall/join/cut-t.ts |  |
| src/elements/kinds/wall.ts | juntar | wall/kind.ts | o adaptador do registro mora com a parede |
| (movido no passo 4) src/elements/wall/tool-ui.ts | dividir | wall/tool-ui.ts | submitMeasure vira roteador da sessão; previewWall → wall/preview |
| (movido no passo 4) src/elements/wall/tool.ts | mover | wall/tool.ts |  |
| (movido no passo 4) src/elements/wall/edit.ts | mover | wall/edit.ts | edições que preservam juntas |
| src/tools/split.ts | mover | wall/split.ts |  |
| (movido no passo 4) src/elements/wall/arrange.ts | mover | wall/arrange.ts |  |
| (movido no passo 4) src/elements/wall/arc-edit.ts | mover | wall/arc-edit.ts |  |
| src/ui/wall-snapshot.ts | mover | wall/snapshot.ts |  |
| src/ui/layer-editor.ts | mover | wall/layer-editor.ts | é o editor de camadas do tipo de parede (e do piso: parâmetro) |

## opening/ · room/ · cada elemento na sua pasta

| Arquivo | Ação | Destino | Nota |
| --- | --- | --- | --- |
| src/elements/opening/schema.ts | mover | opening/schema.ts |  |
| src/elements/opening/commands.ts | mover | opening/commands.ts | dependsOn funde com badReference (ciclo de referências) |
| src/elements/opening/derive.ts | mover | opening/derive.ts |  |
| src/elements/opening/fields.ts | dividir | opening/fields.ts + style-fields.ts | 555 l → 2 arquivos |
| (novo no passo 6) src/elements/opening/style-fields.ts | manter | elements/opening/style-fields.ts | modelo e estilo da esquadria no painel (antes em fields.ts) |
| src/elements/opening/parts.ts | mover | opening/parts.ts | constantes de folha nomeadas |
| src/elements/opening/style.ts | mover | opening/style.ts | identidade de estilo por JSON em 3 lugares → um helper |
| src/elements/opening/symbol.ts | mover | opening/symbol.ts | arcos de 24 passos cacheados |
| (movido no passo 4) src/ui/panels/opening.ts | mover | opening/panel.ts |  |
| src/elements/opening/marks.ts | mover | opening/marks.ts | O(n²) → mapa por chave |
| src/elements/opening/sides.ts | mover | opening/sides.ts |  |
| src/elements/opening/void.ts | mover | opening/void.ts |  |
| (apagado) src/elements/opening/index.ts | apagado | — | barril inconsistente, ninguém o usa |
| src/elements/kinds/opening.ts | juntar | opening/kind.ts |  |
| (movido no passo 4) src/elements/opening/tool.ts | mover | opening/tool.ts |  |
| (movido no passo 4) src/elements/opening/aim.ts | mover | opening/aim.ts | aimAt/aimAlong duplicados fundem |
| src/ui/opening-snapshot.ts | mover | opening/snapshot.ts |  |
| src/elements/room/schema.ts | dividir | room/schema.ts + room/buildups.ts | tabela de dados separada |
| src/elements/room/derive.ts | mover | room/derive.ts | insideRing para de ser reexportado como insidePolygon |
| src/elements/room/commands.ts | mover | room/commands.ts |  |
| src/elements/room/fields.ts | dividir | room/fields.ts | tilesFor/TILE_WASTE (lógica de modelo) sai do arquivo de campos |
| (apagado) src/elements/room/panel.ts | apagado | — | alias de 9 linhas |
| src/elements/kinds/room.ts | juntar | room/kind.ts |  |
| src/elements/kinds/floor.ts | juntar | room/floor-kind.ts |  |
| (movido no passo 4) (movido no passo 4) src/session/room-tool.ts | mover | room/tool-ui.ts | room-exists repetido 3× → um helper |
| src/app/room-tag.ts | mover | room/tag.ts |  |
| (movido no passo 4) src/session/stacked.ts | mover | wall/stacked.ts | paredes sobre paredes |
| (novo no passo 4) src/elements/transform.ts | manter | elements/transform.ts | a álgebra de transformação dos elementos (era tools/transform.ts; model/ era errado: lê tipos de elemento) |
| src/elements/level/commands.ts | mover | level/commands.ts |  |
| src/elements/material/schema.ts | dividir | material/schema.ts + material/built-in.ts | tabela de 75 materiais separada; isColor duplicado sai |
| src/elements/material/commands.ts | mover | material/commands.ts |  |
| src/elements/material/pattern.ts | mover | material/pattern.ts |  |
| src/elements/material/physics.ts | mover | material/physics.ts |  |
| src/elements/layers/stack.ts | mover | wall/layers.ts | operações de pilha de camadas (parede+piso) |
| src/elements/grid/schema.ts | mover | grid/schema.ts | onGrid funde com carry.onLine |
| src/elements/grid/commands.ts | mover | grid/commands.ts | renameGrid ≡ renameSection → helper |
| src/elements/grid/carry.ts | juntar | grid/schema.ts | onLine duplicado |
| src/elements/grid/fields.ts | mover | grid/fields.ts |  |
| src/elements/kinds/grid.ts | juntar | grid/kind.ts |  |
| src/elements/dimension/schema.ts | mover | dimension/schema.ts |  |
| src/elements/dimension/commands.ts | mover | dimension/commands.ts |  |
| src/elements/dimension/anchor.ts | mover | dimension/anchor.ts | segmentDistance → model |
| src/elements/dimension/constraints.ts | mover | dimension/constraints.ts | settle ≤12 rodadas com derive por rodada → derivação incremental |
| src/elements/dimension/auto.ts | mover | dimension/auto.ts |  |
| src/elements/dimension/fields.ts | mover | dimension/fields.ts |  |
| src/elements/kinds/dimension.ts | juntar | dimension/kind.ts | desenho de valor duplicado com measure → canvas/plan/labels |
| src/tools/dimension-tool.ts | mover | dimension/tool.ts |  |
| src/elements/note/schema.ts | mover | note/schema.ts |  |
| src/elements/note/commands.ts | mover | note/commands.ts |  |
| src/elements/note/fields.ts | mover | note/fields.ts |  |
| src/elements/kinds/note.ts | juntar | note/kind.ts |  |
| src/elements/guide/schema.ts | mover | guide/schema.ts |  |
| src/elements/guide/commands.ts | mover | guide/commands.ts |  |
| src/elements/guide/fields.ts | juntar | guide/commands.ts | 13 linhas |
| src/elements/kinds/guide.ts | juntar | guide/kind.ts |  |
| (movido no passo 4) src/elements/guide/tool.ts | mover | guide/tool.ts |  |
| (movido no passo 4) src/elements/guide/tool-ui.ts | mover | guide/tool-ui.ts |  |
| src/elements/column/schema.ts | mover | column/schema.ts | perfil I duplicado com beam → model/profile.ts |
| src/elements/column/commands.ts | mover | column/commands.ts |  |
| src/elements/column/fields.ts | mover | column/fields.ts |  |
| src/elements/kinds/column.ts | juntar | column/kind.ts |  |
| (movido no passo 4) src/session/kind-tools.ts | dividir | column/tool-ui, beam/tool-ui, roof/…, stair/…, railing/…, curtain/…, separator/…, section/…, measure/…, note/tool-ui | o 452-l de "todas as ferramentas de tipos" explode para cada pasta (beamClick/separatorClick/curtainClick triplicados viram um genérico) |
| (novo no passo 6) src/session/section-tools.ts | manter | session/section-tools.ts | ferramentas de corte, chamada e elevações, antes em kind-tools.ts |
| (novo no passo 6) src/session/annotation-tools.ts | manter | session/annotation-tools.ts | ferramentas de eixos, cotas e marcas, antes em kind-tools.ts |
| src/elements/beam/schema.ts | mover | beam/schema.ts |  |
| src/elements/beam/commands.ts | mover | beam/commands.ts |  |
| src/elements/beam/fields.ts | mover | beam/fields.ts |  |
| src/elements/kinds/beam.ts | juntar | beam/kind.ts | sweep → canvas/prisms |
| src/elements/roof/schema.ts | mover | roof/schema.ts |  |
| src/elements/roof/geometry.ts | mover | roof/geometry.ts |  |
| src/elements/roof/commands.ts | mover | roof/commands.ts |  |
| src/elements/roof/fields.ts | mover | roof/fields.ts |  |
| src/elements/kinds/roof.ts | juntar | roof/kind.ts |  |
| src/elements/stair/schema.ts | mover | stair/schema.ts |  |
| src/elements/stair/geometry.ts | mover | stair/geometry.ts |  |
| src/elements/stair/commands.ts | mover | stair/commands.ts |  |
| src/elements/stair/fields.ts | mover | stair/fields.ts |  |
| src/elements/stair/well.ts | mover | stair/well.ts |  |
| src/elements/kinds/stair.ts | juntar | stair/kind.ts |  |
| src/elements/railing/schema.ts | mover | railing/schema.ts |  |
| src/elements/railing/commands.ts | mover | railing/commands.ts |  |
| src/elements/railing/fields.ts | mover | railing/fields.ts |  |
| src/elements/kinds/railing.ts | juntar | railing/kind.ts |  |
| src/elements/curtain/schema.ts | mover | curtain/schema.ts |  |
| src/elements/curtain/commands.ts | mover | curtain/commands.ts |  |
| src/elements/curtain/geometry.ts | mover | curtain/geometry.ts |  |
| src/elements/curtain/fields.ts | mover | curtain/fields.ts |  |
| src/elements/kinds/curtain.ts | juntar | curtain/kind.ts | boxes → canvas/prisms |
| src/elements/separator/schema.ts | mover | separator/schema.ts |  |
| src/elements/separator/commands.ts | mover | separator/commands.ts |  |
| src/elements/kinds/separator.ts | juntar | separator/kind.ts | o "tipo linha de 2 pontos" vira helper compartilhado com grid/section/guide |
| src/elements/measure/schema.ts | mover | measure/schema.ts |  |
| src/elements/measure/commands.ts | mover | measure/commands.ts | tripla comparação redundante sai |
| src/elements/measure/place.ts | mover | measure/place.ts |  |
| src/elements/kinds/measure.ts | juntar | measure/kind.ts |  |
| (movido no passo 4) src/elements/measure/tool.ts | mover | measure/tool.ts | chainArea → convex.signedArea |
| src/elements/zone/schema.ts | mover | zone/schema.ts |  |
| src/elements/zone/commands.ts | mover | zone/commands.ts |  |
| src/elements/kinds/zone.ts | juntar | zone/kind.ts |  |
| src/elements/section/schema.ts | mover | section/schema.ts | finite/isPoint locais → guards |
| src/elements/section/commands.ts | mover | section/commands.ts |  |
| src/elements/kinds/section.ts | juntar | section/kind.ts | bolha desenhada 3× → um helper |
| src/elements/reference/schema.ts | mover | reference/schema.ts |  |
| src/elements/reference/commands.ts | mover | reference/commands.ts | referencesOf (morto) sai |
| src/elements/kinds/reference.ts | juntar | reference/kind.ts | inside() usa room/derive |
| (movido no passo 4) (movido no passo 4) src/ui/reference-tool.ts | mover | reference/tool-ui.ts |  |
| (movido no passo 4) src/elements/section/drawing.ts | dividir | section/drawing.ts | 711 l → desenho (paint) e geometria (clip/outline) separados |
| (novo no passo 6) src/elements/section/paint.ts | manter | elements/section/paint.ts | pintura do corte no canvas (antes em drawing.ts) |
| (novo no passo 6) src/elements/section/edges.ts | manter | elements/section/edges.ts | arestas, recortes e contornos do corte (antes em drawing.ts) |
| (movido no passo 4) src/ui/section-canvas.ts | mover | section/view.ts | caches ficam |
| src/ui/sections-dialog.ts | mover | section/dialog.ts |  |
| src/elements/drawing/schema.ts | mover | project/drawing.ts |  |
| (movido no passo 4) (movido no passo 4) src/ui/import-model.ts | mover | library/import-model.ts |  |
| (movido no passo 4) src/library/link.ts | mover | library/link.ts |  |
| src/elements/object/schema.ts | mover | library/schema.ts |  |
| src/elements/object/commands.ts | mover | library/commands.ts |  |
| src/elements/object/evaluate.ts | mover | library/evaluate.ts | 541 l ok (< 600 de dados/lógica); binary search medido |
| (novo no passo 6) src/elements/object/piece-shape.ts | manter | elements/object/piece-shape.ts | forma das peças avaliadas (antes em evaluate.ts) |
| (novo no passo 6) src/elements/object/param-limits.ts | manter | elements/object/param-limits.ts | limites dos parâmetros e cor da luz (antes em evaluate.ts) |
| src/elements/object/valid.ts | mover | library/valid.ts |  |
| src/elements/object/formula.ts | mover | library/formula.ts |  |
| src/elements/object/fields.ts | mover | library/fields.ts |  |
| src/elements/object/materials.ts | juntar | library/file.ts | 17 l |
| src/elements/object/library.ts, src/elements/object/library-more.ts, src/elements/object/library-bath.ts, src/elements/object/library-bedroom.ts, src/elements/object/library-before65.ts, src/elements/object/library-before66.ts, src/elements/object/library-decor.ts, src/elements/object/library-equipment.ts, src/elements/object/library-kit.ts, src/elements/object/library-kitchen.ts, src/elements/object/library-lights.ts, src/elements/object/library-living.ts, src/elements/object/library-office.ts, src/elements/object/library-outdoor.ts, src/elements/object/library-sectors.ts | mover | library/catalog/*.ts | dados; sem mudança de conteúdo |
| (novo no passo 6) src/elements/object/library-before66-a.ts | manter | object/library-before66-a.ts | 1a metade dos dados antes da v66 (estante, geladeira) |
| (novo no passo 6) src/elements/object/library-before66-b.ts | manter | object/library-before66-b.ts | 2a metade dos dados antes da v66 (árvore, torre de forno) |
| src/elements/object/library-families.ts | mover | library/catalog/families.ts |  |
| src/elements/presets.ts | mover | library/presets.ts |  |
| src/elements/kinds/object.ts | dividir | library/kind.ts + canvas/object-batch.ts | byMaterial/creaseEdges (3D batching) → canvas |
| src/elements/kinds/paint.ts | mover | elements/kinds/paint.ts (raiz elements/) | helpers de desenho compartilhados; nearSegment → model |
| src/elements/contract.ts | mover | elements/contract.ts (raiz elements/) | o registro continua genérico |
| src/elements/registry.ts | dividir | elements/registry.ts | move/drop/map/copy (edição) → project/kinds-edit.ts |

## session/
| (novo no passo 4) src/elements/sat.ts | manter | elements/sat.ts | o motor SAT de colisão (era app/collision.ts; lê kinds: é do domínio dos elementos) |
| (novo no passo 4) src/project/view-prefs.ts | manter | project/view-prefs.ts | o tipo persistido da preferência da vista 3D |
| (novo no passo 4) src/model/clip.ts | manter | model/clip.ts | o núcleo exato de recorte (spec §4; convex.ts re-exporta) |
| (novo no passo 4) src/elements/preview.ts | manter | elements/preview.ts | a constante PREVIEW_ID |
| (novo no passo 4) src/model/fs-name.ts | manter | model/fs-name.ts | safeFileName | — estado de interface com dono único e máquinas

| Arquivo | Ação | Destino | Nota |
| --- | --- | --- | --- |
| (novo no passo 5) src/session/state.ts | manter | session/state.ts | a forma do UiState (só tipos), com seus imports próprios |
| (novo no passo 5) src/ui/toast.ts | manter | ui/toast.ts | a pilha de avisos (3 no máximo), extraída do App |
| (movido no passo 4) src/session/app.ts | dividir | session/app.ts (fachada fina) + session/state.ts | UiState vira máquinas: tool (WallToolState etc. já existem), overlay, lifecycle |
| (novo no passo 6) src/session/app-placing.ts | manter | session/app-placing.ts | colocar portas, janelas e objetos (antes em app.ts) |
| (novo no passo 6) src/session/app-settings.ts | manter | session/app-settings.ts | encaixes, idioma, tema, teclas, navegador, sobreposições, conjuntos de camadas, faixa, painel (antes em app.ts) |
| (novo no passo 6) src/session/app-edit.ts | manter | session/app-edit.ts | desfazer/refazer, pavimento, organizar, modos de medida e marca, cotas automáticas (antes em app.ts) |
| (novo no passo 6) src/session/app-view.ts | manter | session/app-view.ts | alças, pavimento de baixo, projeções na tela, ponto do ponteiro, alturas, caixa (antes em app.ts) |
| (novo no passo 6) src/session/tool-events.ts | manter | session/tool-events.ts | eventos das ferramentas e setTool (fachada no App para elements/) (antes em app.ts) |
| (novo no passo 6) src/session/model-view.ts | manter | session/model-view.ts | geometria visível, seleção, paredes de dois pontos, enquadrar, refresh (fachada no App) (antes em app.ts) |
| (novo no passo 6) src/session/ui-initial.ts | manter | session/ui-initial.ts | o UiState inicial a partir das preferências (antes em app.ts) |
| (novo no passo 6) src/session/app-store.ts | manter | session/app-store.ts | o store que mantém aberturas, cômodos e cotas travadas (antes em app.ts) |
| (movido no passo 4) src/session/input.ts | dividir | session/input/pointer.ts, keys.ts, field.ts | pick/planHits → canvas/pick.ts; showHelp → ui/help.ts |
| (novo no passo 6) src/session/pointer-aim.ts | manter | session/pointer-aim.ts | mira do ponteiro: ponto no mundo, encaixes, escolha (antes em input.ts) |
| (novo no passo 6) src/session/pointer-state.ts | manter | session/pointer-state.ts | o estado do ponteiro com dono único, compartilhado com input-keys (antes lets + ponte get/set) |
| (novo no passo 6) src/session/pointer-handlers.ts | manter | session/pointer-handlers.ts | mover e apertar o ponteiro (antes em input.ts) |
| (novo no passo 6) src/session/pointer-release.ts | manter | session/pointer-release.ts | soltar o ponteiro e o fim por clique direito (antes em input.ts) |
| (novo no passo 6) src/ui/help-dialog.ts | manter | ui/help-dialog.ts | o diálogo de atalhos (antes em input.ts) |
| (novo no passo 6) src/ui/rename-in-place.ts | manter | ui/rename-in-place.ts | renomear o projeto na barra (antes em input.ts) |
| (movido no passo 4) src/session/input-keys.ts | juntar | session/input/keys.ts | letras de ferramenta codificadas → vêm das actions (defaultKeys) |
| (movido no passo 4) src/session/input-buttons.ts | juntar | session/input/buttons.ts |  |
| (movido no passo 4) src/session/keymap.ts | mover | session/keymap.ts |  |
| src/ui/menu-keys.ts | mover | session/menu-keys.ts |  |
| (movido no passo 4) src/session/view-keys.ts | juntar | session/input/keys.ts |  |
| (movido no passo 4) (movido no passo 4) src/model/section-box.ts | manter | session/section-box.ts | a caixa de corte, estado da vista (de app/, via model/) |
| (movido no passo 4) src/session/drag.ts | mover | session/drag.ts | hull (cópia) sai; estado de arrasto vira máquina |
| (novo no passo 6) src/session/marquee.ts | manter | session/marquee.ts | a seleção por janela e cruzamento (marqueePick, selectByMarquee), antes em drag.ts |
| (movido no passo 4) src/session/selection.ts | mover | session/selection.ts |  |
| (movido no passo 4) src/session/select-similar.ts | juntar | session/selection.ts | 8 linhas de delegação |
| (movido no passo 4) src/session/keyboard-select.ts | juntar | session/selection.ts | 11 linhas |
| (movido no passo 4) src/session/handles.ts | mover | wall/handles.ts | alças de parede |
| (movido no passo 4) src/session/object-handles.ts | mover | library/handles.ts | jambRate deriveGeometry por arrasto → cache |
| (movido no passo 4) src/session/temp-dims.ts | mover | canvas/plan/temp-dims.ts | thicknessOf duplicado sai |
| (movido no passo 4) src/session/next.ts | mover | session/next.ts | notNext (lista negra) → contrato por kind |
| (movido no passo 4) src/session/modify.ts | mover | session/modify.ts |  |
| (movido no passo 4) src/session/modify-tool.ts | mover | session/modify-tool.ts |  |
| (movido no passo 4) src/model/transform.ts | mover | session/transform.ts |  |
| src/tools/nudge.ts | mover | session/nudge.ts |  |
| src/tools/smart-guides.ts | mover | session/smart-guides.ts |  |
| (movido no passo 4) src/session/snap.ts | mover | session/snap.ts | slack fórmula repetida 5× → helper |
| (novo no passo 6) src/session/snap-types.ts | manter | session/snap-types.ts | os tipos do encaixe (SnapKind, Snap, SnapInput, GuideLine) e seus rótulos, antes em snap.ts |
| (novo no passo 6) src/session/snap-geometry.ts | manter | session/snap-geometry.ts | a geometria do encaixe (pés, cruzamentos, grade, ortogonal, travado), antes em snap.ts |
| src/tools/arrange.ts | mover | session/arrange.ts |  |
| (movido no passo 4) src/session/views-ui.ts | mover | session/views-ui.ts |  |
| (movido no passo 4) src/session/view-ui.ts | dividir | session/view/*.ts | keepSelectionInView/3d paralelos fundem |
| (movido no passo 4) src/session/actions.ts | mover | session/actions.ts | SNAP_PARTS duplicado com chrome sai |
| (movido no passo 4) src/ui/ribbon-tabs.ts | mover | ui/ribbon-tabs.ts | grupos repetidos (guides/dims ×2) → helpers |
| (novo no passo 6) src/ui/ribbon-context-tabs.ts | manter | ui/ribbon-context-tabs.ts | abas que vêm e vão: a da ferramenta e a contextual (antes em ribbon-tabs.ts) |
| (movido no passo 4) src/session/context-menu.ts | mover | session/context-menu.ts |  |
| (movido no passo 4) src/session/context-actions.ts | juntar | session/context-menu.ts |  |

## canvas/ — os desenhistas de cada vista

| Arquivo | Ação | Destino | Nota |
| --- | --- | --- | --- |
| src/render/plan-view.ts | dividir | canvas/plan/view.ts + fill.ts + tags.ts + marks.ts | draw() 397 l; fill O(n²) de cópia; getComputedStyle por quadro |
| (novo no passo 6) src/render/plan-walls.ts | manter | render/plan-walls.ts | como a planta pinta paredes (contorno, peças, camadas, fases, juntas), antes em PlanView.draw |
| (novo no passo 6) src/render/plan-types.ts | manter | render/plan-types.ts | o contrato da planta (PlanOverlay, DimMark, Insets, fitPlan), antes em plan-view.ts |
| (novo no passo 6) src/render/plan-annotations.ts | manter | render/plan-annotations.ts | a última camada da planta: textos, etiquetas, cotas, avisos, encaixe, antes em PlanView.draw |
| (novo no passo 6) src/render/plan-text.ts | manter | render/plan-text.ts | textos e marcas da planta (fontes, etiquetas, medida, encaixe, cotas, aviso, tracejado), antes métodos de PlanView |
| (novo no passo 6) src/render/plan-strokes.ts | manter | render/plan-strokes.ts | traços da planta (grade, linhas de referência, guias, alças, aberturas), antes métodos de PlanView |
| src/render/scene-3d.ts | dividir | canvas/scene/*.ts (sync, photo, style, pick, materials, box) | 1603 l; keys por JSON.stringify; hidden-style aloca por quadro |
| (novo no passo 6) src/render/scene-camera.ts | manter | render/scene-camera.ts | câmera: escolha, chão, pan, órbita, zoom, enquadrar, antes métodos de Scene3D |
| (novo no passo 6) src/render/scene-look.ts | manter | render/scene-look.ts | aparência: estilo, qualidade, luz, raio-X, fases, tema, antes métodos de Scene3D |
| (novo no passo 6) src/render/scene-sync.ts | manter | render/scene-sync.ts | sincronia com a geometria e imagem parada, antes métodos de Scene3D |
| (novo no passo 6) src/render/scene-cut.ts | manter | render/scene-cut.ts | corte: plano, caixa, linha de corte, ortográfica, antes métodos de Scene3D |
| (novo no passo 6) src/render/scene-render.ts | manter | render/scene-render.ts | um quadro da vista 3D, antes métodos de Scene3D |
| (novo no passo 6) src/render/scene-trace.ts | manter | render/scene-trace.ts | o traçado fotorrealista (passos, céu, fireflies, cópias traçadas), antes métodos de Scene3D |
| (novo no passo 6) src/render/scene-materials.ts | manter | render/scene-materials.ts | os materiais 3D (camadas, padrões, faint, lifelike, arestas), antes métodos de Scene3D |
| (novo no passo 6) src/render/scene-build.ts | manter | render/scene-build.ts | a construção da cena (prismas, aberturas, contornos, chão, tampas da caixa, planos de corte), antes métodos de Scene3D |
| (novo no passo 6) src/render/scene-light.ts | manter | render/scene-light.ts | luzes, sombras e efeitos, antes métodos de Scene3D |
| src/render/overlay-3d.ts | mover | canvas/overlay-3d.ts | tag duplicada do plan-view → canvas/labels |
| src/render/view-cube.ts | mover | canvas/view-cube.ts |  |
| (movido no passo 4) src/elements/prisms.ts | mover | canvas/prisms.ts | bloco de winding repetido 3× → helper |
| src/render/room-tags.ts | mover | canvas/plan/room-tags.ts | Box/meets duplicado do plan-view → um |
| src/render/trace-shader.ts | mover | canvas/photo/shader.ts |  |
| (movido no passo 4) src/elements/room/tiling.ts | mover | canvas/plan/tiling.ts |  |
| src/render/wall-paint.ts | mover | wall/paint.ts |  |
| (movido no passo 4) src/elements/material/hatch.ts | mover | canvas/plan/hatch.ts | loop de tile duplicado → um |
| (movido no passo 4) src/elements/object/textures.ts | dividir | canvas/textures.ts + library/preview.ts | previewMesh (UI) separa |

## ui/ — chrome, diálogos, i18n, estilos

| Arquivo | Ação | Destino | Nota |
| --- | --- | --- | --- |
| (movido no passo 4) src/i18n/messages.ts | dividir | i18n/*.ts (en/pt por domínio) | camada neutra (elementos e ui a usam; ADR: nenhum elemento importa ui) |
| (novo no passo 6) src/i18n/messages/ribbon.ts | manter | i18n/messages/ribbon.ts | textos en/pt: a faixa |
| (novo no passo 6) src/i18n/messages/hints.ts | manter | i18n/messages/hints.ts | textos en/pt: dicas de ferramenta, encaixes, medir, entrada digitada |
| (novo no passo 6) src/i18n/messages/commands.ts | manter | i18n/messages/commands.ts | textos en/pt: comandos e teclas |
| (novo no passo 6) src/i18n/messages/shell.ts | manter | i18n/messages/shell.ts | textos en/pt: barra de cima, paleta, menus, avisos, ajuda, rodapé |
| (novo no passo 6) src/i18n/messages/panel.ts | manter | i18n/messages/panel.ts | textos en/pt: painel de propriedades e avisos |
| (novo no passo 6) src/i18n/messages/editor.ts | manter | i18n/messages/editor.ts | textos en/pt: editor de definições, biblioteca, lojas |
| (novo no passo 6) src/i18n/messages/materials.ts | manter | i18n/messages/materials.ts | textos en/pt: materiais, padrões, camadas, tipos |
| (novo no passo 6) src/i18n/messages/elements.ts | manter | i18n/messages/elements.ts | textos en/pt: os elementos de construção |
| (novo no passo 6) src/i18n/messages/views.ts | manter | i18n/messages/views.ts | textos en/pt: vistas, referências, pavimentos, desenho, projetos, unidades |
| src/ui/styles.css | dividir | ui/styles/*.css por componente (tokens.css, shell.css…) | 3583 l; importa por ordem no styles.css raiz |
| (novo no passo 6) src/ui/styles/tokens.css | manter | ui/styles/tokens.css | parte de styles.css, na ordem da cascata |
| (novo no passo 6) src/ui/styles/layout.css | manter | ui/styles/layout.css | parte de styles.css, na ordem da cascata |
| (novo no passo 6) src/ui/styles/viewport.css | manter | ui/styles/viewport.css | parte de styles.css, na ordem da cascata |
| (novo no passo 6) src/ui/styles/panel.css | manter | ui/styles/panel.css | parte de styles.css, na ordem da cascata |
| (novo no passo 6) src/ui/styles/dialog.css | manter | ui/styles/dialog.css | parte de styles.css, na ordem da cascata |
| (novo no passo 6) src/ui/styles/popups.css | manter | ui/styles/popups.css | parte de styles.css, na ordem da cascata |
| (novo no passo 6) src/ui/styles/dialogs.css | manter | ui/styles/dialogs.css | parte de styles.css, na ordem da cascata |
| (novo no passo 6) src/ui/styles/ribbon.css | manter | ui/styles/ribbon.css | parte de styles.css, na ordem da cascata |
| (novo no passo 6) src/ui/styles/editor.css | manter | ui/styles/editor.css | parte de styles.css, na ordem da cascata |
| (novo no passo 6) src/ui/styles/store.css | manter | ui/styles/store.css | parte de styles.css, na ordem da cascata |
| src/ui/shell.ts | mover | ui/shell.ts |  |
| src/ui/controls.ts | mover | ui/controls.ts | searchSelect ≡ palette combobox → um |
| src/ui/fields.ts | dividir | elements/fields.ts (tipos) + ui/fields.ts (render) | fieldStates JSON.stringify por campo por render → barato, mantém; tipos no contrato dos elementos |
| (novo no passo 4) src/elements/fields.ts | manter | elements/fields.ts | os tipos Field/FieldOption/FieldState, o contrato que os kinds implementam |
| src/ui/panel.ts | mover | ui/panel.ts |  |
| src/ui/ribbon.ts | mover | ui/ribbon.ts | openMenu/menu.ts/searchSelect: um só sistema de popover |
| src/ui/menu.ts | mover | ui/menu.ts | idem |
| src/ui/palette.ts | mover | ui/palette.ts | combobox compartilhado |
| src/ui/search.ts | mover | ui/search.ts | os 5 `fold` locais dos diálogos importam daqui |
| src/ui/tooltip.ts | mover | ui/tooltip.ts |  |
| src/ui/browser.ts | mover | ui/browser.ts |  |
| src/ui/visibility-panel.ts | mover | ui/visibility-panel.ts |  |
| src/ui/library-tabs.ts | mover | ui/library-tabs.ts |  |
| src/ui/bar-place.ts | mover | ui/bar-place.ts |  |
| src/ui/cursors.ts | mover | ui/cursors.ts |  |
| (movido no passo 4) src/elements/wall/swatch.ts | mover | ui/swatch.ts | layer-editor reusa layerSwatch parametrizado |
| (movido no passo 4) src/i18n/units.ts | dividir | i18n/units.ts | formatação compartilhada por elementos e ui | `current` espelha doc.units → deriva por render (sem cópia) |
| src/ui/units-dialog.ts | mover | ui/dialogs/units.ts |  |
| src/ui/variables-dialog.ts | mover | ui/dialogs/variables.ts |  |
| src/ui/keys-dialog.ts | mover | ui/dialogs/keys.ts |  |
| src/ui/types-dialog.ts | dividir | ui/dialogs/store.ts (andaime) + wall/types-dialog.ts | andaime de loja ×6 → ui/dialogs/store.ts |
| src/ui/materials-dialog.ts | dividir | ui/dialogs/store.ts + material/dialog.ts | idem; row() duplicado com drawing-dialog |
| src/ui/objects-dialog.ts | dividir | ui/dialogs/store.ts + library/dialog.ts | fold local sai |
| src/ui/presets-dialog.ts | dividir | ui/dialogs/store.ts + library/presets-dialog.ts |  |
| src/ui/floors-dialog.ts | dividir | ui/dialogs/store.ts + room/floors-dialog.ts | floorSnapshot → room/snapshot.ts (gêmeo do wall-snapshot) |
| src/ui/openings-dialog.ts | dividir | ui/dialogs/store.ts + opening/dialog.ts |  |
| src/ui/levels-dialog.ts | mover | ui/dialogs/levels.ts |  |
| src/ui/projects-dialog.ts | mover | ui/dialogs/projects.ts | passa a usar o andaime dialog.ts (hoje re-implementa) |
| src/ui/drawing-dialog.ts | mover | ui/dialogs/drawing.ts |  |
| src/ui/overrides-dialog.ts | mover | ui/dialogs/overrides.ts | 2 blocos de linha de override → helper |
| src/ui/definition-editor.ts | dividir | library/editor/*.ts | 622 l; Preview usa meshSnapshot (fórmula de câmera duplicada) |
| (novo no passo 6) src/ui/definition-preview.ts | manter | ui/definition-preview.ts | a prévia 3D do editor de objetos (antes classe interna) |
| (novo no passo 6) src/ui/definition-kit.ts | manter | ui/definition-kit.ts | peças de formulário do editor (antes no fechamento) |
| (novo no passo 6) src/ui/definition-tabs.ts | manter | ui/definition-tabs.ts | as abas do editor de objetos (antes no fechamento) |
| src/ui/object-snapshot.ts | mover | library/snapshot.ts | palco WebGL compartilhado |
| src/ui/dialog.ts | mover | ui/dialog.ts | o andaime |
| (movido no passo 4) src/i18n/icons.ts | manter | i18n/icons.ts | nomes de ícone usados pelo contrato dos elementos |
| (movido no passo 4) src/ui/chrome.ts | dividir | ui/chrome/*.ts | renderRibbon/actionList por quadro → memo por chave |
| (novo no passo 6) src/ui/footer.ts | manter | ui/footer.ts | o rodapé a cada quadro (dica, teclas, campo de medida), antes em chrome.ts |
| (novo no passo 6) src/ui/float-bar.ts | manter | ui/float-bar.ts | a barra flutuante sobre a seleção e a dica de medida, antes em chrome.ts |
| (novo no passo 6) src/ui/ribbon.ts | manter | ui/ribbon.ts | a faixa desenhada a cada quadro e a tira da ferramenta, antes em chrome.ts |
| (movido no passo 4) src/ui/frame.ts | dividir | ui/frame/*.ts | rótulos O(rooms²); nextFields por quadro → memo |
| (novo no passo 6) src/ui/plan-overlay.ts | manter | ui/plan-overlay.ts | a planta a cada quadro: prévias, medidas, encaixe, guias, marcas (drawPlanOverlay), antes em frame.ts |
| (novo no passo 6) src/session/scene-frame.ts | manter | session/scene-frame.ts | a cena 3D posta em dia com a sessão a cada quadro (antes em ui/plan-overlay.ts; ui não importa render) |
| (novo no passo 6) src/ui/temp-dims.ts | manter | ui/temp-dims.ts | as cotas temporárias da seleção e seus campos, antes em frame.ts |
| src/app/section-view (ver acima) |  |  |  |

## apagar — mortos (verificados)

| Arquivo | Motivo |
| --- | --- |
| (apagado no passo 2) produção-morto: só `isPdfCanvas` é importado (render/hatch); o exportador PDF das pranchas saiu com a área removida. `isPdfCanvas` vira checagem de interface em hatch. **714 l** |
| src/elements/opening/index.ts | barril inconsistente sem usuários |
| src/elements/room/panel.ts | alias de tipo de 9 linhas |
| (dentro dos arquivos) | carriedRooms (carry.ts:54), referencesOf (reference/commands.ts:7), ~250 exports mortos do inventario.txt, 83 chaves de i18n, 15 classes CSS — cada um conferido por grep antes de tirar |

## outros

| Arquivo | Ação | Destino |
| --- | --- | --- |
| (movido no passo 4) src/main.ts | mover | main.ts (raiz src/) — monta session/app |
| src/assets.d.ts | manter | fica (declarações de tipos) |
| index.html | manter | fica (fonte do Google → decisões de F-0001 ficam para outra tarefa) |
