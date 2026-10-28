# Work state of cad2 (printed whole at every session start, resume, clear and compaction by `.claude/hooks/printfile.cjs`)

KEEP THIS FILE UNDER 9,000 CHARACTERS AND TRUE. It is what comes back after a compaction: a stale line here is a lie told to the next
context. Rewrite it at once when a task starts, ends or changes; what is finished or old goes to `docs/agent/history.md`.

## The project
cad2: a parametric CAD/BIM application in the browser (TypeScript, Vite, three.js). Since 2026-10-28 only the fundamental: walls,
building elements, objects, views, precision, edit and file (`src/` 274 files). The areas taken out (services, simulation, rules,
costs, approval, lot/terrain, documentation, presentation, free tags, clouds, exports, points, debug panel) are in git tag
`escopo-completo-2026-10-28`; their data in saved projects is carried untouched in `Doc.kept` (file version 67).
The spec is `docs/plano-de-escopo.md`; the scope order is `docs/prompt-escopo-fundamental.md`.
Remote: github.com/designathan1988/cad (origin, main).

## The rules
`CLAUDE.md` (the owner's rules of work) and `.claude/memoria/MEMORIA.md` (every lesson, one file each). Both come back after a
compaction on their own; this file, the owner's orders (`docs/agent/orders.md`), the task's notebook (`docs/agent/work.md`) and where
the work stood (read from the conversation on disk) are printed by the hooks in `.claude/settings.json`.

## Where it stands (2026-10-28)
- Step 1 of the scope task (take the areas out) done and verified: tsc passes, 0 imports of the areas left (scratchpad imports.cjs),
  app opens with 0 console errors, an old v66 project with all 15 area fields opens, saves, reopens and saves with them byte-equal.
- Test suites not run (rule `fix-in-code-verify-in-app`); tests touching removed areas removed or trimmed, tsc checks them.
- vigia.json / vigia-log.txt are the guard hook's own untracked files: never touch them.
- Known breaks of the wall engine (reports/breaks/RELATORIO.md, scripts/breaks): a moved wall throws its neighbour far, a piece
  vanishes at a sharp T, overlaps without warning, split changes the plan, arc/line spike, wall gone at a 3-end node, and more.

## Task now
The scope task, step 2: waiting for the owner to restart Claude Code and run /reviewing-whole-codebase fix (docs/agent/work.md, Next).
