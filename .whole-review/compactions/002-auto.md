# Compaction 002 (2026-10-28T17:53:31.600Z)

<analysis>
Continuation of the cad2 scope task, step 2: the reviewing-whole-codebase skill in fix mode, still in phase read. Since the last summary I have read files from keymap.ts through library-living.ts. I am now partway through library-more.ts: lines 1-400 are read, the note is created but empty, and lines 401-463 are still to read. The rules from the owner and the skill still apply. Findings now run from F-0027 to F-0060.
</analysis>

<summary>
1. Primary Request and Intent:
   The owner pasted a scope prompt, saved word for word in docs/prompt-escopo-fundamental.md and docs/agent/orders.md. It asks to reduce cad2 to the fundamental and make it work. The fundamental is walls, building elements, objects, views, precision, edit/file and the settings they use.
   - Passo 0 is done. Passo 1 is done: commit a574453, then 4d41084 for the notebook.
   - Passo 2: install the skill and run `/reviewing-whole-codebase fix`, following every phase: read, verify, fix, apptest, finish.
     - The skill's goal is the "Objetivo para a skill": the fundamental works without breaking.
     - It names three root causes:
       - RC1: one option defined in several places (context-menu.ts table vs actions.ts; openingFields/nextOpeningFields; wallFields/nextWallFields; ribbon vs side panel order). The fix is one list per element, with the "next" piece as the template.
       - RC2: moving a door moves its neighbours (fromOpening/aligned/inGroup rules; select-drag snapping; settleDimensions/keepOpenings/keepRooms on every dispatch). The fix is explicit positions, links only when the user makes them and visible, and a migration.
       - RC3: giant controllers app.ts/input.ts.
     - Final flows to check:
       - draw walls, then a door and a window;
       - move a door without moving its neighbours or the rooms;
       - move a wall and its openings go with it;
       - the same option looks the same in the ribbon, the side panel and the floating panel;
       - a changed key shows the same everywhere;
       - every element is created, edited, undone, redone, saved and reopened;
       - all of it at about 880, 1280 and 1920 px wide.
   - Owner's messages in this session: "voce então não instalou a skill direito instale logo a skill e use"; "Vou digitar"; and the invocation "/reviewing-whole-codebase fix".
   - Standing rules (preserve):
     - Talk to the owner in Portuguese; project text and commits in English.
     - No heredoc in the shell. No subagents. Never ask permission; choose and proceed.
     - One session in this folder.
     - No new features, only remove and fix.
     - Commit per verified step, `git add` by path, check `git diff --cached --name-only`, push origin main (github.com/designathan1988/cad).
     - Never touch vigia.json or vigia-log.txt.
     - Never write memory to ~/.claude/projects/.../memory.
     - No test suites.
   - Skill rules:
     - Read every file to its last line, one file at a time.
     - WebFetch the docs for the file in hand; a search alone does not count, the page must be opened.
     - Write a note per file and every problem into FINDINGS.md at once.
     - Nothing is run, and no project edits before phase fix.
     - The app is tested only in phase apptest, in Chrome via browser.mjs.
     - Do not stop before `finish`.

