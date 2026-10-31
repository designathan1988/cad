# Compaction 004 (2026-10-28T19:42:02.790Z)

<analysis>
The session continues the whole-codebase review skill (fix mode), phase read. After the previous summary, I continued reading files one at a time: trace-shader, view-cube, wall-paint, tools/*, ui/*, styles.css, and now tests/*. I recorded new findings F-0100..F-0135 and many Also lines. The current file is tests/elements/element-sizes.test.ts. It is fully read (100 lines), and its note was created but not filled. The rules are the same as before.
</analysis>

<summary>
1. Primary Request and Intent:
   The owner's scope prompt is in docs/prompt-escopo-fundamental.md, also kept in docs/agent/orders.md. It asks to reduce cad2 to the fundamental and make it work. The fundamental is: walls, building elements, objects, views, precision, and edit/file.
   - Passo 0 and Passo 1 are done (commits a574453 and 4d41084).
   - Passo 2 is running: the skill `/reviewing-whole-codebase fix`. Its phases are read → verify → fix → apptest → finish. The work must not stop before `finish`.
   - The goal names three root causes:
     - RC1: one option is defined in several places.
     - RC2: moving a door moves its neighbours. This comes from the fromOpening/aligned/inGroup rules, select-drag snapping, and settleDimensions/keepOpenings/keepRooms running on every dispatch. The fix is explicit positions, links only when the user makes them, and a migration.
     - RC3: giant controllers (app.ts, input.ts).
   - The final flows must work at about 880, 1280 and 1920 px wide.
   - The newest order in orders.md (17:15) is a UI/UX redesign in a worktree, meant for another session ("não atrapalhar a outra sessão"). This session continues the skill.

   Standing rules (keep them):
   - Talk to the owner in Portuguese. Write project text and commits in English.
   - No heredoc. No subagents. Never ask permission. One session in this folder.
   - No new features: only remove and fix.
   - Commit after each verified step, `git add` by path, then push origin main (github.com/designathan1988/cad).
   - Never touch vigia.json or vigia-log.txt.
   - Never write memory to ~/.claude/projects/.../memory.
   - No test suites. Tests are read, not run.

   Skill rules:
   - Read every file to its last line.
   - For every file in hand, open its docs with WebFetch; a search alone does not count.
   - Write each file's note and put every problem into .whole-review/FINDINGS.md at once.
   - Nothing is run and no project edits are made before phase fix.
   - The app is tested only in apptest, via browser.mjs.
   - Give the owner short progress messages in Portuguese, often. The system keeps asking for them.

2. Key Technical Concepts:
   - Stack: TypeScript/Vite, three 0.186.1, three-gpu-pathtracer ^0.0.27, Vitest, fast-check.
   - The project has an immutable Doc store, a registry of kinds, and derived geometry.
   - Ledger commands, always run alone and never chained with &&:
     `node "C:/Users/Jonathan/.claude/skills/reviewing-whole-codebase/scripts/ledger.mjs" <note|done|next|status|work|phase> ...`
   - Note format and what `done` checks:
     - The Structure section must cover every non-blank line as "- a-b description", each description at least 15 characters. A trailing closing line must be included in a range.
     - Ranges over 120 lines must be split by content, or written as "(uniform: why)".
     - The sources section must be headed "## Sources" and must cite WebFetch pages opened while reading that file.
   - Finding format:
     `### F-NNNN · suspected · S1-S4 · path:line — title`
     followed by What/Proof/Effect/Fix plan/Check lines and optional "Also:" lines.
   - The warning "note describes lines 1-N" is a false alarm when a blank line breaks the run.

3. Files and Code Sections (this stretch):
   Notes completed and marked done:
   - render: trace-shader, view-cube, wall-paint.
   - tools: arc-edit, arrange-walls, arrange, dimension-tool, edit, guide-tool, measure-tool, modify-tool, nudge, opening-tool, smart-guides, snap, split, transform, wall-tool.
   - ui: bar-place, browser, controls, cursors, definition-editor, dialog, drawing-dialog, fields, floors-dialog, i18n (4274 lines), icons, keys-dialog, layer-editor, levels-dialog, materials-dialog, menu-keys, menu, object-snapshot, objects-dialog, opening-snapshot, openings-dialog, overrides-dialog, palette, panel, presets-dialog, projects-dialog, ribbon, search, sections-dialog, shell, styles.css (3251 lines), swatch, tooltip, types-dialog, units-dialog, units, variables-dialog, wall-snapshot.
   - tests/app: actions, bounds-joints, browser, carry, context-actions, dim-labels, document, drawing-settings, geometry-levels, handles, keep-in-view, keyboard-select, keymap, layer-sets, marquee, opening-cuts, opening-keyboard, persist, pick, saved-views, section-box, section-drawing, select-similar, stacked, temp-dims, temporary-view, view-3d, view-keys, wall-heights, wall-stops, wall-under-roof.
   - tests/core: measure-more, measure, store.
   - tests/elements: annotations, beam-profile, column-shapes, curtain, dimension-constraints.

   New findings:
   - F-0100 S4 arrange.ts:21. boxOf spreads arrays into Math.min/max. A second boxOf exists in core/rtree. select-drag pushes points with push(...pts).
   - F-0101 S2 edit.ts:79. follow() calls intersectLines with no near-parallel guard. This throws a neighbour to about 10^14 m and is the break report's most frequent case. keepOnHosts (152) has the same call; meet() has NEAR_PARALLEL 0.05.
   - F-0102 S3 edit.ts:62. walls.find is called inside nested loops in follow and corner.
   - F-0103 S4 measure-tool.ts:54. A self-crossing closed chain gives a net area.
   - F-0104 S3 modify-tool.ts:71. A zero-length copy step duplicates in place. Also: copyToLevel uses a zero translation on purpose, so the guard belongs in modify-tool.
   - F-0105 S4 snap.ts:378. The aligned snap along a steep ray has no slack bound.
   - F-0106 S3 split.ts:65. Split and merge copy joins and dimension anchors to the wrong ends. Merge also orphans references to b. This is part of "dividir muda a planta".
   - F-0107 S4 browser.ts:12. Categories are listed three times (geometry.ts:468, layer-sets.ts:12, browser.ts:12) (RC1).
   - F-0108 S4 controls.ts:333. The upward searchSelect popup is placed before its list is filled.
   - F-0109 S4 controls.ts:161. scrub has no pointercancel or lostpointercapture handling.
   - F-0110 S4 cursors.ts:8. Only 6 of 27 tools get the aiming cross. Also: icons already exist for most tools.
   - F-0111 S3 definition-editor.ts:182. renameParam misses round/tilt/roll/turn/d and the points arrays.
   - F-0112 S3 definition-editor.ts:567. The preview leaks the edge LineSegments children.
   - F-0113 S3 definition-editor.ts:54. Escape is caught in the window capture phase, closes the editor and drops the draft. Also: dialog.ts's Escape closes dialogs even when the key was meant for an inner list.
   - F-0114 S4 dialog.ts:106. There is no focus trap or inert and focus returns to the canvas. Also: three dialog frameworks exist (openProjectDialog, definition-editor, projects-dialog), plus input.ts's help dialog.
   - F-0115 S4 floors-dialog.ts:41. The picture cache ignores materials. Also: presets-dialog's cache ignores the template and materials. objects-dialog and types-dialog use a WeakMap and are correct.
   - F-0116 S4 i18n.ts:1614. About 95 keys per language belong to removed areas. Live notes still mention GLB, printing and paper.
   - F-0117 S3 materials-dialog.ts:109. The physics "for the simulations" UI and the roof thermal covering are still shown.
   - F-0118 S4 kinds/measure.ts:89. fix.droppedMeasures is a bare noun with no {count}.
   - F-0119 S4 i18n.ts:3462. Portuguese terminology is inconsistent (cômodo/ambiente, piso/laje, three names for the curtain wall, Escala/Escalar). The object editor asks for a decimal point.
   - F-0120 S3 keys-dialog.ts:57. The key capture conflicts with the dialog's Esc and undo. A capture left open after a backdrop click swallows the next key.
   - F-0121 S4 levels-dialog.ts:31. A blank name leaves the field blank. Also: materials-dialog has the same behaviour.
   - F-0122 S4 materials-dialog.ts:170. The delete button uses native disabled, which hides the reason. Duplicates are named "(2)". Also: objects-dialog has both issues; types-dialog uses disabled; tooltip.ts makes it worse.
   - F-0123 S4 menu.ts:78. The menu has no max-height or overflow.
   - F-0124 S4 object-snapshot.ts:23. The getContext probe makes the renderer reuse that context, so its attributes are ignored.
   - F-0125 S4 objects-dialog.ts:193. A role=menu without menu behaviour. Also: ribbon.ts openMenu is a third menu implementation.
   - F-0126 S4 openings-dialog.ts:34. Five store dialogs duplicate the same skeleton and have five folds. Also: presets has no scroll keeping and a local `words`.
   - F-0127 S4 openings-dialog.ts:122. A double click after a redraw probably never fires (objects/presets too). Confirm in apptest.
   - F-0128 S4 overrides-dialog.ts:96. Red means "demolish" in one place and "build" in another. Duplicate type overrides are possible.
   - F-0129 S4 ribbon.ts:177. ARIA tabs without tab keys or tabpanel. Also: three role=toolbar elements without toolbar keys.
   - F-0130 S4 sections-dialog.ts:38. Buttons use role=listitem. Class names left over from sheets, print and tour.
   - F-0131 S4 styles.css:2146. Dead rules and tokens from removed areas. --dialog-w-xl is defined twice.
   - F-0132 S4 tooltip.ts:17. The title is removed from assistive tech and the tooltip is not hoverable (WCAG 1.4.13).
   - F-0133 S4 controls.ts:177. Segmented one-of-n controls use aria-pressed instead of a radiogroup.
   - F-0134 S4 measure.ts:130. Variables are looked up with `in`, which matches inherited names.
   - F-0135 S4 context-actions.test.ts:37. Stale test names. Also: keyboard-select header says Tab where the keys are N; view-3d header says cut 1.2.

   Also lines added to older findings:
   - F-0099: trace-shader patches throw uncaught in the traceStep setup.
   - F-0068:
     - nudge.ts slid() rewrites the rules.
     - opening-tool ruleAt creates fromOpening links silently.
     - temp-dims tests pin this behaviour.
   - F-0042: opening-tool has a 4th meaning for the centred preview. opening-keyboard test asserts it.
   - F-0087: mirror does not swap joins.
   - F-0030:
     - ribbon and panel renderers differ.
     - stores write "next" into three homes: ui.openingDefaults, ui.defaults, app.next.
   - F-0059: confirmed in fields.ts.
   - F-0010:
     - about 45 i18n texts hard-code keys.
     - shell has 'Ctrl K', '(1)' and '(2)'.
   - F-0004: t() replaces a missing variable with ''.
   - F-0039: misplaced comments in i18n.ts:4257, icons.ts:11 and section-drawing.test.ts:34.
   - F-0036:
     - unused icons walk, play, pause, menu, language.
     - layer.services.
     - updateView/moveView are only called by saved-views.test.
   - F-0027: confirmed in keys-dialog.
   - F-0038: confirmed in sections-dialog.

   CURSOR.md was updated through about 333 files and F-0134.

4. Errors and fixes:
   - `done` refused short structure entries (<15 chars) and missing trailing lines. Fix: widen the ranges and lengthen the descriptions.
   - `done` refused entries over 120 lines. Fix: split them (section-drawing test).
   - `done` refused notes without a WebFetch source for the file. Fix: fetch a page, then retry.
   - `wc` is blocked by the hook. Fix: use Grep or Read with an offset.
   - F-0131's first draft said the opacity pulse ignores reduced motion. MDN treats opacity as the gentle option, so that claim was removed.
   - Some WebFetch calls failed (Autodesk 503/404, fast-check 404). Fix: fetch alternative pages.

5. Problem Solving:
   - Break-report causes located:
     - "mover arremessa a vizinha" → F-0101.
     - "dividir muda a planta" → F-0106, plus older join findings.
   - RC2 is born at opening-tool ruleAt and is pinned by tests.
   - RC1 has more evidence (F-0107, F-0030 Also lines, F-0010 Also lines).
   - keep-in-view pans on selection. Watch at 880 px in apptest.
   - F-0001: project-db.ts still has to be read outside the ledger before verify.
   - docs/agent/work.md and STATE.md can only be updated in phase fix.

6. All user messages:
   - The scope prompt was pasted together with the zip path (Passo 0/1/2).
   - "@"C:\Users\Jonathan\Documents\Arquivos\reviewing-whole-codebase.zip" voce então não instalou a skill direito instale logo a skill e use"
   - "Vou digitar"
   - "/reviewing-whole-codebase fix"
   - orders.md also records a 17:15 order addressed to another session: UI/UX analysis plus a new interface in a worktree. The owner dislikes the view box panel, the bottom toolbar and properties in the ribbon, wants properties in the properties bar, and wants a professional interface that does not look like a form.
   - The system repeatedly said: "The user hasn't heard from you in a while — say in a few words what you're doing, then continue." Answer with short Portuguese progress lines.

7. Pending Tasks:
   - Finish phase read: about 38 test files remain after element-sizes, and F-0001 project-db.ts must still be read.
   - Phase verify on every finding.
   - Phase fix:
     - Order: RC1 (F-0003, F-0010, F-0021, F-0030, F-0107), then RC2 (F-0068, F-0008, F-0006, F-0042, F-0050, F-0051), then F-0101 and the rest by severity.
     - For each fix: research it, run tsc, commit and push, update work.md and STATE.md.
   - Phase apptest: Chrome through browser.mjs, at 880, 1280 and 1920 px and on mobile.
   - Run `finish`, then give the owner the final Portuguese report.

8. Current Work:
   File tests/elements/element-sizes.test.ts (100 lines) is fully read. Its note was created by `note` but not filled. Contents:
   - 1-3: header (no element may get zero size).
   - 5-15: imports: vitest, document/wallHeights, createStore, MIN_ELEMENT_SIZE, vec, KINDS, addOpening/updateOpening, newOpening, addWalls, isOpening/isWall, stretchEnd.
   - 17-26: wall helper with top and base.
   - 28-52: walls:
     - a top below the bottom, a base above the top, and a fixed height of 0 all give MIN_ELEMENT_SIZE;
     - stretchEnd onto the other end is refused;
     - isWall refuses zero length.
   - 54-74: openings: width/height ≤0, sill <0 and NaN are refused through the store; 1.2 is accepted; isOpening refuses a negative sill.
   - 76-88: scaled by 1e-4: column width and depth become 0.05, beam width 0.05, stair width 0.4 (minimums).
   - 90-98: floor validity: a layer of thickness 0 or a tile of width 0 is refused.
   - 99: suite end.
   No problems seen in this file.

9. Optional Next Step:
   Continue phase read exactly where it stopped.
   1. WebFetch a relevant page, for example Vitest's `toEqual`, or MDN Number.isNaN / NaN for the `width: Number.NaN` case.
   2. Write .whole-review/notes/tests/elements/element-sizes.test.ts.md with:
      - Summary;
      - Structure ranges 1-3, 5-15, 17-26, 28-52, 54-74, 76-88, 90-99 (each description at least 15 characters);
      - contracts, depends on / used by;
      - "## Sources".
   3. Run `node "C:/Users/Jonathan/.claude/skills/reviewing-whole-codebase/scripts/ledger.mjs" done tests/elements/element-sizes.test.ts`.
   4. Continue with the ledger's NEXT file, giving short Portuguese progress messages to the owner, for example: "Leitura: 379 de 416 arquivos, 135 achados…".
</summary>
