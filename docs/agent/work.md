# The task in hand: its notebook (printed whole at every session start and compaction by `.claude/hooks/printfile.cjs`)

Rewrite this file when a task starts: the owner's order word for word, how the work is done, and the steps. Then, after every step:
what was read (files and lines), what was found (file:line), what was changed, the commit, and what is next. Keep it under 9,000
characters: what is done moves to `docs/agent/history.md`.

## Task now (2026-10-28): reduce cad2 to the fundamental and make it work
The owner's order, word for word: `docs/prompt-escopo-fundamental.md` (the same text pasted in chat 2026-10-28; also in
`docs/agent/orders.md`). In short: keep walls, building elements, objects, views, precision, edit/file and the settings they use;
take out MEP, simulation, rules/diagnostics, budget, approval, lot/terrain, documentation, presentation (code leaves the app, stays in
tag `escopo-completo-2026-10-28`); saved projects keep those fields untouched (Doc carries them opaque, versioned migration in
io/project-file.ts). Then step 2: the `reviewing-whole-codebase` skill, `fix` mode, goal in the prompt.
Rules: one session, no subagents, no heredoc, no new features, commit per verified step (English, `git add` by path), push origin main.

## Steps
- [x] 0.1 Read the stray diff (3D wall handles: app.ts, frame.ts, overlay-3d.ts, plan-view.ts): coherent, tsc passes; committed 2c739a7
      with scripts/breaks, the prompt, orders.md; .gitignore += .playwright-mcp/, .breaks/. vigia.json / vigia-log.txt left alone
      (the guard's own files; touching them is denied by the hook).
- [x] 0.2 Tag escopo-completo-2026-10-28 on 2c739a7, pushed.
- [x] 0.3 This notebook.
- [x] 1.1 Inventory: every file of the areas leaving, and every import of them from the files that stay (the cut points).
- [x] 1.2 Boundary decisions (annotation, exports, points/analytic/debug panel), written below.
- [x] 1.3 Opaque fields in Doc + migration in io/project-file.ts.
- [x] 1.4 Remove each area and resolve each cut point at its cause.
- [x] 1.5 tsc, import map again, app opens, old project opens/saves the same. Commit, push.
- [ ] 2   Skill: install, read SKILL.md + references whole, run `fix` from start to end.

## Inventory (1.1, by scratchpad imports.cjs over all 358 files)
The table's 8 areas: 62 files, 10,874 lines (rules 6/956, docs 11/2484, terrain 9/1029, mep 11/2713, sim 11/1868, walk 4/477,
approval 3/286, costs 7/1061). 72 import cut points from kept files (actions, app, chrome, document, frame, input-buttons, input,
next-element, ribbon-tabs, kinds/note, kinds/object, material/commands+schema, registry, wall/fields, export-ifc, project-file,
plan-view, scene-3d, debug-panel, materials-dialog, sections-dialog). Members NOT in the table, found by imports:
app/logo-image.ts (only sheets + lot dialog), io/xlsx.ts (only budget dialog), the analytic structure (elements/mep/coordination.ts).

## Boundary decisions (criterion: serves the model of walls, elements, objects, views and precision?)
- Annotation: notes STAY (elements/note holds the level mark, a kept dimension kind; its sheet link is cut). Room tags and opening
  marks STAY (they show the model's own data in plan). Free tags (elements/tag, kinds/tag) and revision clouds (elements/cloud,
  kinds/cloud) LEAVE: documentation, not model. Their saved data is kept opaque.
- Exports: IFC/DXF/OBJ/GLB/image export and IFC import LEAVE (io/export-ifc, export-dxf, hatch-lines, export-obj, render/export-gltf,
  import-ifc, step.ts, saveImage3d): interop and documentation, not modelling. DXF import STAYS (reference drawing), mesh import STAYS
  (model as object).
- Points of interest (app/points.ts, points-ui.ts, ui/points-dialog.ts, view.points) LEAVE: presentation (a visitor's cards). Data kept.
- Analytic structure LEAVES with MEP (it lives in elements/mep/coordination.ts). Debug panel (ui/debug-panel.ts) LEAVES: it is built
  on the rules' diagnostics; app/error-log.ts stays if anything else uses it.
- Zones STAY (rooms taken together: part of rooms). app/stacked.ts STAYS (walls on the wall below).

## Step 1 progress (not committed yet)
- Done: files of all areas + boundary members git-rm'd (src and tests/mep,sim,rules,costs,approval). Doc: KEPT_FIELDS + `kept`
  (document.ts), version 67; project-file.ts keptOf() reads them raw, writeProject spreads them back at the top; layer sets lose
  'services' (category gone). Material physics moved to elements/material/physics.ts. registry/contract without terrain, mep, tag,
  cloud. note (sheet ref cut), object (terrain ground cut), scene-3d (soil cut), plan-view (heat cut), section-drawing (ground flag
  cut), wall/fields (modulation cut), ribbon-tabs, actions, kind-tools, next-element, room-ui, selection-ui, app.ts cleaned.
- New files (moved code, not new features): app/section-view.ts (sectionOf/sectionCanvas from old sheets.ts, used by the sections
  dialog); ui/drawing-dialog.ts (setDrawing + showDrawingSettings from old print-dialog.ts: the scale and pens dialog).
- Left: app-files, chrome, context-menu, frame, input-buttons, input-keys, input, object-handles, view-ui, views-ui, ui/browser,
  ui/shell (tour/point cards), i18n keys, CSS, tests; then tsc, import map, app opens, old project round trip.
- Mistakes made and fixed: a heredoc command (hung, stopped); a `sed '/x/='` that wrote "170" into selection-ui.ts (removed).

- Done after that: app-files (exports, IFC import), chrome, context menu (walkHere, addPoint), frame (sun, heat, norms, budget, points,
  clouds, MEP), input/input-keys/input-buttons (walk, tour, points, tag, cloud, spot, MEP, F7, Ctrl+P), view-ui, views-ui (tour),
  browser drawer, shell (walk button and stick, tour bar, point card, ToolId), scene-3d (site sun, walk camera, flights, walk doors),
  panel (norms, detail, terrain actions), persist (tour/walk prefs). Orphans taken out too: error-log.ts, ui/callout.ts, io/pdf.ts,
  io/zip.ts. i18n: 1,004 keys used only by the removed code (scratchpad i18n-unused.cjs, old vs new tree). CSS: 148 rules, 796 lines
  (scratchpad css-gone.cjs). Tests: area-only ones removed; mixed ones trimmed; project-file test + kept-fields round trip.
- Verified: tsc 0 errors; imports.cjs: 0 cut points, no area file left; orphans.cjs: only opening/index.ts (orphan before the cut);
  roundtrip.mjs (old build of the tag vs new build): 15/15 area fields and 28 model fields equal after 2 open/save; old app refuses
  the v67 file as newer. In the app (Playwright): opens, 0 errors; old-v66.json opened, saved, reopened, saved: 15/15 equal.
- [x] 1.1–1.5. Commit next.

## Next
Commit and push step 1; then step 2 (install the skill from the zip, read SKILL.md and references whole, run it).