2. Key Technical Concepts:
   - cad2 stack: TypeScript, Vite 8.3.5, three 0.186.1, three-bvh-csg 0.0.18, pdfjs-dist 4.10.38, polyclip-ts, typescript 5.8.3 (strict, exactOptionalPropertyTypes).
   - Immutable Doc with a store. app.ts wraps `store.dispatch` with settleDimensions, keepOpenings and keepRooms.
   - Element kinds go through a registry contract (elements/contract.ts, elements/kinds/*.ts).
   - The ledger is run as `node "C:/Users/Jonathan/.claude/skills/reviewing-whole-codebase/scripts/ledger.mjs" <cmd>` (note, done, next, status, work, phase…). State lives in .whole-review/ (FINDINGS.md, CURSOR.md, notes/).
   - Note format:
     - Summary, then "## Structure" with entries "- a-b description of at least 15 characters" covering every non-blank line.
     - Ranges over 120 lines must be split or marked "(uniform: why)".
     - Then Contracts, Depends on / used by, Problems found, To check, and "## Sources" (exact heading) with the URLs of pages fetched while that file was in hand.
   - Finding format: `### F-NNNN · suspected · S1-S4 · path:line — title`, with What, Proof, Effect, Fix plan and Check lines.

3. Files and Code Sections (notes written this stretch, all done in the ledger):
   - src/app: keymap.ts (F-0027), kind-tools.ts (F-0028), layer-sets.ts, library-link.ts, main.ts (F-0029), model-import.ts, modify-ui.ts, next-element.ts (F-0030), object-handles.ts (F-0031), opening-ui.ts, persist.ts (F-0032), projects.ts, reference-ui.ts (F-0033, F-0034), ribbon-tabs.ts, room-tag.ts, room-ui.ts (F-0035), saved-views.ts (F-0036), section-box.ts, section-drawing.ts (F-0037), section-view.ts (F-0038), select-drag.ts, select-similar.ts, selection-ui.ts (F-0039), stacked.ts, temp-dims.ts, view-3d.ts (F-0040), view-keys.ts, view-ui.ts (F-0041), views-ui.ts, wall-stops.ts, wall-ui.ts (F-0042).
   - src/assets.d.ts.
   - src/core: collisions.ts, guards.ts, id.ts (F-0043), measure.ts (F-0044), rtree.ts, store.ts, tolerance.ts (F-0045), vector.ts.
   - src/elements:
     - beam/*, column/* (F-0046), contract.ts (F-0047), curtain/* (F-0048, F-0049);
     - dimension/anchor, auto, commands, constraints (F-0050), fields, schema;
     - drawing/schema.ts;
     - grid/carry (F-0051), commands, fields, schema;
     - guide/*;
     - wall/geometry/convex.ts (read out of order);
     - kinds: beam, column, curtain, dimension, floor, grid, guide, measure, note, object (F-0052), opening, paint, railing (F-0053), reference (F-0054), roof, room, section (F-0055), separator, stair, wall, zone (F-0056);
     - layers/stack.ts, level/commands.ts (F-0057), material/commands (F-0058), pattern, physics, schema;
     - measure/commands, place, schema; note/commands, fields (F-0059), schema;
     - object/commands, evaluate (F-0060), fields, formula, library-bath, library-bedroom, library-before65, library-before66, library-decor, library-equipment, library-families, library-kit, library-kitchen, library-lights, library-living.
   - New findings, F-0027 to F-0060:
     - F-0027 S3: assignKey ignores keys the tools use themselves.
     - F-0028 S4: elevations around the model are recognised by their translated name.
     - F-0029 S3: main.ts `void boot().then` gives a blank page when start fails.
     - F-0030 S2 (RC1): walls and openings have separate next lists (nextWallFields/nextOpeningFields; their kinds' fields are []).
     - F-0031 S4: `pointer: coarse` checks the primary pointer only.
     - F-0032 S3: persist.ts:131 setItem is not inside try.
     - F-0033 S4: a PDF recognised by MIME type gets the picture scale.
     - F-0034 S3: the pdf.js document is never destroyed.
     - F-0035 S3: the room tool numbers count + 1 (kinds/room.ts nextNumber is correct).
     - F-0036 S4: leftovers of tour, sheets and print (updateView, moveView, cmd.updateViewport/moveViewport, PAPERS, 'schedule.col.wall').
     - F-0037 S3: Math.min/max spread over all cut points.
     - F-0038 S3: the section cache ignores hidden categories.
     - F-0039 S4: misplaced doc comments (selection-ui.ts:169, evaluate.ts:427).
     - F-0040 S3: wallUnderRay ignores the explode lift.
     - F-0041 S4: comments still mention terrain and lot.
     - F-0042 S3: a typed opening distance means different things in the footer and in the temporary dimension.
     - F-0043 S3: randomUUID needs a secure context; ids keep only 32 bits.
     - F-0044 S4: × and ÷ inside names, and ÷/− not parsed (measure.ts:129, also formula.ts:217).
     - F-0045 S4: stacked.ts copies the 0.6° tolerance.
     - F-0046 S4: column top-level choices come from the first selected column only.
     - F-0047 S3: DXF/GLB export members remain in the contract and in all 20 kinds.
     - F-0048 S4: curtain fields apply the first curtain's mode to all.
     - F-0049 S2: the curtain grid has no limit.
     - F-0050 S3: a lock rewrites a centred, aligned or grouped opening's rule.
     - F-0051 S3: a grid axis carries every wall and column on its infinite line.
     - F-0052 S3: creaseEdges takes O(edges × vertices).
     - F-0053 S3: a hosted railing moved alone jumps to its stored points.
     - F-0054 S4: the reference picture cache grows without limit.
     - F-0055 S4: section bubble labels longer than 3 characters keep only their first letter.
     - F-0056 S4: orphan zones stay in the file.
     - F-0057 S2: deleting a level leaves its non-wall elements orphaned.
     - F-0058 S3: materialUses ignores roof coverings and presets.
     - F-0059 S3: note text is a one-line input.
     - F-0060 S3: object pieces have no total limit.
   - Findings I added to:
     - F-0013's proof: level/commands.ts updateLevel changes only the levels list.
     - F-0035's fix plan: point the room tool at kinds/room.ts nextNumber.
     - F-0039 and F-0044: added "Also:" lines.
     - F-0008 got more evidence in the notes: wall-stops, ruleAt, temp-dims:76/85 and select-drag:275-279 store face-measured distances, and keep-openings keeps them.
   - CURSOR.md updated: 143/416 files, 60 findings, the list of new findings, method notes.

4. Errors and fixes:
   - `done` refusals:
     - A blank-line gap left a line uncovered; fixed by widening the range.
     - Entries under 15 characters; fixed by longer text.
     - Ranges over 120 lines without "(uniform:…)"; fixed by splitting or marking.
     - A Sources section citing only a Google search or an opened page that failed; fixed by WebFetching a real page (e.g. the Autodesk "Lock Columns to a Grid" help).
   - Backslash typos in note titles ("src/elements\..."); fixed with Edit.
   - Reading a file outside the chunk order (convex.ts) made the ledger ask for it next. Lesson: use Grep for checks on other files.
   - A WebFetch summary about the installed version was wrong (BufferAttribute getX). Confirmed in node_modules source instead.
   - The BufferGeometryUtils docs page returned 404. Read node_modules/three/examples/jsm/utils/BufferGeometryUtils.js:133-212 instead.

5. Problem Solving:
   Phase read is about 160/416 files, 60 findings. RC1 and RC2 mechanisms are confirmed in the code. Not done yet:
   - F-0001: read project-db.ts outside the ledger.
   - Phases verify, fix, apptest and finish.
   - docs/agent/work.md and STATE.md cannot be updated until phase fix.

6. All user messages:
   - The scope prompt, pasted with the skill zip path.
   - "@"C:\Users\Jonathan\Documents\Arquivos\reviewing-whole-codebase.zip" voce então não instalou a skill direito instale logo a skill e use"
   - "Vou digitar"
   - "/reviewing-whole-codebase fix"

7. Pending Tasks:
   - Finish phase read for the remaining ~256 files, including project-db.ts (F-0001).
   - Phase verify on every finding.
   - Phase fix, ordered by severity and shared cause:
     - RC1: F-0003, F-0010, F-0021, F-0030.
     - RC2: F-0008, F-0006, F-0042, F-0050, F-0051.
     - Then the rest.
     - Each fix: research first, run tsc, commit and push, update docs/agent/work.md and STATE.md.
   - Phase apptest rounds in Chrome (desktop and mobile, 880/1280/1920).
   - Run `finish`, then write the final report to the owner in Portuguese.

8. Current Work:
   Reading src/elements/object/library-more.ts (464 lines). Lines 1-400 are read; the note was created with `note` but not yet filled. Those lines hold:
   - 1-4 header (phase 8 categories);
   - 6 imports;
   - 8-28 local copies of len, mat, BUILD, LIGHT and boxHandles (duplicates of library-kit.ts);
   - 30-68 SOFA (rule: depth under 0.75);
   - 70-112 BED;
   - 114-197 KITCHEN (rule: worktop under 0.85);
   - 199-224 TOILET (accessible type at 46 cm);
   - 226-255 WASHBASIN;
   - 257-290 SHOWER (rule: under 0.8);
   - 292-324 FRIDGE;
   - 326-362 COOKER;
   - 364-392 PENDANT, with its light (rule: under 1.6 m);
   - 394-400 the start of TREE.
   The hook asked: "Describe lines 1-400 in .whole-review/notes/src/elements/object/library-more.ts.md and put every problem seen in FINDINGS.md. Then Read offset 401, limit 63."

9. Optional Next Step:
   1. WebFetch a page this file relies on (for example the MDN as-const or array docs, or an accessibility source for the toilet's 46 cm seat).
   2. Write the library-more.ts note for lines 1-400, read lines 401-463, finish the note and run `done src/elements/object/library-more.ts`.
   3. Continue with the ledger's NEXT, one file at a time, following the skill: "Repeat until `next` says every file is read".
</summary>
