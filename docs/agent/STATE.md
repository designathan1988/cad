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
The scope task, step 2. The skill /reviewing-whole-codebase was STOPPED by the owner (2026-10-28, "já achou todos os
problemas? se já, pare de usar ela"): hooks uninstalled; its record stays in .whole-review/ (FINDINGS.md: 139 findings, 2 rejected,
18 marked fixed + F-0019 done in code, 1 blocked F-0138, 117 open; CURSOR.md: order and to-dos).
2026-10-28 22:30: wall drag never moved the wall (pre-existing since bea7894: registry kindLists carried the walls and
openings lists back over the moved ones); fixed in registry.ts kindLists (non-walled kinds only) and app.ts preview order.
Checked in the app at 1280: door slide alone, typed distance, H, Ctrl+Z/Y, ?, wall move + undo/redo, wall takes its door; at
1920: split keeps the plan. NOT checked (owner said stop opening the browser): merge, flip, mirror, grid axis, star F-0138,
next-wall panel, scale list F-0019, save/reopen v68, 880 px.
Fixed, tsc passes, committed with the above: F-0003, F-0010, F-0021, F-0030, F-0107, F-0136, F-0139, F-0045,
F-0068 (file v68 migration), F-0008 (keepOpenings: own wall only), F-0006, F-0042, F-0050, F-0051 (axis moves alone), F-0101,
F-0106, F-0087, F-0013, F-0019. To do: delete src/elements/grid/carry.ts and what only it used; test in the app (880/1280/1920 px,
star of walls F-0138); commit and push; then the rest (F-0049, F-0057, F-0023 RC3, S3, S4).
