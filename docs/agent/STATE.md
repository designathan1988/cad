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
- Step 0 research: two background agents digesting sources → to be written into docs/pesquisa/fontes-refatoracao.md.
- Step 1 inventory DONE (see work.md "Steps" item 1 for the numbers; raw output in worktree .scratchpad/inventario*.txt, copia.txt):
  gods i18n 201 KB / scene-3d 84 / app 80 / plan-view 57 / input 51; 3 runtime cycle groups + 60-file type SCC; 2 orphans; ~250 dead
  exports; 83 unused i18n keys; 15 dead CSS classes; no copying from sibling projects.
- NOT started: baseline measurements (step 2), per-file reading (step 3), ADR 0004 (step 4), plan (step 5), execution (step 6), gates
  (step 7).
- Nothing changed in src/ yet. No commit made in this task yet (last commit aa2c376, pushed).

## Known traps (from memoria + repo)
- vigia.json / vigia-log.txt are the guard hook's own files: never touch. .whole-review/ and docs/revisao-interface/audit/ are the
  finished interface review's own files.
- Playwright tests are headless since 2026-10-28; one page only, never reopened when lost; state between runs: project/zoom/view
  persist, undo history does not (press Esc+Home and screenshot before coordinate clicks).
- tsc must stay at 0 errors before every commit; `npm run check` runs typecheck+vitest+build — vitest is forbidden by memoria
  fix-in-code-verify-in-app, so gates must be added as separate npm scripts (check cannot run vitest).
