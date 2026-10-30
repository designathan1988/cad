# The task in hand: its notebook (printed whole at every session start and compaction by `.claude/hooks/printfile.cjs`)

Rewrite this file when a task starts: the owner's order word for word, how the work is done, and the steps. Then, after every step:
what was read (files and lines), what was found (file:line), what was changed, the commit, and what is next. Keep it under 9,000
characters: what is done moves to `docs/agent/history.md`.

## Task now (2026-10-30): refactor all of cad2 in this worktree (branch worktree-revisao-interface)
The owner's order: full refactor of cad2 in `.claude/worktrees/revisao-interface`. Not an audit: change the code. Split/merge files and
functions, move each thing to its feature folder, delete dead/duplicated code, fix poor performance, give each state a single owner and
source of truth, replace loose flags with state machines, fix architecture/paradigm where measurement shows they are wrong. The app must
keep doing everything it does today, looking the same. Follow CLAUDE.md and all `.claude/memoria/` files.
Unchangeable: behavior/appearance (1:1 screenshots unless fixing a defect, with before/after), project file format (old project opens,
saves, reopens with Doc.kept byte-equal), visual quality (no adaptive detail/LOD/samples/shadow/resolution tricks; photoreal stays clean),
UI rules (one place per command, compact density, no raw px in CSS, styled controls).
Method order: 0 research → 1 script inventory → 2 baseline (big project script, ?perf, renderer.info, CPU/mem profiles, reference
screenshots) → 3 read every file whole, annotate → 4 ADR 0004 target architecture → 5 ordered plan → 6 execute steps (change + tsc 0 err
+ real gestures + screenshots vs reference + measurements not worse + round-trip if file touched + commit en + push + update this file) →
7 every defect found fixed at cause. Stop condition: all files treated, all state owned, no cycles/wrong-direction imports/orphans/dead
exports/dead i18n or CSS/removed-area leftovers/duplication, no god files (state the limit), all measurements equal or better, 0 console
errors, old project round-trip equal, gates in scripts/ wired to npm run check.
Rules: no sampling, no excuses, every number pasted, no test suites/mutation, no heredoc, no asking, agents only for research/reading
(with exact list+format, claims verified by opening cited lines), work.md is the control point on compaction, ONE Playwright window
reused (leave no servers/browsers at the end), record new learnings in .claude/memoria/, answer in pt-BR.

## Steps
- [x] 0. Research: two agents (design theory; three.js 0.186 + libs + DevTools/Canvas2D) → docs/pesquisa/fontes-refatoracao.md.
- [x] 1. Inventory (scratchpad .scratchpad/tmp-*.mjs → inventario*.txt, copia.txt):
  - 277 TS files + styles.css. Gods: i18n.ts 201 KB/4330 l; scene-3d.ts 84 KB/1603; app.ts 80 KB/1847; plan-view.ts 57 KB/1250;
    input.ts 51 KB/1122; object/library-* ≈ 250 KB total (17 files); chrome.ts 36 KB; frame.ts 35 KB.
  - Folder matrix: core imported by all, imports nothing (good). app→elements 204, elements→app 55 (WRONG direction), io→elements 30,
    render→elements 26, ui→elements 60, tools→app 13. Cycles: runtime SCCs (document↔geometry↔registry/kinds; app-files↔app↔chrome↔
    frame↔wall-ui; input↔input-keys↔input-buttons) + one 60-file type SCC over kinds/*.
  - Orphans: src/assets.d.ts (type decls, needed by tsc), src/elements/opening/index.ts (dead).
  - Dead exports: ~250 listed in inventario.txt (library-* constants likely collected via namespace — verify each before removing).
  - i18n: 2112 keys, 83 unused (inventario3.txt; beware false positives used inside i18n.ts itself: mark.door/mark.window via
    markPrefix). CSS: 15 classes unused. Removed-area leftovers: only those i18n/CSS (other mentions are comments/Doc.kept, verified).
  - Copy detection (k-gram fingerprints) vs ../cad, ../builder, ../oriel, ../webconstructor: NO real duplication (max 5 coincidental
    grams). cad2 is not a copy of the siblings.
- [ ] 2. Baseline: big-project generator script (scripts/), ?perf + renderer.info + heap at 1280/880, screenshots of every
      view/tool/dialog, 100 undo/redo, DXF reference, open/save timings.
- [ ] 3. Read every file whole; per-file disposition in docs/refatoracao/inventario.md (keep/split/merge/move/rename/delete + mutable
      state + hot paths).
- [ ] 4. docs/adr/0004-arquitetura.md (feature folders, allowed dependency direction, 3 sources of truth: Projeto/Sessão/Preferências,
      state machines: lifecycle/tool-submode-drag-typed/views/dialogs, branded IDs, public API for scripts/breaks+tests+hooks, paradigm
      decision by measurement).
- [ ] 5. Ordered plan (commit-sized steps; first = repeatable verification scripts + capture roteiro; then bases: truth sources, state
      machines, typed IDs, public API; then expensive paths and god files; then the rest).
- [ ] 6. Execute.
- [ ] 7. Gates in scripts/ (owner-writes, module-top let, import direction, duplication, file size) wired to npm run check.

## Where it stands
Worktree had the interface-review task done (branch pushed to origin/worktree-revisao-interface, HEAD aa2c376). That task's leftovers
(.whole-review/, docs/revisao-interface/audit/) stay. npm install done in worktree. Scratchpad: C:/Users/Jonathan/.claude/scratchpad/
cad2-refatoracao (empty; scripts live in .scratchpad/ inside the worktree, gitignored — add .scratchpad/ to .gitignore).

## Next
Step 2 baseline: write scripts/bigproject.mjs generating a large project (hundreds of layered walls, several levels, many
doors/windows/objects/rooms), save as JSON to load in the app; measurement script + reference screenshots via the ONE Playwright
window; record numbers in docs/refatoracao/linha-de-base.md.
