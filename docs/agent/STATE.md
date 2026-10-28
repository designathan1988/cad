# Work state of cad2 (printed whole at every session start, resume, clear and compaction by `.claude/hooks/printfile.cjs`)

KEEP THIS FILE UNDER 9,000 CHARACTERS AND TRUE. It is what comes back after a compaction: a stale line here is a lie told to the next
context. Rewrite it at once when a task starts, ends or changes; what is finished or old goes to `docs/agent/history.md`.

## The project
cad2: a parametric CAD/BIM application in the browser (TypeScript, Vite, three.js; `src/` ~68,600 lines, `tests/` ~17,200 lines).
The spec is `docs/plano-de-escopo.md` (15 phases); known problems are in `docs/pendencias.md` and `reports/breaks/RELATORIO.md`.
Remote: github.com/designathan1988/cad (origin, main).

## The rules
`CLAUDE.md` (the owner's rules of work) and `.claude/memoria/MEMORIA.md` (every lesson, one file each). Both come back after a
compaction on their own; this file, the owner's orders (`docs/agent/orders.md`), the task's notebook (`docs/agent/work.md`) and where
the work stood (read from the conversation on disk) are printed by the hooks in `.claude/settings.json`.

## Where it stands (2026-10-28)
- Last commit d8079c2 ("Photorealistic view opens without freezing; picked controls give the keyboard back").
- NOT COMMITTED, left by an earlier session, not checked: src/app/app.ts, src/app/frame.ts, src/render/overlay-3d.ts,
  src/render/plan-view.ts (90 insertions, 77 deletions). Read the diff before any work on those files; never stage them by accident.
- `npx tsc --noEmit` passes (2026-10-28). Tests were not run (rule `fix-in-code-verify-in-app`).
- Known breaks of the wall engine, reproduced by `scripts/breaks` (reports/breaks/RELATORIO.md): a moved wall throws its neighbour to
  ~10^14 m, a piece vanishes at a sharp T, overlapping walls without a corner or warning, split changes the plan, a spike at an arc/line
  corner, a wall gone at a 3-end node, an arc overlapping itself, results that change with the plan's position, flip losing 99 % of a
  wall, non-convex pieces. Plus a decision for the owner: flip with the reference line on a face moves the wall.

## Task now
None started. The next task is written in `docs/agent/work.md` when it starts.
