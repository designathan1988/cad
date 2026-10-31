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

## Where it stands (2026-10-31)
- Branch worktree-revisao-interface: the refactor is done (check-architecture 0: direction, mutableLets, oversize, duplications;
  typed ids per kind; state machines: tool draft, drag, view 3D writer, lifecycle; fixes after the report). Notebook: work.md.
- main merged in (2595317): its 93 commits (F-xxxx fixes, file v68-v70, point tools F-0023 now session/point-tools.ts on ui.draft,
  per-frame derivation F-0014/F-0011) carried into the split files. tsc 0, gates 0, inventory 366/366, the file written byte-identical
  to main's for both test projects. main is fully contained in this branch (0 commits ahead of it).
- The interface of the owner's prototype (fixed bar of general commands, tools' rail, the tool's floating panel, view header,
  one right panel at a time, dark tokens) is in: 8e59330, ada446b, c345ff4, pushed. Checked headless at 1920 and 1280; console
  clean. Desktop only: never 880 or phone widths (owner, 2026-10-31).
- Closed 2026-10-31 (owner's /goal "Termine de uma vez por todas o que ainda está aberto!"): F-0072 (e297fed: single sliding
  leaf slides into the wall, shutter rolls up), F-0089 (unjoined straight walls overlapping reported), F-0091 (layer order
  said in the layer editor), F-0097 (30cd3a9: typed ids renamed by kind, zones/railings/arc measures follow; the main
  checkout still holds its own uncommitted copy of this fix in src/io/typed-ids.ts), general app test redone at 1920 in the
  new frame (fixes d7d79dc). Wall over column: the plan draws the column clean over the wall, an embedded column is normal:
  no warning added. F-0138 (627f8b9): a passage nearly straight of unlike walls refused its point; fixed, measured on
  10,000 scenes (suite's generators, scratch script, no suite run), the suite asks 100 %. F-0023 (6cb3daa, 4a5dda3):
  session/event-tools.ts, one descriptor per remaining tool; checked in the app tool by tool. The wrong roof drawn in the
  3D view of a test project deleted. Ledger .whole-review/FINDINGS.md updated once the owner allowed it ("Sim, pode
  editar", 2026-10-31): the six marked fixed with their Fix lines; 138 fixed, 2 rejected, none open.
- Console in photorealistic mode: THREE.Clock, WebGLPathTracer deprecation, X4000 shader notes (library-level, latest versions).

## Known traps (from memoria + repo)
- vigia.json / vigia-log.txt are the guard hook's own files: never touch. .whole-review/ and docs/revisao-interface/audit/ are the
  finished interface review's own files.
- Playwright tests are headless since 2026-10-28; one page only, never reopened when lost; state between runs: project/zoom/view
  persist, undo history does not (press Esc+Home and screenshot before coordinate clicks).
- tsc must stay at 0 errors before every commit; `npm run check` runs typecheck+vitest+build — vitest is forbidden by memoria
  fix-in-code-verify-in-app, so gates must be added as separate npm scripts (check cannot run vitest).
