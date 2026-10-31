# Linha de base da refatoração (2026-10-30)

Medida antes de qualquer mudança (tarefa, passo 2), no worktree `revisao-interface` (HEAD aa2c376 + o ponto de
medição `window.__cad2`). Projeto grande gerado por `scripts/bigproject.mjs`: **408 paredes** (136/pavimento,
4 tipos com camadas), **472 aberturas**, **180 cômodos**, **180 pisos**, **145 objetos**, 15 guias, 1 referência
DXF de 8.000 linhas, 3 pavimentos, 365 KB. Carregado pela localStorage; `?perf` desnecessário (app.lastFrame).

Como repetir: `npm run dev`; aba única do navegador em http://localhost:5173/ com `localStorage` =
projeto gerado e IndexedDB 'cad2' removida; `scripts/baseline.mjs` avaliado na página (partes plan/history/3d/open);
`scripts/ref-tour.mjs` + `scripts/ref-steps.mjs` para o roteiro de capturas. Resultados crus em
`.scratchpad/baseline-*.json` e `.scratchpad/ref/manifest.json` (não commitados; os números estão aqui).

## Números (1280×800, a menos que dito)

| Caso | Valor |
| --- | --- |
| Render da planta (nada mudando) | média **183 ms** (p50 205, máx 260; passo `plan` 106) |
| Hover na planta (1 movimento do ponteiro) | média **116 ms**; **o 1º movimento após carga: 1582 ms** (constrói caches de snap/pick) |
| Pan (botão do meio) | média 111 ms |
| Zoom (roda) | média 148 ms |
| Arrastar parede unida a outras (L/T/X) | **~1000 ms por movimento** (p50 1001, máx 1180) |
| Mover por teclado (1 nudge de parede = comando + derivação + render) | **1574 ms** (p50 1583; máx 1710; n=10) |
| Desfazer (1 passo) | **208 ms** (p50 227) |
| Refazer (1 passo) | **184 ms** |
| Histórico de desfazer (memória retida) | **~8 MB por passo** (133 MB após 10 passos; 99 MB depois de desfazer tudo) |
| Long tasks por cenário | 28–45; máx **3515 ms**; 24–42 acima de 100 ms |
| Abrir o projeto grande (File → openFile) | **1282 ms** |
| Planta em 880×800 | render 119 ms; hover 94; pan 96; zoom 87; arrasto ~800 ms/movimento |
| Heap ao fim (planta / 3D) | 54–77 MB / **284 MB** |

## 3D

| Caso | Valor |
| --- | --- |
| Primeiro quadro 3D do projeto (construção da cena) | **34 762 ms** (passo `3d` 32 373) |
| Quadro 3D em regime (app.render) | média 33,5 ms (passo 3d ~9) |
| Redesenho completo forçado (invalidate + render) | **614 ms** |
| renderer.info (1 quadro, autoReset off) | **4819 draw calls**, 802 479 triângulos, 1504 geometrias, 11 texturas, 13 programas |
| Fotorrealista (estilo photo) | converge por amostras; referência capturada aos 30 s (hash aa6900d8d1641b63; a cada execução o ponto de parada varia, então a comparação é visual, não de hash) |

Sem InstancedMesh/BatchedMesh: uma malha por peça por camada (1504 geometrias; 4819 chamadas de desenho).

**Ressalva de comparabilidade (2026-10-30):** os números 3D desta tabela (chamadas, triângulos, geometrias e
os hashes de pixels das paradas de vista 3D) são **do estado daquela sessão**: o frustum da câmera (o
enquadramento da primeira vez consome uma flag por carga), o resíduo do estilo foto (céu/tonalidade) e o
nível mostrado mudam os contadores e os pixels sem nenhuma mudança de código. A porta confiável entre
sessões é: hash da **planta** (determinístico, provado), tsc, 0 erros de console, portões de arquitetura e
inspeção visual do 3D (contadores lidos dentro da mesma sessão para comparar antes/depois de um passo).

## Estado do app durante a medição

- 0 erros de console; sem overlay do Vite; boot limpo.
- Painel do navegador de teste oculto bloqueia rAF/WebGL: medições 2D funcionam ocultas; **3D exige painel visível**
  (anotado para as repetições). Capturas de tela do hospedeiro não compõem com o painel; a referência visual é
  **hash SHA-256 dos pixels do canvas + snapshot DOM** por parada (67 paradas: vistas, estilos, caixa de corte,
  explode, orto, elevação, 27 ferramentas, 16 diálogos, paleta, navegador, painel, tema, idioma), miniaturas
  guardadas em `.scratchpad/ref/`.
- Um só evaluate por comando: tarefas longas com mais de um dispatch derrubam o canal do navegador (anotado).

## Leituras para o ADR 0004

1. **Arrastar/mover parede (~1–1,6 s) é o pior caminho por edição**: toda a derivação das juntas é refeita para o
   pavimento; a renderização da planta (106–183 ms) é a segunda metade. Um arrasto de 10 movimentos segura a
   thread por ~10 s.
2. **Primeiro quadro 3D de 35 s** (construção de 1504 malhas) e 4819 draw calls em regime: alvo direto de
   BatchedMesh/InstancedMesh (three r186: addInstance/setVisibleAt; conferido no fonte local).
3. **Hover ~116 ms/movimento** com pico de 1582 ms no primeiro: caminhos de snap/pick refazem listas inteiras
   (elementPoints, planHits) — sem índice espacial persistente entre renders.
4. **Histórico por versões inteiras custa ~8 MB/passo** no projeto grande: com 100 passos, ~800 MB. O paradigma
   imutável+caching aguenta o projeto (nudge 1,6 s é derivação, não cópia), mas o histórico sem limite é o risco
   de memória; medir de novo com 100 passos na execução do passo de estado.
5. Undo/redo em si (208/184 ms) é barato: restaurar uma versão derivada é quase só re-render; a derivação é
   memoizada por elemento (registry.ts).
6. O plano de escopo (fase 1) já pedia recálculo incremental, índice espacial e workers; a medição confirma.
