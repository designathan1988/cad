# History of cad2 (finished work moved out of work.md and STATE.md)

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
- [x] 2. Baseline DONE → docs/refatoracao/linha-de-base.md; commit b197ee4 (scripts + window.__cad2 + ADR draft + this notebook).
  Headlines: wall drag ~1 s/move; keyboard move 1.57 s; first 3D frame 34.8 s; 4819 draw calls/1504 geoms; undo 208 ms/redo 184 ms;
  history ~8 MB/step; open big project 1.28 s; hover 116 ms (first 1582 ms); 67 reference stops (pixel hash + DOM).
- [~] 3. Read every file: I read whole myself: app.ts, input.ts, document.ts, registry.ts, project-file.ts, store.ts, persist.ts,
  boot.ts, main.ts, view-3d.ts, project-db.ts (part), schemas wall/opening/room/object/guide/reference. 7 reading agents over the rest;
  digests received and SPOT-VERIFIED (opened cited lines; all confirmed): render/*, app-core (chrome/frame/geometry/select-drag/
  kind-tools/actions/wall-ui/wall-stops/opening-ui/modify-ui/room-ui/guide-ui/next-element/carry/keep-openings/collision), app-rest.
  Confirmed hot facts: plan-view fill() copies arrays per piece (plan-view.ts:441-442); frame.ts room labels O(rooms²) (frame.ts:199-204);
  chrome renders ribbon + actionList (~100 actions) EVERY frame (chrome.ts:546-577, frame.ts:331); scene-3d JSON.stringify per solid for
  keys (1199/1223); hull duplicated collision.ts:28≡select-drag.ts:428; thicknessOf≡wallThickness; nextName≡nextViewName; jointsIn≡endsIn
  bodies; three "walls crossing a line" implementations (geometry.jointsIn/endsIn, wall-stops); carriedRooms dead; input-keys hardcodes
  tool letters that actions also carry as defaultKeys.
- [x] 4. ADR 0004 drafted (docs/adr/0004-arquitetura.md).
- [ ] 5. Ordered plan (below).
- [ ] 6. Execute.
- [ ] 7. Gates in scripts/ (owner-writes, module-top let, import direction, duplication, file size) wired to npm run check.

## Where it stands
Worktree had the interface-review task done (branch pushed to origin/worktree-revisao-interface, HEAD aa2c376). That task's leftovers
(.whole-review/, docs/revisao-interface/audit/) stay. npm install done in worktree. Scratchpad: C:/Users/Jonathan/.claude/scratchpad/
cad2-refatoracao (empty; scripts live in .scratchpad/ inside the worktree, gitignored — add .scratchpad/ to .gitignore).

## Next — the ordered plan (step 5; each step = one commit, executed in order)

Base rule of every step: code lands in its FINAL folder with its FINAL owner (no move-twice); tsc 0 errors;
app check by gestures on the ONE tab (0 console errors); captures compared with .scratchpad/ref/manifest.json
(hash + DOM); measurements of what the step touched never worse; if the step touches project/, the round-trip
gate (node .scratchpad/validate-project.mjs .scratchpad/oldproject.json --roundtrip after esbuild bundle);
commit (en) + push; update this notebook + STATE.md.

1. **Gates**: scripts/check-inventario.mjs + import-direction + module-top-let + file-size + dup-detector
   refined into scripts/check-architecture.mjs, wired to `npm run check` (check stays typecheck+build;
   vitest removed from check per memoria fix-in-code-verify-in-app — check becomes typecheck+gates+build).
   Establishes the CURRENT violations as the to-fix list (baseline fail is expected; each later step must
   shrink it, never grow).
2. **Dead code removal** (no behavior change): delete src/io/pdf-canvas.ts (isPdfCanvas → duck-typing in
   hatch.ts), src/elements/opening/index.ts, src/elements/room/panel.ts, carriedRooms, referencesOf, the
   confirmed-dead exports (each grep-verified), the 83 i18n keys (each re-grepped incl. inside i18n.ts), 15
   CSS classes, mep_ X-ray comment-hook decision (keep behavior: material prefix check stays, comment fixed).
   Captures + i18n render check.
3. **model/ + project/**: create the folders; move core/* (vector+tolerance+rtree+guards+id+store+measure);
   unify hull ×4, pointToSegment ×3, regionOf ×4, band predicates ×5, finite/isColor/isPoint locals;
   tolerance locals (TOUCH/LENGTH_EPS/TOL) into model/tolerance.ts. tsc + captures + measurements (plan
   render, drag) not worse.
4. **project/ files+db**: move project-file/typed-ids/persist/boot/projects/app-files; NUL bytes out of
   project-db; doc.ts from app/document.ts (wall helpers to wall/ in step 6). Round-trip gate MUST stay
   byte-equal (kept fields).
5. **session/ machines**: UiState split into named machines (tool registry from ToolId → per-tool state
   modules; overlay machine; view machine on view-3d; lifecycle); setTool reset by transition; prefs owner
   single (persist.ts keys). Behavioral identity verified by the FULL 67-stop tour (hashes + DOM equal).
6. **wall/**: the big one — move elements/wall + kinds/wall + wall-ui + wall-tool + edit/split/arrange-walls/
   arc-edit + stops; fuse jointsIn/endsIn/wallStopsOf; engine derivation becomes incremental per level with
   rtree candidates (target: nudge 1.57 s → < 300 ms; drag ~1 s/move → < 150 ms) — measured before/after on
   the big project; plan fill O(n²) copy removed. Captures of every wall view equal.
7. **canvas/plan**: plan-view split (view/fill/tags/marks); static-layer caching of the un-changed drawing;
   labels/tags memo (room labels O(rooms²) → O(rooms)); getComputedStyle cached. plan-render target ≤ 60 ms.
8. **canvas/scene**: scene-3d split; sync() keyed without JSON.stringify per solid; wall blocks via
   BatchedMesh per material (r186 addInstance/setVisibleAt) or merged geometries; first-frame target < 5 s,
   draw calls < 800; renderer.info compared. Photo view untouched except verified visually at 5/20/40 s.
9. **chrome per-frame work**: actionList/ribbon memoized by key (chrome.ts per-frame allocation), frame.ts
   nextFields memo, pointermove pick via rtree (hover target ≤ 60 ms steady, first-move pike gone).
10. **Element folders** (opening/ room/ … each a step or two): move + kind merge + add/update command
    skeleton unified (one generic update command factory) + fields "all same else —" helper + guards from
    project/guards. Opening O(openings²) overlap via rtree; marks map. Captures per element panel.
11. **ui/**: i18n split by domain (en/pt pairs per domain; keys unchanged — the 83 dead already gone in 2);
    styles.css split by component importing in order (no rule change, raw-px token gate stays); dialog store
    scaffold ×6 unified; popover/menu/palette/searchSelect one system; snapshots share the stage; help
    dialog from actions.
12. **kinds/registry**: contract stays; registry edit-ops move to project/kinds-edit; line-kind helper for
    separator/grid/section/guide; closing the 60-file type SCC (kinds never import app).
13. **Final**: re-run everything (all gates green, full tour equal, all baseline measurements ≤ baseline,
    round-trip byte-equal, 0 console errors); history.md update; memory files for new learnings.

Defects found on the way are fixed at cause in their own commit (before/after captures), per the order.

## 2026-10-30, refactor stage 6 (owner's order: split big files, merge duplicates, one owner per state, typed IDs; stop when check-architecture is zero)
check-architecture at zero (direction 0, mutableLets 0, oversize 0, duplications 0) at the commit after 8d9b771. Every piece: tsc 0, gate not
worse, headless gestures + screenshots (scratchpad pw/drive.cjs, port 5180; the owner forbade the visible browser), commit, push.
One owner per state done where a split needed it: PointerState (input.ts lets + get/set bridge), EditorState (object editor lets).
NOT done (stop condition reached first): UiState flags as state machines (tool -> submode -> drag, view, lifecycle) and typed IDs per kind.
Known, not caused here: object-snapshot.ts sets PCFSoftShadowMap (three warns); three-bvh-csg maxLeafSize warnings.

2026-10-30 (cont., owner: "Sim, continuar" = do items 3 and 4 now). Typed ids, one kind per commit, each: tsc 0, gates 0, round-trip
byte-equal, headless check: WallId 5cf85fa, OpeningId 472cd5b, RoomId+FloorId 1f60e39, OpeningGroupId e114c59, ObjectId d2954ce, LevelId 71516f7,
WallTypeId b60c270, MaterialId bf831b9 (declared once now), DefinitionId ae9f360, the 15 other kinds 930f07a. ITEM 4 DONE. Pattern: brand in schema + newXId; any string from a list/pref decoded by membership (levelIn etc.); stand-ins named. Found and fixed type lies: selection/hover held
every kind (ElementId), Scene3D.walls held openings. Tools (.scratchpad): fix-test-ids.mjs BRAND ctor schema; tests/ids.ts wid/oid/rid/fid.
Item 3 DONE. Tool draft machine 1791f1b (elements/tool-draft.ts; 13 loose fields -> ui.draft). Drag 463d415 (HandleDrag is a
kind of Drag; ui.handleDrag gone; ptr.boxDrag kept in PointerState with panning: a camera gesture, one owner already). View db12ea7
(putView3D the one writer of ui.view3d + prefs; setView already the one writer of ui.view). Lifecycle b0a4141 (persist.ts save.target
the one owner of db + project id, app.db/app.projectId gone; showProject in files.ts the one "another project shown" transition).
Each checked headless (door and table handles mid-drag/Esc/release/undo; X-ray + box + box face drag across reloads; saved 3D view;
projects dialog new/open/delete; file opened as project). Gates 0, round trips byte-equal. Next: report (pt-BR).
Owner's order 2026-10-31 "ENTÃO CORRIJA TUDO!!!!" (fix all that the report left): done.
- d155ea4 level shown: setLevel the one way (levels dialog too); a level gone left in the store subscriber (not in chrome render);
  another project at the project's scale. Scale shown: footer read drawingOf (project) while plan drew drawingNow (saved view's);
  now drawingNow + chooseScale (footer and drawing dialog); setDrawing moved to elements/drawing/commands.ts.
- 0ae40d8 wall drag never moved a wall: this branch left main (4d41084) before main's fix 2d16f98; ported (kindLists non-walled,
  preview order). main has 93 commits this branch lacks (merge = a task of its own).
- 6ab72e6 + d48056f console: PCFShadowMap by name; vite.config.ts renames maxLeafSize/maxLeafTris/Source in libraries as bundled
  (206 warnings -> 0). Left, library-level: THREE.Clock, WebGLPathTracer (WebGPU only), X4000 shader notes (photoreal only).
- 947c2fd left button one state (LeftPress: press | box); middle/right keep theirs (can be held together).
- wall/guide tool-ui stay in elements: inventory rows 84/153 and ADR put a tool in its element's folder (my earlier note was wrong).
- Checked headless: levels add/delete/undo, saved view scale reset, footer scale, wall + column drag, marquee, Esc, box face,
  Distribute two windows + undo, file opened without IndexedDB (NODB=1 driver profile) + undo, photoreal picture unchanged.

## 2026-10-31, merge of main (owner: "Sim, trazer o main")
main had 93 commits since 4d41084 (the F-xxxx fixes of the reviewing skill, file v68-v70, point-tools F-0023, F-0014/F-0011 per-frame
derivation). `git merge --no-commit main`: 70 files both changed, 12 split here and changed there (src/app/app.ts, chrome, context-menu,
frame, input-buttons, input, kind-tools, main, ribbon-tabs, section-drawing, io/project-db, ui/i18n), grid/carry.ts deleted there.
Each of main's changes to a split file is carried to where its code lives now (git diff 4d41084..main -- <old path>).
Merge progress (uncommitted, merge in progress; tools in .scratchpad: hunks.py, take.py FILE LINE ours|theirs|both|@snippet, resolve-imports.py):
- Resolved: docs/agent/*; import-only hunks (resolve-imports.py); core/id (main newId + brands), core/measure; elements/* (reference WeakMap
  + onLoad owner, room nextNumber exported LevelId, object no dxf keeps floorLocked, opening nextOpening in fields.ts + style-fields
  without nextStyleFields, wall topRule(doc,wall,..) + nextWall template, makeWall withLiveType, measure chainArea null on crossing);
  project/* (boot repaired+local() no db/projectId, files showProject+repaired+replaces+key toasts, doc levels line, file-guards
  isLayer F-0096, derive jointsAndEnds F-0016 + no levelPieces, derived-queries/filters CATEGORIES + F-0007 comments);
  render/* (printing mode out F-0095, wall tag beside wall F-0140 in plan-annotations/plan-types, F-0099 trace check in scene-trace).
- Pending: session/* (main: keys only from actions byKey + keyName; point-tools F-0023 at src/app/point-tools.ts to move into session),
  ui/*, tests/*, styles.css; the 12 DU files (port main diff 4d41084..main of each old path), grid/carry.ts (main deleted:
  axis moves alone, drop wallsOnGrids use), i18n messages (main removed 121/lang, added keys), main.ts failed boot, app.ts
  onTraceUnavailable wiring; then tsc, gates, round trip, headless, commit, push.
- Done since: session/actions (flipHinge, CATEGORIES, vars), input-keys (main byKey + point tools), session/point-tools.ts (main F-0023
  adapted to ui.draft), app.ts/main.ts port (replaces, boot failed/repaired, traceUnavailable, action-list.ts F-0011 cache + keyName,
  LEVEL_HEIGHT, moveKinds g), input.ts port (floorZ, pointTape, pointTool click/rightClick, wallUnderRay lift, onCancel F-0024,
  showHelp from actions in ui/help-dialog), kind-tools/section-drawing small ports. src/app/point-tools.ts removed.
  Next: context-menu, chrome, frame, i18n, project-db, ui/* hunks, tests, styles.css, grid/carry; app.ts is 411 lines (cap 400).
- MERGE DONE 2595317 (pushed). Ported per split file: app.ts (action-list.ts, boot failed/repaired, replaces, afterChange in
  app-store, wireTraceNotes in scene-frame), input.ts (pointer-aim floorZ/pointTape, pointer-release point tools + rightClick,
  onCancel F-0024, help from actions), input-keys (byKey), chrome (footer pointTool + actionHint, tips, float bar), frame (F-0014
  shared snap/measure/axis/anchor/draft in plan-overlay; panel levelId, endChoosable, floor patch fn), i18n (port-i18n.cjs: 137 keys
  out, 69 changed, 19 added per language), styles (port-css.py 28 placed + 3 by hand), editor/store (definition-tabs/preview,
  objects-dialog). Notes: move.mjs drops the DESTINATION file's header comment (restored by hand twice: param-limits, file-guards).
  Checked headless: beam/roof by key, Esc/Enter/undo, help + context keys, wall tag beside wall, wall drag, next door/wall panels,
  3D snap with beam, object store menu + Esc. Not checked: every one of main's 93 fixes one by one in the app.
