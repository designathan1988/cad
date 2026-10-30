# Work state of cad2 (printed whole at every session start, resume, clear and compaction by `.claude/hooks/printfile.cjs`)

KEEP THIS FILE UNDER 9,000 CHARACTERS AND TRUE. It is what comes back after a compaction: a stale line here is a lie told to the next
context. Rewrite it at once when a task starts, ends or changes; what is finished or old goes to `docs/agent/history.md`.

## The project
cad2: a parametric CAD/BIM application in the browser (TypeScript, Vite, three.js). Since 2026-10-28 only the fundamental: walls,
building elements, objects, views, precision, edit and file (`src/` 277 ts files). The areas taken out are in git tag
`escopo-completo-2026-10-28`; their data in saved projects is carried untouched in `Doc.kept` (file version 67).
The spec is `docs/plano-de-escopo.md`; the wall engine is specified in `docs/wall-joins-spec.md` (exact convex cuts, no booleans).
Remote: github.com/designathan1988/cad (origin, main).

## The rules
`CLAUDE.md`, `.claude/memoria/MEMORIA.md` (each lesson its own file), `docs/agent/orders.md` (owner's words), `docs/agent/work.md`
(this task's notebook). Task rules: no test suites/mutation, no heredoc, no asking, ONE headless Playwright window reused, commit+push
per verified step, answers in pt-BR, work.md is the control point after compaction.

## Task now (2026-10-30): the whole-codebase refactor
Branch `worktree-revisao-interface` in the worktree `.claude/worktrees/revisao-interface` (its own checkout with node_modules
installed; main checkout stays untouched; work on the worktree only). Full order in `docs/agent/work.md` ("Task now" + steps).
Nothing app-visible may change: 1:1 screenshots, project file format frozen (Doc.kept byte-equal round trip), no visual-quality
tricks for speed, UI rules (one place per command, compact density, no raw px, styled controls).

## Where it stands
- Step 0 research DONE → docs/pesquisa/fontes-refatoracao.md (committed).
- Step 1 inventory DONE (numbers in work.md; raw in .scratchpad/).
- Step 2 baseline DONE → docs/refatoracao/linha-de-base.md (committed). Headlines: wall drag ~1s/move,
  keyboard move 1.57s, first 3D frame 34.8s, 4819 draw calls/1504 geometries, undo 208ms/redo 184ms,
  history ~8MB/step, open big project 1.28s, hover 116ms (first 1582ms). Reference set: 67 stops
  (pixel-hash + DOM snapshot per stop) in .scratchpad/ref/manifest.json; roteiro committed
  (scripts/ref-tour.mjs, scripts/ref-steps.mjs).
- Measurement handle window.__cad2 added in src/app/main.ts (read-only). Commit b197ee4 pushed.
- Step 3 (read every file): 7 reading agents running over all remaining files (render, app×2, wall+core+io,
  elements, kinds+tools+ui, io). Their claims to be verified by opening cited lines; gods (app.ts, input.ts)
  already read whole by me.
- Step 4 ADR 0004 DRAFTED (docs/adr/0004-arquitetura.md): feature folders + direction gate, 3 truth owners
  (Projeto/Sessão/Preferências), state machines, branded IDs, keep immutable-Command paradigm (measured),
  BatchedMesh/InstancedMesh for 3D, incremental derivation for joins/plan, 400-line cap, public API.
- NOT started: per-file disposition table (docs/refatoracao/inventario.md), ordered plan in work.md,
  execution steps, gates in scripts/ wired to npm run check.
- Browser: ONE IAB tab (id iab-tab:487c2668…, http://localhost:5173/, big project loaded), pane hidden for
  2D / must be VISIBLE for 3D work (hidden pane blocks rAF/WebGL; host screenshots never compose — use
  canvas pixel-hash instead). Evaluate: real functions only (strings return {}); ONE dispatch per evaluate
  (multi-dispatch kills the channel). Dev server running in background.

## Known traps (from memoria + repo)
- vigia.json / vigia-log.txt are the guard hook's own files: never touch. .whole-review/ and docs/revisao-interface/audit/ are the
  finished interface review's own files.
- Playwright tests are headless since 2026-10-28; one page only, never reopened when lost; state between runs: project/zoom/view
  persist, undo history does not (press Esc+Home and screenshot before coordinate clicks).
- tsc must stay at 0 errors before every commit; `npm run check` runs typecheck+vitest+build — vitest is forbidden by memoria
  fix-in-code-verify-in-app, so gates must be added as separate npm scripts (check cannot run vitest).
