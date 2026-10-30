# ADR 0004 — Arquitetura-alvo da refatoração

Data: 2026-10-30 · Status: aceito (decidido pela medição da linha de base e pelas fontes em
docs/pesquisa/fontes-refatoracao.md; ver docs/refatoracao/linha-de-base.md)

## Contexto

O cad2 tem 277 arquivos TS em pastas por camada (app, core, elements, io, render, tools, ui). A medição no
projeto grande (408 paredes, 472 aberturas, 180 cômodos) mostrou: arrastar uma parede custa ~1 s por
movimento; mover por teclado 1,57 s; o primeiro quadro 3D 34,8 s com 4819 draw calls e 1504 geometrias;
hover ~116 ms (pico 1582 ms no primeiro); histórico de desfazer retém ~8 MB por passo. O inventário mostrou:
6 arquivos-deus (201–84 KB), 3 grupos de ciclos de runtime, um SCC de tipos de 60+ arquivos, ~250 exports
mortos, 83 chaves de i18n e 15 classes CSS sem uso, elementos espalhados por 4 pastas (parede: app/,
tools/, elements/wall/, ui/), e `UiState` com ~50 campos soltos onde boa parte são flags de ferramenta.

## Decisão

### 1. Pastas por recurso (fatia vertical), direção de dependência

Cada elemento/recurso mora numa pasta só, com tudo o que é dele:

```
src/
  project/        # o documento, comandos, formato, persistência (antigo core/store, app/document, io/project-file…)
  model/          # geometria compartilhada e utilidades sem dono de elemento (vector, tolerance, rtree, id)
  wall/           # schema, tipos, engine de juntas, geometria, comandos, campos, ferramenta, desenhos
  opening/ room/ column/ beam/ roof/ stair/ railing/ curtain/ separator/ grid/ guide/
  dimension/ measure/ note/ section/ reference/ zone/ object/ material/ level/
  session/        # estado de interface com dono único: ferramenta, seleção, vistas, câmera, máquinas de estado
  canvas/         # render: planta 2D, cena 3D, overlay, cubo (os "renderers" de cada vista)
  ui/             # chrome: shell, ribbon, painel, diálogos, i18n, estilos — consome session/ e project/
  library/        # as bibliotecas de objetos (dados) de object/
```

