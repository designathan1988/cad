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
1920: split keeps the plan. Committed 2d16f98. Then headless (owner's order): merge, flip, axis moves alone, door slides
alone, reload keeps the project, wall move/undo at 880 all OK; fixed float bar over the views' card and an axis bubble, and
the axis hint text (948333c). Then headless, all OK with no new code defect: mirror (copy), star of 8 walls (arms 20° apart
split clean: F-0138 not reproduced), next-wall fields (ribbon = panel; -0.30 top reaches the drawn wall), scale list inside a
saved view (F-0019: plan follows), download v68 + open + download again: only the name differs. Known, not fixed: a mirrored
wall over a column with no warning (overlaps-without-warning break).
Then F-0049 (curtain grid bounded by 10 cm panels) and F-0057 (level with elements cannot be deleted) fixed and checked
(c791628). F-0023 (RC3) partly fixed, parts 1-4 (8f16083, 3a2ca4b, 703d154, 2765255): app/point-tools.ts holds 16 tools
(beam, separator, curtain, railing, roof, stair, grid, section, callout, guide, column, note, levelMark, calibrate, mark,
dimension), each checked headless. Left in the chains on purpose: tools with their own event machines (wall, floor, room,
measure, modify, split, corner, opening, object). S3 fixed and checked headless: F-0095, F-0117, F-0047, F-0083, F-0035, F-0058 (+ roof covering field restored), F-0090, F-0104, F-0137, F-0020, F-0009, F-0029, F-0053, F-0075, F-0059, F-0113, F-0027, F-0120, F-0001, F-0111, F-0112, F-0024, F-0093, F-0034, F-0043, F-0032, F-0071, F-0078, F-0065 (file v69), shadow-map warning. 19 S3 and 64 S4 open. Third-party console noise left: three-bvh-csg 0.0.18 (latest) passes maxLeafSize. Tests run headless by scratchpad pw/drive.cjs.
Fixed, tsc passes, committed with the above: F-0003, F-0010, F-0021, F-0030, F-0107, F-0136, F-0139, F-0045,
F-0068 (file v68 migration), F-0008 (keepOpenings: own wall only), F-0006, F-0042, F-0050, F-0051 (axis moves alone), F-0101,
F-0106, F-0087, F-0013, F-0019. To do: delete src/elements/grid/carry.ts and what only it used; test in the app (880/1280/1920 px,
star of walls F-0138); commit and push; then the rest (F-0049, F-0057, F-0023 RC3, S3, S4).