Direção permitida (gate por script): `ui → session → {project, canvas} → {elementos} → model`, e
`elemento A → elemento B` só quando A hospeda em B (opening → wall) ou deriva dele (room → wall), nunca o
inverso; `canvas → elementos` (lê derivados); nenhum elemento importa ui/session. `project/` não importa
elementos além de schema+validação de leitura de arquivo. Ciclos: nenhum, nem de tipo (hoje o registro
kinds/* ↔ registry ↔ app fecha 60 arquivos; o registro passa a viver em elements a partir dos próprios
módulos, sem voltar para app).

### 2. As três fontes de verdade, cada uma com um dono

- **Projeto** (o Doc): tudo o que vai para o arquivo. Dono: `project/store.ts` (o Store atual, sem
  mudança de paradigma — ver §5). Muda só por comando; desfazer/refazer do Store.
- **Sessão**: ferramenta, submodo, seleção, arrasto, entrada digitada, vista, câmera, caixa de corte,
  painéis, toasts. Dono: `session/` — hoje são ~50 campos mutáveis de `UiState` + `let`s de módulo em
  input*/persist/frame + closures; viram máquinas de estado (§3) com uma API de transição por evento. Nada
  de cópia sincronizada: painel/ribbon/navegador/planta/cena são derivados que se atualizam por notificação
  do estado que les (Observer + Dirty Flag, Nystrom), nunca guardando segunda cópia.
- **Preferências**: unidades, teclas, idioma, densidade, lembranças de vista. Dono: `session/prefs.ts`
  (localStorage), unicamente via `set(patch)`.

### 3. Máquinas de estado (no lugar das flags soltas)

- **Ciclo de vida**: `booting → ready → opening/saving/importing → ready | failed` (hoje espalhado em
  boot/app-files/persist closures).
- **Ferramenta → submodo → arrasto/entrada digitada**: cada ferramenta tem seu estado nominal (os
  `WallToolState`/`OpeningToolState`/… já existem como uniões — viram a máquina canônica; `setTool` reseta
  por transição, não à mão campo a campo como em app.ts:744-795).
- **Vistas**: `plan | 3d` × `{cubo, corte, seção, foto}` × pavimento × caixa de corte (view3d.ts já é quase
  isso; ganha guardas e transições nomeadas).
- **Diálogos/menus/paleta**: uma máquina `overlay: none | dialog(id) | menu(id) | palette` em vez de
  `helpBack.hidden` + remoções de DOM ad hoc.
- Demais flags que o código mostrar (arc-edit, alças) entram no mesmo molde. Hierarquia só onde pagar
  (Harel): ferramenta-pai trata Esc/Enter; ortho/regiões não simuladas.

### 4. IDs com tipo próprio (branded)

`type WallId = Brand<string,'wall'>` etc. (conascência nome/tipo no lugar de prefixo de string). Construtores
espertos (`newWallId()`), decodificação na fronteira do arquivo (io) e do teclado/persistência. Sem custo em
runtime (apagado na compilação).

### 5. Paradigma: manter o Doc imutável por comandos (decidido pela medição)

A medição mostra que o paradigma não é o gargalo: desfazer custa 208 ms (restaurar versão + re-render
memoizado) e o custo de mover (1,57 s) está na **derivação das juntas para o pavimento inteiro** e no
**redesenho da planta**, não na imutabilidade (nudge de abertura, que re-deriva pouco, custa 84 ms). A
leitura completa confirmou: o motor de juntas (elements/wall) não tem cache nenhum — `computeWallGeometry`
roda por pavimento × faixa de altura por edição (app/geometry.ts:235), a descoberta é O(W²) bruta e o único
cache (`geometryOf`, WeakMap por identidade do Doc em app/carry.ts:59) perde toda edição porque o Doc é
novo; há ainda 6 sítios que chamam `deriveGeometry` direto em cópias `{...doc}` sem cache. Decisão:
- manter Store imutável + comandos;
- **derivação incremental por vizinhança** (índice espacial por pavimento — core/rtree já existe): mover uma
  parede re-deriva ela + quem a toca + suas aberturas + cômodos ao redor, nunca o prédio; o cache passa a
  chavear por versão de lista, não por identidade do Doc;
- **limite de memória do histórico** (~8 MB/passo medidos; 100 passos ≈ 800 MB): passo grande guarda o
  comando invertido em vez da versão (Command undo, Nystrom), sem mudar o formato do arquivo;
- a ida e volta do arquivo não muda (portão byte-equal).

### 6. API pública tipada (scripts/breaks, testes, hooks)

`src/public-api.ts`: o App e o Store expostos por uma interface nominal (projetos, comandos, medições,
capturas), usada por scripts/breaks e pelos portões; nada fora dela importa internos do app.

### 7. Arquivos-deus

Limite adotado: **400 linhas por arquivo de lógica** (a spec de juntas já usa esse número; i18n/styles.css
são dados e ficam em pares pt/en por domínio e seções por componente, com teto de 600 por arquivo de dados).
Exceção registrável em ADR: nenhum arquivo novo pode passar do teto; os seis atuais são divididos nos
passos do plano (work.md).

### 8. Qualidade visual e comportamento (não negociável)

Sem LOD, sem amostras a menos, sem resolução menor. Fotorealista continua com as regras da memória
photoreal-trace. As capturas de referência (hash de pixels + DOM por parada) são o critério de igualdade;
o formato do arquivo é congelado (portão de ida e volta em scripts/validate-project.ts).

## Consequências

- Cada passo do plano move código já para a pasta final (nada de mover duas vezes).
- Os portões em scripts/ (direção de imports, sem `let` mutável no topo de módulo, tamanho de arquivo,
  escrita fora do dono, duplicação) seguram a arquitetura depois de pronta.
- A refatoração não muda nada do que o usuário vê: cada passo compara capturas e medições com a linha de base.
