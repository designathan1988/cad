# Findings

Heading (parsed by ledger.mjs): `### F-NNNN · status · S1-S4 · path:line — short title`, numbered F-0001, F-0002, ...
Statuses: suspected → confirmed | rejected (phase verify); confirmed → fixed | blocked (phase fix). A defect seen in the app test may start as `app:<screen>` and is traced to its code (path:line) before it is confirmed.
Lines: What:, Proof:, Effect:, Fix plan:, Check: (other file to look at), Evidence: (screenshot of an app-test defect), Source: (URLs opened with WebFetch for the decision, in phase verify, after `work F-NNNN`), Rejected because:, Blocker:, Tried:, Fix: (path:line of each change), Fix source: (URLs opened in phase fix for this fix, before editing), Verified by: (re-read path:a-b of the changed lines after the last edit).

### F-0001 · fixed · S3 · src/io/project-db.ts:1 — NUL bytes inside a source file
What: the Read tool reports NUL bytes in the first 8 KB of project-db.ts, so the review's inventory skipped it as binary and editors and tools treat it as binary (Edit/Write refuse it).
Proof: re-read whole (1-167): the only places a raw separator can sit are the key templates at 140 (`${list}<sep>${i}`) and 144 (`${list}<sep>${item}`), the first-save cleanup's set of kept keys; the Read of the whole file warns of NUL bytes; git itself treats the file as binary (`git show --stat c3d1e40`: "src/io/project-db.ts | Bin 7463 -> 7478 bytes", no line diff), so every change to the module escapes diff review. The separator's value only has to differ between the two lines' keys, which are built and compared in the same function (140 builds, 144 tests), so a printable-safe escape keeps the behaviour. Ripgrep skips it too (a search for \x00 returns nothing because the file is binary to it).
Effect: the file that keeps every project in IndexedDB escapes review and tooling; a raw NUL in a string literal is invisible and fragile (an escape \0 is what was meant, if anything).
Fix plan: write the separator at 140 and 144 as the escape \u0000 (same runtime value; the keys are only compared within saveProject, never stored), so the file becomes plain UTF-8 text.
Check: src/app/projects.ts, src/app/persist.ts (callers)
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar (\0, \u0000 and \x00 all denote U+0000 in a string or template literal)

### F-0002 · fixed · S4 · tests/fixtures/third-party.ifc:1 — IFC fixtures left after IFC import was taken out
What: tests/fixtures/third-party.ifc and third-party-structure.ifc were read only by tests/io/import-ifc.test.ts, removed with io/import-ifc.ts in commit a574453; nothing references them now.
Proof: re-read third-party.ifc:1-5 (an IFC4 STEP file); a search for "third-party" or "fixtures/" over src, tests and scripts (ts, mjs, js, cjs) finds nothing; the files are not tests themselves (Vitest's default include is **/*.{test,spec}.?(c|m)[jt]s?(x)), so no runner and no module reads them.
Source: https://vitest.dev/config/include (default include pattern)
Effect: dead files in the tree (they stay in tag escopo-completo-2026-10-28 with their test).
Fix plan: remove both fixtures.
Check: tests/ (no other reader)
Also: docs/pendencias.md:532 still lists "Importar IFC (Arquivo > Abrir, .ifc)" as done and tested with this fixture; the import is out of the app since a574453. That line should say it left with the scope cut.

### F-0003 · fixed · S2 · src/app/context-menu.ts:22 — the context menu and floating bar show their own keys, not the action list's
Fix: src/app/context-menu.ts:1-4, 23-55, 99-105; src/app/actions.ts:171-172, 256 (lines after F-0010's tipOf); src/app/chrome.ts:475-476 (after F-0010's lines); tests/app/actions.test.ts:16, 51-52
Fix source: https://en.wikipedia.org/wiki/Single_source_of_truth
Verified by: re-read src/app/context-menu.ts:1-58, re-read src/app/context-menu.ts:96-107, re-read src/app/actions.ts:170-191, re-read src/app/actions.ts:250-260, re-read src/app/chrome.ts:473-487, re-read tests/app/actions.test.ts:14-54; npx tsc --noEmit passes. LOOK now holds only each entry's icon and its action id. The key is the action list's current key (keyOf through the keymap), so the right-click menu, the floating bar (its cache key now includes the keys) and the ribbon's contextual tab show a remapped key as the palette does. The two keys that had no action (H to flip a door's hinge, Ctrl+K for the commands) are now actions edit.flipHinge and help.commands; their behaviour already existed (input-keys.ts) and is unchanged.
What: actions.ts gives each action its key through keyOf(id, own, app.keymap) (actions.ts:54-66); context-menu.ts has its own LOOK table of icons and keys (move Shift+M, delete Del, frameSelection F...) that never reads the keymap.
Proof: re-read context-menu.ts:1-104: LOOK (22-53) holds literal keys; contextEntries (97-102) spreads LOOK[id] into each entry, so e.keys is always the literal; nothing calls keyOf or reads app.keymap. actions.ts:54-55 make() uses keyOf(id, extra.keys, app.keymap); keymap.ts:34-37 keyOf returns the user's key when the map has the id. chrome.ts:433-448 builds the floating bar's tooltips from contextEntries (`${e.label} (${e.keys})`), and chrome.ts:541 even adds the context entries to the ribbon's action map with these literal keys. So a key remapped in the Keys dialog appears in the palette (keyOf) but not in the floating bar, the right-click menu or the ribbon's contextual buttons.
Source: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself ("every piece of knowledge must have a single, unambiguous, authoritative representation")
Effect: a key the user remaps (keys dialog) shows the new key in the palette and the ribbon tips but the old one in the right-click menu and the floating bar (the goal: "uma tecla mudada aparece igual em todos os lugares"); the same option is defined in two places (goal's root cause 1).
Fix plan: one source per option: the context entries take label, key and enabled state from the action list by id (or both from one table), the icon kept per id.
Check: src/app/context-menu.ts, src/app/chrome.ts (float bar), src/app/keymap.ts

### F-0004 · fixed · S4 · src/app/actions.ts:227 — snap parts actions searched by an unfilled "{n}"
What: the snap.parts.<n> actions are made by make() without vars, so tBoth('pal.snapParts') builds the keywords from the template with its placeholder; only the label is then replaced with the filled text (line 228).
Proof: re-read actions.ts:54-66 and 226-228: make() is called with no vars, so line 60's tBoth(key, undefined → {}) runs i18n.ts:4219's replacer, which returns vars[k] ?? '' for the missing n: the keywords hold the message with an empty gap ("divide segments into  parts"); line 228 replaces only the label with t('pal.snapParts', { n }). The number is still searchable through the extra keywords, so the effect is limited to the search text (and the general rule that a missing variable renders as nothing, never an error).
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace (a replacer function's return value replaces each match; here '' for a missing variable)
Effect: the palette's search text holds "{n}" (or whatever t renders for a missing var) instead of the number in both languages; the number is still found through the extra keywords, so the effect is cosmetic in search.
Fix plan: pass vars: { n } to make() and drop the label override.
Check: src/ui/i18n.ts (t with a missing var)
Also: i18n.ts t() and tBoth() (4218-4227) replace a missing variable with '' silently, so the keywords read "Snap: divide segments into  parts" (and any other message missing a variable shows a gap, never an error).

### F-0005 · rejected · S3 · src/app/app-files.ts:32 — the download's object URL is revoked in the same task as the click
What: download() clicks the anchor and immediately calls URL.revokeObjectURL(a.href).
Proof: app-files.ts:29-32 createObjectURL, click(), revokeObjectURL with nothing in between; MDN's anchor page revokes "once the download has started".
Rejected because: re-read app-files.ts:26-33. a.click() runs the anchor's activation behaviour synchronously, and "download the hyperlink" parses the URL in that call (HTML step 3); the URL parser resolves a blob: URL's blob URL entry at parse time (URL Standard, parser step 4), and the File API says requests started before revocation still succeed. So by the specifications the revoke after click() cannot cut the download; the "MDN anchor page" quote in the original proof is not on the current page (re-checked). No defect to fix without evidence from the app test.
Source: https://html.spec.whatwg.org/multipage/links.html#downloading-hyperlinks ; https://url.spec.whatwg.org/#concept-url-parser ; https://w3c.github.io/FileAPI/#dfn-revokeObjectURL
Effect: in browsers that start the blob fetch asynchronously the save can fail or produce an empty file (the project's save, the only way to get the project out of the browser).
Fix plan: revoke after the download has had a chance to start (a later task), per the documentation found in verify.
Check: none

### F-0006 · fixed · S2 · src/app/app-files.ts:86 — opening a project (or a new one) runs keepOpenings/keepRooms between two different projects
What: openFile and newProject replace the document through store.dispatch, whose wrapper in app.ts runs keepRooms(before, keepOpenings(before, next)) whenever next.walls !== before.walls; before is the old project.
Proof: re-read app-files.ts:44-91: without a database, newProject (56) and openFile (86) dispatch `apply: () => doc` through app.store, which is the wrapper at app.ts:256-273: settleDimensions(before = the open project, changed = the opened one) first (263-267: if a locked dimension of the opened file "moved" relative to geometry of the other project it is refused and the open itself is cancelled, with the toast "locked"), then, since the walls array differs, keepRooms(before, keepOpenings(before, next)) (269). keep-openings.ts:18-48 matches openings by id between the two projects; ids collide whenever the user opens another save of the same project (same ids by design, core/id.ts), and an opening whose wall id, rule kind and distance equal the open project's gets its distance rewritten from the OLD project's wall stops (36-47). carry.ts:78-99 reseeds rooms that were alone in the old geometry under the same id. Discriminating case: project open with wall_1 moved; File > Open the earlier save of it: its doors on wall_1 are shifted by the old geometry, silently, and an opened file with a locked dimension can be refused outright.
Source: https://en.wikipedia.org/wiki/Command_pattern (a command carries its own action; replacing the document is not an edit to the walls, so edit follow-ups do not belong in it)
Effect: the opened project's openings and rooms may be adjusted by matching ids of the previous project (projects made from the same template share ids like wall_1), changing an opened file silently.
Fix plan: to decide after reading keep-openings.ts and carry.ts; a document replacement is not a wall edit.
Check: src/app/app.ts, src/app/keep-openings.ts, src/app/carry.ts
Fix: src/core/store.ts:8-9 (Command.replaces: it puts another document in place, not an edit), src/app/app.ts:262-264 (the wrapper returns such a command's document as it is: no settleDimensions, keepOpenings or keepRooms between two projects), src/app/app-files.ts:56, 86 (new project and open file marked replaces). Switching projects in the browser's list goes through store.reset, which the wrapper never sees.
Fix source: https://en.wikipedia.org/wiki/Command_pattern (a command object carries all the information needed to perform its action: here whether it replaces the document)
Verified by: re-read src/core/store.ts:1-12, re-read src/app/app.ts:250-276, re-read src/app/app-files.ts:53-88; npx tsc --noEmit passes

### F-0007 · fixed · S4 · src/app/app.ts:1691 — three doc comments that describe nothing below them
Verified: re-read app.ts:1691-1693 ("Shows or hides a category…" then "Graphic overrides shown or not" over toggleOverrides), 1734-1738 ("Every wall of a type…" then the select-similar comment), 1816-1818 ("The selection's quick actions…" then "Opens the command palette…" over openCommands): each first comment is detached and describes nothing below it. Source: https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html (the comment right before a declaration is the one that annotates it; an earlier one is standalone)
What: "/** Shows or hides a category of elements; what is hidden leaves the selection. */" sits over toggleOverrides (1691-1692), "/** Every wall of a type on the current level, with the select tool. */" over selectSimilar's own comment (1734-1735), "/** The selection's quick actions, above the selection and never over it. */" over openCommands (1816-1817).
Proof: app.ts:1691-1693, 1734-1739, 1816-1818: each is a doc comment immediately followed by another doc comment of a different member.
Effect: an editor's hover shows the wrong text; a reader is misled about what the member does.
Fix plan: move each comment to its member (toggleCategory 1725, selectWallsOfType 1743, placeFloatBar 1821) or drop it.
Check: none
Proof (verify, again): re-read app.ts:1691-1693. Two doc comments stand one above the other over toggleOverrides, and the first describes a different member. JSDoc places a comment "immediately before the code being documented".
Source: https://jsdoc.app/about-getting-started

### F-0008 · fixed · S2 · src/app/app.ts:263 — every document change runs settleDimensions, keepOpenings and keepRooms together
What: the store wrapper applies settleDimensions(before, changed) to every command, then keepRooms(before, keepOpenings(before, next)) whenever the walls array changed by identity; refresh() does the same for previews of drags and the Modify tool (447, 475).
Proof: re-read app.ts:256-273 (every dispatch: settleDimensions, then keepOpenings + keepRooms when walls changed) and 436-480 (the same in every preview: 447 for the Modify tool, 475 for drags). keep-openings.ts:18-48: for each fromStart/fromEnd opening on a wall of a changed level, the "face" it is measured from is the nearest stop of ANOTHER wall (wall-stops.ts) before its jamb, and its stored distance is rewritten so the gap to that face stays: discriminating case: a window on the outer wall measured past a partition; dragging the partition 0.5 m moves the window 0.5 m, though the user never linked them. carry.ts:78-99 likewise reseeds rooms. constraints.ts:85-97: locked dimensions are settled on every command and can refuse it. None of these links is stored or shown; each is recomputed per change. The goal names this as root cause 2.
Source: https://en.wikipedia.org/wiki/Principle_of_least_astonishment (behaviour should be what most users expect, not what is natural from the program's internals)
Effect: a change made to one element is followed by derived changes to others (openings kept "to what they are measured from", rooms kept in their space, dimensions settled) with no explicit link the user created; moving a door or a wall can move neighbours and rooms.
Fix plan: per the goal: explicit positions; links only when the user creates them, visible; a migration that keeps each opening where it is. To shape after reading keep-openings.ts, carry.ts, dimension/constraints.ts, opening/schema.ts, opening/commands.ts, select-drag.ts.
Check: src/app/keep-openings.ts, src/app/carry.ts, src/elements/dimension/constraints.ts, src/elements/opening/schema.ts, src/app/select-drag.ts
Fix: src/app/keep-openings.ts:1-44 (rewritten: an opening is changed only when its own host changed and one end of it stayed; then a rule from the moved end takes the change of length, so the opening stays where it is; a host moved whole carries it; no other wall's face is consulted, so moving a partition beside a window no longer moves it). What stays and why: settleDimensions applies only locked or equal dimensions, which the user locks (constraints.ts: a user-made, shown link); keepRooms (carry.ts) keeps a room's seed inside the room it named so the room is not lost when walls move, and runs only when walls change (moving a door changes no wall, so neither runs). The positions are explicit (F-0068's migration and the tools' wall rules).
Fix source: https://en.wikipedia.org/wiki/Principle_of_least_astonishment (a component should behave as most users expect: an opening moves with its own wall, not with a neighbour)
Verified by: re-read src/app/keep-openings.ts:1-45, re-read src/app/app.ts:250-276 (the wrapper's call), re-read src/elements/opening/derive.ts:160-195 (fromStart/fromEnd stations: distance from the start, length − distance − width from the end); npx tsc --noEmit passes; no test calls keepOpenings (grep)

### F-0009 · fixed · S3 · src/app/boot.ts:33 — a project repaired on opening at start is reported only in the console
Proof (verify): re-read boot.ts:24-71: readStored repairs the stored project (repairProject drops bad elements, F-0137) and only console.warns the fixes (33); boot returns the doc with no fixes field (Boot has none, 12-19), and saveTo(db, id) wires autosave to it (59), so the next save writes the repaired document over the stored one: elements dropped at start are lost for good with nothing on screen. projects.ts:43, 68, 80 (switching projects) use the same readStored and also show nothing. Opening a file, by contrast, toasts the count (app-files.ts:78-90).
Source: https://developer.mozilla.org/en-US/docs/Web/API/console/warn_static (console output is a developer channel, shown only in the developer tools)
What: readStored logs r.fixes with console.warn and returns the repaired document; boot() never passes the fixes to the app, while opening a file says "n bad elements were left out" in a toast (app-files.ts:78-90).
Proof: boot.ts:33 console.warn(..., r.fixes); Boot (12-19) has no field for fixes; app.ts:388 shows only notOpened.
Effect: elements dropped from the last project (and saved back without them on the next change) disappear without a word to the user.
Fix plan: carry the fixes count in Boot and show it as the file opening does.
Check: src/app/projects.ts (readStored's other callers), src/app/app.ts:388

### F-0010 · fixed · S2 · src/app/chrome.ts:272 — the footer shows fixed keys, not the keys the user set
Fix: src/app/chrome.ts:63-89, 169-180, 251, 299-313, 393-406; src/app/actions.ts:32-33; src/app/app.ts:1770-1777, 1274; src/ui/shell.ts:38-43, 232-234; src/ui/i18n.ts (33 unused fixed-key messages removed per language: top.undo/redo/commands/shortcuts/language/export/open, foot.snap, float.*, tool.*Key; 17 messages per language given {key}/{next}/{door}/{window}); src/app/selection-ui.ts:91, 111, 121, 125, 165; src/app/modify-ui.ts:121; src/app/app-files.ts:60, 90-91; src/app/wall-ui.ts:279; src/app/input.ts:1026; src/app/view-ui.ts:289; tests/ui/consistency.test.ts (rewritten against the action list)
Fix source: https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html
Fix source: https://en.wikipedia.org/wiki/Single_source_of_truth
Fix source: https://vitest.dev/api/expect.html
Verified by: re-read src/app/chrome.ts:50-89, re-read src/app/chrome.ts:169-180, re-read src/app/chrome.ts:249-253, re-read src/app/chrome.ts:295-310, re-read src/app/chrome.ts:379-407, re-read src/ui/shell.ts:36-45, re-read src/ui/shell.ts:222-271, re-read src/app/app.ts:1270-1275, re-read src/app/actions.ts:1-36, re-read src/app/selection-ui.ts:88-127, re-read src/app/selection-ui.ts:160-167, re-read src/app/modify-ui.ts:118-123, re-read src/app/app-files.ts:56-61, re-read src/app/app-files.ts:84-92, re-read src/app/wall-ui.ts:276-281, re-read src/app/input.ts:1024-1027, re-read src/app/view-ui.ts:286-290, re-read src/app/view-ui.ts:8-9, re-read src/app/view-ui.ts:210-213, re-read src/app/app.ts:65, re-read src/app/app.ts:394-396, re-read src/app/app.ts:1272-1277, re-read src/ui/i18n.ts:7-18, re-read src/ui/i18n.ts:692-694, re-read src/ui/i18n.ts:1917-1932, re-read src/ui/i18n.ts:1952-1987, re-read src/ui/i18n.ts:2021-2025, re-read src/ui/i18n.ts:2026-2032, re-read src/ui/i18n.ts:2060-2071, re-read src/ui/i18n.ts:3973-3988, re-read src/ui/i18n.ts:4008-4043, re-read src/ui/i18n.ts:4077-4087, re-read tests/ui/consistency.test.ts:1-101; npx tsc --noEmit passes.
What changed:
- One source: every key shown for an action now comes from the action list (keyOf through the user's keymap). The footer hints use actionHint, dropped when the key is turned off. The title bar's, snaps' and view buttons' tips use tipOf. The search's key cap and the empty hint are written by renderChrome.
- Messages: the 17 that teach a key take it as a variable, filled with app.keyName(id), which falls back to the action's name in quotes when the key is off. That includes toast.section, toast.newUndo and hint.deleted(One), found beyond the finding's list.
- Not changed: the tools' own keys (C, U, Q, A, Enter, Esc in a tool, Shift, Space, arrows) are not actions and cannot be remapped, so they stay literal. The help dialog's literal key table is F-0021's.
- The old consistency test compared texts with keys written inside them. It now checks the tips built from the action list and a remapped key.
What: every key hint in the footer is a literal ('S' for snaps, 'Del', 'F', 'Esc', 'Ctrl K', 'Ctrl A', '?', 'C', 'U', 'H', 'Q', 'A'...), while actions.ts gives each action its current key through keyOf(id, own, app.keymap).
Proof: chrome.ts:272 keyHint('S', ...), 358-365 keyHint('Del'|'F'|'Esc'|'Ctrl K'|'Ctrl A'|'?'), 329-350 'Q'/'A'; actions.ts:55 keys = keyOf(id, extra.keys, app.keymap); settings.snaps has keys 'S' (actions.ts:174). Verify: re-read chrome.ts:266-366: every keyHint gets a literal; none reads app.keymap or the action list. The same actions are remappable: actions.ts:116 view.frameSelection 'F', 149 edit.delete 'Del', 174 settings.snaps 'S', each through keyOf (55). Discriminating case: remap Snaps to G in the Keys dialog: the palette shows G, the footer keeps "S snaps on".
Source: https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html (components with the same function are identified consistently; a key shown differently in two places fails that)
Effect: after the user remaps a key (Keys dialog), the footer still teaches the old key: the goal's "uma tecla mudada aparece igual em todos os lugares" fails here too.
Fix plan: the footer reads the key of the action it describes from the action list (or keymap) by action id, as the palette does.
Check: src/app/keymap.ts, src/ui/shell.ts (keyHint), src/app/input-keys.ts
Also (ui/i18n.ts, both languages): about 45 messages write the key into the text itself, so tooltips, toasts and hints keep teaching the default key after a remap: top.undo/redo (Ctrl+Z, Ctrl+Shift+Z), top.commands (Ctrl+K), top.language (Shift+L), top.export (Ctrl+S), top.open (Ctrl+O), float.delete (Del), float.zoom (F), float.frame (Home), foot.snap and toast.snapsOff (S), tool.*Key (V, W, Shift+W, D, R, L, M, G, E, T, B, P, Shift+G, Shift+D, Shift+S, Shift+T, Shift+M, Shift+C, Shift+R, Shift+X, Shift+O, Shift+E), toast.tempHidden/Isolated (Shift+H, Shift+I), help.disjoin (Shift+M), hint.pasteNothing (Ctrl+C), toast.copied (Ctrl+V), hint.pasteSameLevel and hint.seriesAfterCopy (Shift+C), hint.floorPlace (L), hint.openingNoWall (N, D, Shift+W), empty.hint (W), toast.opened* (Ctrl+Z). The fix is a {key} variable filled from the action's current key.
Also: ui/shell.ts writes keys into the chrome itself: the command search button's key cap 'Ctrl K' (42) and the view buttons' tooltips '3D (1)' and 'Plan (2)' (251-252); keyHint(key, what) (283-285) takes whatever literal the caller passes.
Also: tests/ui/consistency.test.ts:7-14, 22, 31, 48-60 assert that the tooltips are "<palette name> (<key>)" with the key written in the test and in the message text (tool.wallKey "… (W)", top.undo "… (Ctrl+Z)", float.frame "… (Home)"). They check that the texts agree with each other, not with the keymap, so a rebound key leaves every one of them stale and the test still passes. The fix makes the key a {key} placeholder filled from the action list, and the test should compare against keyOf.

### F-0011 · fixed · S3 · src/app/chrome.ts:537 — every render rebuilds the whole action list and the context entries
Proof (verify): frame.ts:331 renderFrame calls app.renderChrome() on every frame; chrome.ts:62 renderChrome calls renderRibbon; chrome.ts:537 renderRibbon calls app.actionList(), which input.ts:74 defines as appActions(app, openers) (a fresh list of every action, each with t() and tBoth()); 540-541 contextEntries again; only then is the cache key compared (560-561). Keys too: input-keys.ts:58 builds the whole list on every key press when the user has remapped anything. The cost per frame is to be measured in apptest (drag and orbit at 60 fps leave 16.7 ms a frame).
Source: https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Animation_performance_and_frame_rate (60 fps leaves 16.7 ms per frame for scripts, style, layout and paint)
What: renderRibbon (called by renderChrome on every render) calls app.actionList() (appActions: ~200 Action objects, each with t() and tBoth()) and contextEntries before comparing its cache key; placeFloatBar calls contextEntries again, also on every 3D camera change.
Proof: chrome.ts:537 const list = app.actionList(); 541 contextEntries(...); 433 contextEntries(...) in placeFloatBar; app.ts:362-367 placeFloatBar on scene.onChange; app.ts:1515-1525 render → renderFrame → renderChrome (to confirm in frame.ts).
Effect: work proportional to every action and definition (one action per object definition and per level and view) on each pointer move during drags and each orbit frame, with no change to show.
Fix plan: build the action list when what it depends on changes (document version, selection, tool, keymap, language), or compute the ribbon's key from those inputs before building it.
Check: src/app/frame.ts (where renderChrome is called)

### F-0012 · fixed · S4 · src/app/document.ts:54 — doc comments placed over the wrong declarations
Proof (verify): re-read document.ts:54-63: the DocWall comment (54-57) is followed by WallPhase's own (58) before `export type WallPhase`, and DocWall (61) has none; 236-251 re-read for the second pair.
Source: https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html (the comment right before a declaration is the one that documents it)
What: "A wall as the user placed it…" (54-57) sits over WallPhase's comment instead of DocWall (61); "A wall's number on its level…" (238) sits over startLevel's comment instead of wallNumber (250).
Proof: document.ts:54-59 two consecutive doc comments before `export type WallPhase`; 238-243 two consecutive doc comments before `export function startLevel`.
Effect: DocWall and wallNumber show no documentation; WallPhase and startLevel show the wrong one in editors.
Fix plan: move each comment to its declaration.
Check: none

### F-0013 · fixed · S2 · src/app/document.ts:314 — roof covers cached by the roof alone, not by the level's height
Proof (verify): re-read document.ts:291-324: roofCoversOf computes roofSolid(r, level.elevation + level.height) only on a cache miss (321) and the WeakMap is keyed by the Roof object (314, 320). level/commands.ts:18-35 updateLevel returns { ...doc, levels } with doc.roofs untouched, so each roof keeps its identity and covers.get(r) returns the cover computed at the old level top. Discriminating case: a level of 2.8 m with a gable roof and walls topped "under the roof"; set the level height to 3.2 m: wallHeights (306-308) still uses the old covers, so those walls stay under the roof 0.4 m too low, until the roof object itself is changed.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap (keys compared by reference: the same roof object is the same key whatever the level does)
What: roofCoversOf caches each roof's cover in a WeakMap keyed by the Roof object, computed at level.elevation + level.height; when the level's elevation or height changes and the roof object stays the same, the stale cover is returned.
Proof: document.ts:314 `covers = new WeakMap<Roof, RoofCover>()`; 320-321 `covers.get(r)` else `roofSolid(r, level.elevation + level.height)`; wallHeights (306-308) uses it for walls topped under the roof.
Effect: after changing a level's height, walls up to the roof keep their tops under the old roof position (wrong heights in 3D and sections) until the roof itself is edited.
Fix plan: key the cache by the roof and the base height (or by roof and level object), so a level change recomputes.
Check: src/elements/level/commands.ts (whether a level change replaces the roofs), src/elements/roof/geometry.ts
Also: roof/geometry.ts:61, 68: roofSolid's every height (eaves base, planes, top) comes from its `levelTop` argument, so a solid cached by the roof alone is wrong as soon as the level's top moves. level/commands.ts updateLevel changes only the levels list (noted earlier), so the roof object stays the same and the WeakMap hit is stale.
Fix: src/app/document.ts:318-336 (the WeakMap keeps { top, cover } per roof; a cover is reused only when the level's elevation + height is the one it was worked out at, else recomputed and kept).
Fix source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap (object keys compared by identity: the roof alone cannot tell a level change, so the top is kept beside the value)
Verified by: re-read src/app/document.ts:316-337; npx tsc --noEmit passes

### F-0014 · fixed · S3 · src/app/frame.ts:296 — the plan and 3D overlays each keep their own copy of the drafts and measures
Proof (verify): re-read frame.ts:73-322. The draft conditional is written twice, character for character (211-230 for the plan, 296-315 for 3D). The snap is shown in plan for 19 tools plus grip drags (148) but in 3D only for wall, floor, measure and modify (271). The measure label has 9 alternatives in plan (151-170: guide, rectangle, modify marks, wall, floor, chain, tape, bend/turn, opening guide) but 5 in 3D (285-293: no guide, rectangle, chain, turn or opening measure). Also 275 falls back to the literal 2.8 (F-0139). Discriminating case: drawing a beam in 3D shows its draft line but not where it snaps, and drawing a rectangle in 3D shows no size.
Source: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself (one authoritative representation per piece of knowledge)
Also (render/overlay-3d.ts:13-33, 51-112): the 3D overlay has its own state type (snap, axis, measure, anchor, draft) and its own drawing of each. It draws only one draft polyline and one measure tag, so drafts the plan shows (rectangles, arcs, roof and stair outlines with their own measures) appear in 3D only as frame.ts's second copy feeds them.
What: the draft polyline (chain, guide, floor, mark, beam/separator/curtain, roof, stair, railing) is written twice (211-230 for plan, 296-315 for 3D), the measure label and axis twice with different subsets (151-178 vs 277-293), and two different lists of tools that show a snap (148 vs 271).
Proof: frame.ts:211-230 and 296-315 identical nested conditionals; 148 lists 19 tools, 271 lists wall/floor/measure/modify.
Effect: a tool added or fixed in one view's branch behaves differently in the other (the same option defined in two places: the goal's root cause 1 at the level of the overlays); e.g. in 3D the snap is not shown for the dimension, grid, column, beam, roof, stair or railing tools while they draw there.
Fix plan: compute the drafts, measure and snap once per frame and pass the same values to both overlays.
Check: src/render/overlay-3d.ts, src/render/plan-view.ts

### F-0015 · fixed · S4 · src/app/geometry.ts:71 — comments that describe code that is not there
Proof (verify): re-read geometry.ts:62-75, 362-373, 443-465, 467-477. Line 71 cites app/lot-areas.ts, which no longer exists (glob finds nothing). Line 366 is a detached doc comment above openingAt's own. Lines 452-453 hold the same guide comment twice, under a header (443) that says "pieces and openings" while the code reads rooms and kinds. Line 470 is hideCategories' comment sitting above TemporaryView's. Also: levelPieces (72, set at 193) has no reader left in src (a grep for `levelPieces` finds only its declaration and assignment), so it is a field kept for the removed lot module.
Source: https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html (a /** */ block directly above a declaration documents it; a block in between is standalone)
What: levelPieces' comment names app/lot-areas.ts, a module taken out in a574453; a one-line doc comment "The opening whose outline contains p, last placed first." sits over openingAt's own (366); boundsOf says "drawn pieces and openings" but reads rooms and kinds, with "A guide has no ends: its point only." written twice (452-453); hideCategories's comment sits over TemporaryView (470).
Proof: geometry.ts:71, 366-371, 443-453, 470-475.
Effect: misleading documentation for the derivation's readers.
Fix plan: correct or move each comment; drop the stale reference.
Check: none

### F-0016 · fixed · S3 · src/app/geometry.ts:314 — endsIn copies jointsIn's band and station code
Source (also): https://en.wikipedia.org/wiki/Duplicate_code (a fix reaching only some copies leaves the others outdated)
Proof (verify): re-read geometry.ts:269-356: lines 276-295 (jointsIn) and 321-341 (endsIn) are the same statements (shape, normal, faces, the two half-planes, length, the clip of every other wall's pieces, stations, lo/hi); only 296 vs 343-344 differ. hostsIn (352-356) runs wallPieces again and passes the pieces to both, so every host × other-wall pair is clipped twice per call; hostsIn is called by every opening placement path (derive, distribute, keep-openings' stops).
Source: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself (a change to one copy must be repeated in the other)
What: endsIn (314-349) repeats jointsIn's per-wall band of half-planes, clipping of every other wall's pieces and station extraction (269-301), differing only in how the stations are used; hostsIn (352-356) then runs a whole wallPieces join again to feed both.
Proof: geometry.ts:276-292 and 321-338 are the same statements.
Effect: two copies to keep in step (a fix to one leaves the other behind); the stations of every wall pair are computed twice per derivation.
Fix plan: compute each host's covered intervals once and derive both joints and ends from them.
Check: elements/opening/derive.ts (hostsOf)

### F-0017 · fixed · S4 · src/app/guide-ui.ts:14 — levelGuides's doc comment sits over GuideMode
Proof (verify): re-read guide-ui.ts:14-16 ("The guides of the level shown…" directly above `export type GuideMode`) and 61-64 (levelGuides with its own shorter comment): GuideMode is documented with levelGuides' text.
Source: https://jsdoc.app/about-getting-started (a doc comment goes immediately before the code it documents)
What: "The guides of the level shown, unless hidden, as a move being dragged takes them. Plan only…" documents levelGuides (61) but is placed over `export type GuideMode`.
Proof: guide-ui.ts:14-16; levelGuides at 61-64 has its own shorter comment.
Effect: GuideMode shows the wrong documentation in editors (app.ts:834-835 repeats the text over its levelGuides).
Fix plan: drop the misplaced comment (or move it to levelGuides).
Check: none

### F-0018 · fixed · S4 · src/app/handles.ts:1 — the handles' header says "in plan" though they are drawn and used in 3D too
Proof (verify): re-read handles.ts:1-4 ("The handles of the selection in plan"); frame.ts passes app.handles() to the plan overlay (183) and to the 3D overlay state (320), so the same handles are drawn in both.
Source: https://en.wikipedia.org/wiki/Comment_(computer_programming) (obsolete or incorrect comments are detrimental)
What: the header describes the handles of the selection in plan; since commit 2c739a7 app.ts handles() projects them on the level's floor in 3D and the 3D overlay draws them.
Proof: handles.ts:1; app.ts:1583-1595 (3D toScreen through projectAt).
Effect: a reader takes them for plan-only.
Fix plan: say plan and 3D in the header.
Check: none

### F-0019 · fixed · S2 · src/app/input-buttons.ts:86 — the plan's scale list changes the project's scale but not the scale shown while a saved view is on
Proof (verify): re-read input-buttons.ts:86: the view bar's scale list dispatches setDrawing({ ...drawingOf(doc), scale }) and leaves ui.viewDen alone. views-ui.ts:59 sets ui.viewDen = v.den when a saved view is shown; app.ts:1081 drawingNow() returns the view's den while it is set; chrome.ts:94 sets the list's value from drawingOf(doc).scale (the project's). drawing-dialog.ts:30-36 does the right thing (shows drawingNow().scale, clears viewDen on change): the same option behaves two ways (RC1). Case: go to a saved plan at 1:50, choose 1:100 in the bar: the list says 1:100, the plan stays at 1:50.
Source: https://www.nngroup.com/articles/ten-usability-heuristics/ (heuristic 1, visibility of system status: the control must show the state in force)
What: the view bar's scale list dispatches setDrawing({ ...drawingOf(doc), scale }) without clearing ui.viewDen; while a saved plan view with its own scale is shown, drawingNow() keeps returning viewDen, so the plan does not change, yet the list (chrome.ts:94 shows drawingOf(doc).scale) shows the new value.
Proof: input-buttons.ts:86; app.ts:1079-1082 drawingNow = viewDen ?? project's; frame.ts:131 plan.drawing = drawingNow(); drawing-dialog.ts sets `app.ui.viewDen = null` before the same change; chrome.ts:94 list value from drawingOf(doc).
Effect: after going to a saved view at 1:50, choosing 1:100 in the bar changes the project's default but the plan stays at 1:50 while the list says 1:100: the control looks broken.
Fix plan: the bar does what the dialog does (clear viewDen with the change), and the list shows drawingNow().scale.
Check: src/app/views-ui.ts (goToView sets viewDen), src/ui/drawing-dialog.ts

### F-0020 · fixed · S3 · src/app/input-buttons.ts:37 — a file that fails to open is lost silently
Proof (verify): re-read input-buttons.ts:34-38 (`void app.openFile(file)`, no catch), app-files.ts:64-91 (await file.text() at 65; with a database, await importAsProject at 81) and projects.ts:53-57 (importAsProject awaits saveProject, whose transaction rejects on its error, project-db.ts:51-56). An IndexedDB transaction can fail with QuotaExceededError (a large imported project on a full origin), and the rejection reaches nothing: no footer message, no toast, the project not opened. readProject's own errors are shown (66-68); these are not.
Source: https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/error (a transaction can fail with a DOMException such as QuotaExceededError)
What: the file input calls `void app.openFile(file)`; openFile awaits file.text() and, with a database, importAsProject; a rejection of either is never caught.
Proof: input-buttons.ts:37; app-files.ts:65 `await file.text()`, 81 `await importAsProject(...)`.
Effect: an unreadable file or an IndexedDB failure only logs "Uncaught (in promise)" in the console; the footer says nothing and the user does not know the open failed.
Fix plan: catch the rejection and say it in the footer as readProject's errors are.
Check: src/app/projects.ts (importAsProject), drag-and-drop opening in input.ts if any

### F-0021 · fixed · S2 · src/app/input-keys.ts:266 — every default key exists twice: as the action's key and as a literal check
Proof (verify): re-read input-keys.ts:54-101 and 255-328. Only when the keymap is not empty is a key resolved through the action list (56-65); otherwise every default key is a literal branch: Ctrl+Z/O/S/Y/C/V/A/K (66-97), Delete/Home/? (266-268), Shift+L/W/N/M/C/R/E/X/O/S/T/D/G/J/H/I (269-285), W/D/R/L/M/P/B/T/E/G/V/F/N/S/K/1/2 (289-327). The same keys are declared in actions.ts make() (e.g. 116 F, 149 Del, 174 S) and shown from there, in the footer (chrome.ts literals, F-0010), in the context menu (LOOK, F-0003) and in the help table (input.ts:1006-1058). Remapping works (resolveKey blocks the old key), but a default key changed in code has to be changed in up to five places (actions.ts declares the same Shift keys too: 155 Modify keys, 165-166 Shift+H/I, 169 Shift+N, 177 Shift+L, each again as a literal at 269-285).
Source: https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html (single-character shortcuts must be remappable or turned off: the remapping exists, so the shown key must follow it everywhere)
What: actions.ts declares each action's key (tool.wall W, tool.door D, edit.move Shift+M, settings.snaps S, view.3d 1…), which the palette, the ribbon's tips and the File menu show; input-keys.ts implements the same keys as its own literal checks (266-327), and only consults the action list when the user has remapped something (56-65).
Proof: actions.ts:76 make('tool.wall', …, { keys: 'W' }); input-keys.ts:289 `if (key === 'w') return app.setTool('wall')`; 56 `const combo = Object.keys(app.keymap).length > 0 ? comboOf(e) : null`.
Effect: changing a default key in one place leaves the other teaching or running the old one; the key shown and the key that works are two independent lists (with chrome.ts's footer and context-menu.ts's LOOK, four): the goal's root cause 1 and "uma tecla mudada aparece igual em todos os lugares".
Fix plan: dispatch default keys through the same resolution as remapped ones (the action list's keys), keeping in input-keys only what is not an action (tool-state keys like Esc steps, arrows, digits, Space/H/C/U/A/Q within a tool).
Check: src/app/keymap.ts, src/app/actions.ts, src/app/context-menu.ts, src/app/chrome.ts, src/app/input.ts:1006-1058 (the help's own key table, a fifth copy)
Fix: src/app/keymap.ts:39-52 (SECOND_KEYS and actionOfKey, in place of resolveKey: the action whose current key the combo is, or whose second key while it keeps its own), src/app/input-keys.ts:4, 13-29, 52-64, 233-261 (byKey runs the action found in the action list, Ctrl combos early and the rest last; the literal checks for every action key and the remap-only branch removed; the tools' own keys kept before it, without Shift; KeyContext.palette gone), src/app/input.ts:35, 898-911, 1003-1042 (the help's rows by action id, name and current key from the action list; the palette member no longer passed), tests/app/keymap.test.ts:6-23, 52-77 (resolveKey cases rewritten for actionOfKey over keyed actions, plus second keys). context-menu.ts and chrome.ts already read the action list (F-0003, F-0010).
Fix source: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key (key carries Shift for letters, control keys named "Delete", "Backspace", "Home", "Escape": what comboOf turns into the combos the actions are matched with)
Verified by: re-read src/app/keymap.ts:33-61, re-read src/app/input-keys.ts:1-70, re-read src/app/input-keys.ts:225-263, re-read src/app/input.ts:30-37, re-read src/app/input.ts:893-912, re-read src/app/input.ts:1000-1067, re-read tests/app/keymap.test.ts:1-79; npx tsc --noEmit passes; no test or file uses resolveKey, wireKeys' palette or the help's old literal rows (grep)

### F-0022 · fixed · S3 · src/app/input.ts:144 — grip snaps in 3D take their reach at height 0, not on the level's floor
Proof (verify): re-read input.ts:140-152 and 165-191: snapAt passes metresPerPixel(p, 0), while worldAt (170), aimAt3d (191) and the opening aim (481) pass the real height. scene-3d.ts:1509-1514: in perspective the scale is 2·d·tan(fov/2)/h with d the camera's distance to the point at height z, so a grip dragged on a level 6 m up, seen from 10 m above the ground, gets the ground's scale. Case: with the camera 4 m above an upper floor and 10 m above the ground, the 10 px reach is 2.5× too big. Orthographic views are unaffected (1511).
Source: https://threejs.org/docs/pages/PerspectiveCamera.html (fov is the vertical field of view; the world size of a pixel grows with the distance to the camera)
What: snapAt (used for wall end grips) passes mpp = app.scene.metresPerPixel(p, 0) in 3D, while worldAt and the drawing snaps use the level's floor height (elevation + lift).
Proof: input.ts:144 metresPerPixel(p, 0); 168-170 worldAt with z = elevation + lift; snapped() uses at.mpp from aimAt3d/worldAt.
Effect: dragging a wall end of an upper level (or an exploded one) in 3D snaps with a reach sized for the ground: too small or too large in pixels, so grips snap differently from drawing on the same level.
Fix plan: give snapAt the same z as worldAt.
Check: src/render/scene-3d.ts metresPerPixel
Also: render/scene-3d.ts:1508-1514 metresPerPixel measures the perspective camera's distance to toThree(p, z), the point at the given height. With z = 0 the scale is that of the ground, not of the lifted level (orthographic views are unaffected).

### F-0023 · fixed · S3 · src/app/input.ts:434 — each tool's behaviour is spread across five if-chains in three files
Proof (verify): a search for `ui.tool === 'stair'` alone finds 10 branches in 6 files: chrome.ts:251 (hint), 311 (keys), frame.ts:148 (snap list), 226 and 311 (drafts, plan and 3D), input.ts:272, 440 (move), 759 (click), input-keys.ts:216 (Escape), ribbon-tabs.ts:385; every drawing tool repeats this pattern (F-0014 shows two of the copies already differing). This is the goal's root cause 3.
Source: https://refactoring.guru/replace-conditional-with-polymorphism (the same type check in several places: each new variant means editing every conditional)
What: what a tool does on move (input.ts:434-483), on click (664-791), on right click (549-615), on Escape and Enter (input-keys.ts:175-263), plus its hint and keys (chrome.ts:204-365) and its drafts (frame.ts:211-230, 296-315), is written as a branch in each chain; there is no per-tool object.
Proof: the same tool names repeated in each chain, e.g. 'beam' || 'separator' || 'curtain' at input.ts:440, 592, 717-735; input-keys.ts:226, 258; chrome.ts:237-244, 307; frame.ts:222, 307.
Effect: the goal's root cause 3 (giant controllers mixing responsibilities): a tool changed in one chain and not another behaves inconsistently (e.g. the 3D snap list differing from plan's, F-0014).
Fix plan: one descriptor per tool (move, click, right click, escape, enter, hint, keys, draft) dispatched by the chains.
Check: src/app/input-keys.ts, src/app/chrome.ts, src/app/frame.ts
Fix: src/session/event-tools.ts (one descriptor per tool for wall, floor, room, measure, modify, split, corner, object and the openings: click, move, right click, Esc, Enter, the tool's keys, the footer's line and keys, whether its snap is drawn), read by src/session/pointer-release.ts, pointer-handlers.ts, input-keys.ts, src/ui/footer.ts and plan-overlay.ts; with point-tools.ts every tool has one. Branch worktree-revisao-interface, 6cb3daa and 4a5dda3; checked in the app at 1920 tool by tool.

### F-0024 · fixed · S3 · src/app/input.ts:794 — no pointercancel handling on the drawing canvases
Proof (verify): re-read input.ts:794-807: pointermove, pointerdown, pointerup, pointerleave and contextmenu only; a search for 'pointercancel' or 'lostpointercapture' over src finds nothing, though input.ts:514-536 takes pointer capture for drags. After a cancel the browser sends pointerout and pointerleave, not pointerup; the pointerleave handler (799-805) clears hover and cursor but leaves ui.drag, the press point and the gestures set, so the drag hangs until the next pointerup.
Source: https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event (fired on app switch, orientation change, palm rejection, too many pointers; followed by pointerout and pointerleave)
What: the canvases listen to pointermove/down/up/leave only; a cancelled pointer (app switch, palm rejection, too many touches) never sends pointerup, so downAt, panning, boxDrag, handleDrag and the select gestures' pending drag stay set.
Proof: input.ts:794-807 (no 'pointercancel'); styles.css:536 touch-action: none prevents only the browser's own pan/zoom cancellations.
Effect: on a tablet a cancelled touch leaves a drag or a marquee hanging until the next pointerup, which then ends it at an unrelated place (a wall moved by an interrupted drag).
Fix plan: a pointercancel listener that cancels as Escape does (gestures.cancel, handle/box drag dropped, panning ended).
Check: src/app/select-drag.ts (cancel)

### F-0025 · rejected · S3 · src/app/keep-in-view.ts:32 — fitFactor can return 0, a negative factor or NaN
Rejected because: re-read keep-in-view.ts:15-34, view-ui.ts:131-193 and 225-235, frame.ts:59-65 and styles.css:1269-1326. The free part cannot reach zero or below with this layout. Above 900 px the panel is docked, so it covers nothing. Between 601 and 900 px the panel is a 300 px right drawer and the browser min(260 px, 80vw) on the left; they coexist only when the panel is peeked, leaving a free width of w − 592 > 0. At 600 px and below the panel is a bottom sheet of at most 45 % height, leaving w − 292 > 0 and h·0.55 − 80 > 0. NaN needs a zero free width with a zero-width box. Not proven: whether a very small free width (601-620 px, browser and peeked panel) zooms the plan far out on selecting; to be looked at in apptest with the 880 px and narrower runs.
Source: https://developer.mozilla.org/en-US/docs/Web/CSS/min (min(260px, 80vw) takes the smaller value, so the browser drawer is at most 260 px)
What: the factor is the free part's width and height over the box's; when panels, margins and the room above leave no free part (or a negative one: a phone's sheet plus margins taller than the view), the factor is ≤ 0, and a zero-size box over a zero-size free part gives NaN (0/0); `k >= 1 ? 1 : k * 0.95` passes them on.
Proof: keep-in-view.ts:15-21 (no clamping), 32-33.
Effect: a zoom by 0, a negative or a NaN factor collapses, flips or breaks the plan's scale (to confirm in the caller).
Fix plan: return 1 (no zoom) when the free part has no positive size or the box has none.
Check: src/app/view-ui.ts (callers)

### F-0026 · fixed · S4 · src/app/keyboard-select.ts:1 — the header says Tab steps through the elements; N does
Proof (verify): keyboard-select.ts:1-2 names Tab and Shift+Tab. The keys bound to stepping are N and Shift+N: actions.ts:168-169, input-keys.ts:271 and 323, and the help at input.ts:1050. Tab passes over snap candidates instead (input-keys.ts:50).
Source: https://en.wikipedia.org/wiki/Comment_(computer_programming) (comments must be correct and kept in sync with the code)
What: the module's comment describes "the element Tab (or Shift+Tab) goes to"; the keys wired to stepSelection are N and Shift+N, and Tab cycles snap candidates.
Proof: keyboard-select.ts:1-2; input-keys.ts:271, 323 (N / Shift+N → app.stepSelection); input-keys.ts:50 (Tab → nextSnap).
Effect: misleading documentation of a keyboard path.
Fix plan: say N / Shift+N.
Check: none

### F-0027 · fixed · S3 · src/app/keymap.ts:53 — giving an action a key the tools use takes that key from the tools without a word
Proof (verify): re-read keymap.ts:43-56: assignKey's `taken` list holds only actions whose current key equals the combo; the tools' own keys (A arc and Q rectangle while drawing walls, C/U in Modify, H hinge, Space, the arrows) are literal branches in input-keys.ts:287-308, not actions, so they never appear in it. input-keys.ts:56-65 runs a remapped key before reaching those branches. Case: assign A to "Select" in the Keys dialog; while drawing a wall, A now switches to Select instead of starting an arc, and the dialog said nothing.
Source: https://www.nngroup.com/articles/slips/ (prevent errors with constraints where clear rules exist)
What: assignKey only looks for other actions holding the combo; keys that input-keys.ts handles itself inside tools (A arc, Q rectangle, C copy/measure mode, U disjoin, H hinge, Space, arrows) are not actions, so assigning e.g. "A" to an action is accepted, and input-keys.ts then runs that action before the wall tool sees A.
Proof: keymap.ts:51-55 (taken = actions with that key); input-keys.ts:56-65 resolveKey before 287-308 tool keys.
Effect: after a remap, the wall tool's arc (A) or rectangle (Q) stops working with no explanation.
Fix plan: list the tools' own keys as reserved (or as actions) so the keys dialog warns or refuses.
Check: src/ui/keys-dialog.ts
Also: confirmed in ui/keys-dialog.ts: the capture (16-35) accepts any combo comboOf gives and calls assignKey with the action list only, so a tool's own key is taken without a warning there either.

### F-0120 · fixed · S3 · src/ui/keys-dialog.ts:57 — capturing a new shortcut fights the dialog's own keys: Esc closes the dialog, Ctrl+Z undoes, and a capture left open swallows the next key in the app
Proof (verify): re-read keys-dialog.ts:11-104 and dialog.ts:72-106.
- Order: the dialog's window capture listener is added when the dialog opens (dialog.ts:106). `listen` is added later, on a key button's click (57). MDN: listeners on one element run in the order added. So on Escape the dialog's handler schedules close() (dialog.ts:75-79) before `listen` runs. On Ctrl+Z outside a text field it undoes and calls stopPropagation (80-86), which does not stop the other listeners on window, so `listen` then also assigns the combo.
- Leftover listener: only Close removes `listen` (89-92). A backdrop click (dialog.ts:88-90) closes the dialog without removing it, so the next app key is prevented, stopped and assigned (20-31).
Source: https://developer.mozilla.org/en-US/docs/Web/API/Event/stopImmediatePropagation
What: the capture listener is added on window in the capture phase when a key button is clicked (57), after openProjectDialog's own window capture listener (dialog.ts:106). Listeners on one target run in the order added, so the dialog's handler runs first: Escape (meant as "give up", keys.note says so) schedules the dialog's close (dialog.ts:75-79); Ctrl+Z / Ctrl+Y (outside a text field) runs undo/redo (dialog.ts:80-86) and then the capture also assigns the combo, since stopPropagation does not stop listeners on the same target. When the dialog closes another way while capturing (a click on the backdrop, dialog.ts:88-90), nothing removes `listen`: the next key the user presses in the app (W to draw a wall, say) is swallowed (preventDefault, stopPropagation) and silently assigned to that action.
Proof: keys-dialog.ts:16-35, 54-59, 87-93 (only Close removes listen); dialog.ts:72-90, 106; MDN stopImmediatePropagation: listeners on one element run in the order added, stopPropagation lets the rest run.
Effect: "Esc desiste" closes the shortcuts dialog instead; trying to give an action Ctrl+Z undoes the last change; and after a backdrop click the app's next shortcut is eaten and remapped.
Fix plan: handle the capture inside the dialog's own key handler (one listener, capture first, stopImmediatePropagation), and end any capture in the dialog's close.
Check: src/app/keymap.ts (comboOf for Esc)

### F-0121 · fixed · S4 · src/ui/levels-dialog.ts:31 — clearing a level's name leaves the field empty while the level keeps its old name
Proof (verify): re-read levels-dialog.ts:28-33, level/commands.ts:17-24 and core/store.ts:36-38.
- A blank field differs from the name, so commitName dispatches it (31) and skips the else that restores the text (32).
- updateLevel returns the same doc for a blank name (21), and dispatch returns without emitting when next === doc (38), so the dialog's subscriber never redraws (dialog.ts:51-60).
The field stays blank with no message: the user is neither kept informed nor told about the error.
Source: https://www.nngroup.com/articles/ten-usability-heuristics/
What: on blur, any value different from the shown name is dispatched; updateLevel refuses an empty (or blank) name and returns the same doc (level/commands.ts:21). The store does not change, the dialog does not redraw, and commitName's else branch (which restores the text) is not taken, so the field stays blank.
Proof: levels-dialog.ts:30-33, 42; level/commands.ts:21 (blank name → doc unchanged); dialog.ts:51-60 (redraws only on a store change).
Effect: the user sees a level without a name in the dialog, and the plan's level list shows another name; nothing says the empty name was refused.
Fix plan: restore the field (and say why) when the trimmed value is empty, before dispatching.
Check: none
Also: ui/materials-dialog.ts:55 does the same with a material's name: a blank name is not dispatched, the field keeps its blank text until something else redraws the dialog.

### F-0122 · fixed · S4 · src/ui/materials-dialog.ts:170 — the material's delete button is natively disabled, so the reason it cannot delete never shows on hover
Proof (verify): re-read materials-dialog.ts:164-176. The button gets `disabled = blocker !== null` (170), and its reason is put in `title` and in aria-describedby (173-175). MDN: a disabled control cannot receive focus and gets no browsing events. A keyboard or screen-reader user therefore never reaches the button, and its description is never read. levels-dialog.ts uses aria-disabled for this reason. Correction to the title: whether a mouse hover shows the title on a disabled button differs by browser. That part is left to the app test, and the confirmed defect is that keyboard and screen-reader users cannot reach the reason.
Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/disabled
What: when a material is in use or the last one, del.disabled = true and the reason goes into its title and an sr-only description. A disabled control receives no pointer or focus events, so the tooltip is not reachable by mouse or keyboard. levels-dialog.ts:46-48 met the same problem and switched to aria-disabled, with a comment saying why; this dialog still uses disabled. Duplicate always names the copy "<name> (2)", so a second duplicate repeats the name though i18n has defaultName.copy to number copies.
Proof: materials-dialog.ts:164-176 (disabled + title), 161 (" (2)"); levels-dialog.ts:46-48; MDN disabled: disabled controls get no mouse or focus events and cannot be focused.
Effect: the user sees a greyed trash can and has no way to learn that walls use the material; two inconsistent behaviours for the same control in two dialogs; several materials named "Brick (2)".
Fix plan: one "blocked action" button helper (aria-disabled, reason as description and tooltip, click blocked in script) used by every dialog; number duplicates with defaultName.copy.
Check: src/ui/types-dialog.ts, src/ui/objects-dialog.ts (the same delete buttons)
Also: ui/tooltip.ts makes it worse: the reason in title is moved to data-tip on first hover/focus (tooltip.ts:17-23), and a disabled button gets no pointer or focus events, so the custom card never shows for it either.
Also: ui/objects-dialog.ts:318-320 the same: the definition's delete is natively disabled with its reason only in title (no description), and Duplicate names every copy "<name> (2)" (309).

### F-0123 · fixed · S4 · src/ui/menu.ts:78 — a menu taller than the window is cut off with no way to scroll
Proof (verify): re-read menu.ts:74-81 and styles.css:1481-1490. The menu is placed at max(4, min(at.y, innerHeight − h − 4)) (78). When h > innerHeight − 8 that is 4, and its bottom runs past the window. `.menu` is position: fixed with no max-height and no overflow, so overflow is `visible`: MDN says such a box "doesn't have scrollbars, is not user or programmatically scrollable". The items below the window cannot be reached by the pointer.
Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow
What: showMenu clamps the menu's top to 4 px and its left inside the window, but the menu has no maximum height or overflow (styles.css:1481-1490: position fixed, no max-height, no overflow), so when it is taller than the window its lower items lie below the screen; with position: fixed the page does not scroll to them.
Proof: menu.ts:74-78; styles.css:1481-1490; the context menu for a selection lists a dozen or more actions (app/context-menu.ts), each a full-height row.
Effect: on a phone in landscape (about 375 px tall) or a short browser window, the right-click/long-press menu's last actions (Delete, Properties) cannot be reached with the pointer.
Fix plan: max-height: calc(100dvh − 8px) and overflow-y: auto on .menu, and keep the focused item scrolled into view.
Check: src/app/context-menu.ts (how many items a menu gets)

### F-0124 · fixed · S4 · src/ui/object-snapshot.ts:23 — the WebGL test creates the canvas's context first, so the renderer's own context options are ignored
Proof (verify): re-read object-snapshot.ts:20-25. Line 23 calls canvas.getContext('webgl2') with no attributes. Line 25 then builds the WebGLRenderer on the same canvas asking for antialias, alpha and preserveDrawingBuffer. MDN: later calls with the same type "always return the same drawing context instance as was returned the first time … It is not possible to get a different drawing context object". The renderer therefore works on the probe's context, created with the default attributes, so preserveDrawingBuffer is false despite the comment at 24.
Source: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
What: stageOf probes `canvas.getContext('webgl2')` with no attributes, then builds the WebGLRenderer on the same canvas with antialias, alpha and preserveDrawingBuffer: true. A canvas returns the first context it created for a type on every later call, so the renderer gets the probe's default context (preserveDrawingBuffer false, three.js's own power and stencil choices not applied).
Proof: object-snapshot.ts:22-25; MDN getContext: later calls with the same type always return the first context instance; attributes take effect only at creation.
Effect: the comment's intent ("the buffer kept until then") does not hold; the snapshots still work only because toDataURL is called in the same task as render. Any later change that reads the picture after a yield (an await, a requestAnimationFrame) gets a blank image.
Fix plan: probe on a throwaway canvas (or pass the attributes on the first getContext and give that context to the renderer).
Check: src/ui/definition-editor.ts and render/scene-3d.ts (how their renderers get contexts)

### F-0125 · fixed · S4 · src/ui/objects-dialog.ts:193 — the object library's "more" menu is marked as a menu but behaves as none
Proof (verify): re-read objects-dialog.ts:170-209. The "more" button toggles `menu` and redraws (177-180). It sets aria-expanded (181) but no aria-haspopup. Focus is kept on the button by its data-focus key, and the role="menu" div (195) has no keydown handler, so its items are reached only by Tab. The WAI-ARIA APG menu button needs aria-haspopup="menu" or "true", and Enter or Space opens the menu and focuses its first item. ui/menu.ts's showMenu already implements that pattern.
Source: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
What: the "…" button toggles a div with role="menu" and three role="menuitem" buttons, but the button has no aria-haspopup, focus stays on the button when it opens, arrows/Home/End/typeahead do nothing, Escape closes the whole dialog (dialog.ts's window handler), and a click elsewhere leaves it open. ui/menu.ts already implements the pattern (showMenu with menuKey).
Proof: objects-dialog.ts:177-209 (toggle, role menu, no key handling); dialog.ts:75-79; menu.ts:23-85; WAI-ARIA APG menu button: aria-haspopup and aria-expanded on the button, Enter/Space opens and focuses the first item, the menu follows the menu keyboard pattern.
Effect: a screen-reader user is told there is a menu and then cannot move in it as announced; keyboard users must Tab through items; Escape throws them out of the store.
Fix plan: open the library actions with showMenu at the button (as the context menu does), with aria-haspopup="menu" on the button.
Check: none
Also: ui/ribbon.ts openMenu (88-139) is a third menu implementation: Up/Down and Escape only (no Home/End, typeahead or Tab), listeners on document. Menus are built three ways (menu.ts, ribbon.ts, objects-dialog.ts) with three behaviours.

### F-0129 · fixed · S4 · src/ui/ribbon.ts:177 — the ribbon's tabs are marked as ARIA tabs but have none of the tabs' keyboard or panel links
Proof (verify): re-read ribbon.ts:166-189. Each tab is a button with role="tab" and aria-selected, with no aria-controls (177) and no tabindex management; only a click listener runs (179). The panel box gets only an aria-label (171), with no role="tabpanel" and no aria-labelledby. The WAI-ARIA APG tabs pattern needs:
- each tab to have aria-controls pointing to its tabpanel;
- each tabpanel to have aria-labelledby pointing to its tab;
- Tab into the list to focus the active tab, and Left/Right to move between tabs.
Source: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
What: each tab is a button with role="tab" and aria-selected inside a role="tablist" (shell.ts), but there is no tabpanel: the ribbon box gets an aria-label only (171), no tab has aria-controls, the panel no aria-labelledby; every tab stays in the Tab order (no roving tabindex) and Left/Right/Home/End do nothing.
Proof: ribbon.ts:175-182, 170-171; WAI-ARIA APG tabs: Left/Right move between tabs, Tab moves into the panel, each tab has aria-controls to its tabpanel, the panel role tabpanel labelled by its tab.
Effect: a screen reader announces "tab, 2 of 7" but the keys it then suggests do nothing; keyboard users tab through every tab before reaching the ribbon's buttons, on every tab change.
Fix plan: arrows/Home/End move between tabs with a roving tabindex, the ribbon box role tabpanel with aria-labelledby the chosen tab, aria-controls on each tab.
Check: src/ui/shell.ts (the tablist and the ribbon box)
Also: ui/shell.ts gives role="toolbar" to the ribbon (55), the floating bar (85) and the view bar (98), but none has a toolbar's single tab stop or arrow-key movement; every button is a separate Tab stop. The ribbon is a toolbar to the reader and the tabs' panel to the eye.

### F-0130 · fixed · S4 · src/ui/sections-dialog.ts:38 — each section in the list is a button given role="listitem", so screen readers no longer see a button; the dialog keeps the removed sheets' names
Proof (verify): re-read sections-dialog.ts:34-83. Each mark is a `<button … aria-pressed … role="listitem">` (38). ARIA in HTML lists the roles allowed on button (checkbox, combobox, … tab, treeitem), and listitem is not one of them. The role overrides the button semantics, so its aria-pressed state and press action are not exposed as a button's. The class names 'sheet-list', 'sheet-item', 'sheets-dialog', 'sheet-body', 'sheet-side' (36, 38, 79, 81) and 'print-page' (72) come from the removed sheets and printing.
Source: https://www.w3.org/TR/html-aria/
What: the marks are `<button role="listitem" aria-pressed>` inside a role="list" div. The explicit role replaces the button's own, which ARIA in HTML does not allow on a button: assistive technology hears a list item, not a pressable button, and aria-pressed is not valid on a listitem. The dialog's classes and texts still come from the removed sheets/print/tour areas (sheet-list, sheet-item, sheets-dialog, print-page, tour-empty; the header "drawn as it prints").
Proof: sections-dialog.ts:34-46, 57, 72, 79-81, 1-2; MDN listitem role: an ARIA role replaces native semantics, listitem is not allowed on button.
Effect: a screen-reader user cannot tell the sections are choices to press; the leftover names mislead the next reader of the code and the CSS.
Fix plan: a plain list (ul/li) holding plain buttons (or role group with aria-pressed buttons); rename the classes to section-*.
Check: src/ui/styles.css (the sheet-*, print-page, tour-empty rules)

### F-0131 · fixed · S4 · src/ui/styles.css:2146 — the stylesheet keeps the removed areas' rules and tokens
Proof (verify): re-read styles.css:2146-2164.
- Dead rules: `.rules` (the norms dialog, rules-dialog.ts, removed), `.approval-done`/`.approval-na` and `.lot-areas`. A grep of src/**/*.ts finds no class "rules", "approval-*" or "lot-areas". The 'rules' matches are a Doc field name (document.ts:150) and the editor's tab id, not classes.
- Dead tokens: --stick, --stick-knob, --lot-col, --debug-w and --tour-w are declared (63-89) and not read anywhere.
- Duplicate: --dialog-w-xl is declared twice, 980px (79) then 860px (83). By the cascade's order of appearance the later one wins, so the dialogs at 1747 and 1756 use 860px.
Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Introduction
What: rules and tokens that no element uses survive step 1's CSS sweep: .rules and its checkboxes (the norms dialog, 2146-2159, 2188-2193), .approval-done/.approval-na (2160-2163), .lot-areas table (2164-2187); tokens --stick and --stick-knob (walk), --point-card-w (points), --lot-col, --dialog-w-budget, --schedule-h, --debug-w, --tour-w (63-89, read by nothing). --dialog-w-xl is declared twice (79: 980px, 83: 860px). Comments describe removed features (".dialog-xl" "Quantity schedules", ".sheets-dialog" "its PDF and Close buttons", ".toast" "CSV saved", the services' "ok" colour). (The store cards' loading pulse animates opacity only, which MDN's reduced-motion page itself offers as the gentle alternative, so it is not counted here.)
Proof: styles.css lines cited; grep of the classes and tokens in src/**/*.ts: none (classes) and only their declarations (tokens).
Effect: about 70 lines of dead CSS and 8 dead tokens mislead whoever restyles the interface (the other session's redesign), and the duplicate token makes the XL dialogs 860 px wide while the first declaration says 980.
Fix plan: delete the dead rules and tokens and the duplicate, reword the comments.
Check: src/app/geometry.ts:71 (a comment pointing at the removed app/lot-areas.ts)
Also: the dark theme's tokens are split over two `:root[data-theme='dark']` blocks (175 and 2228, the second only for --title-bg). tests/ui/contrast.test.ts:11-20 reads only the first block whose selector matches, and no pair checks the title bar (--title-text on --title-bg) in either theme. Keep one dark block and add the title bar pair.

### F-0132 · fixed · S4 · src/ui/tooltip.ts:17 — the custom tooltip takes the title away from assistive technology and vanishes when the pointer moves onto it
Proof (verify): re-read tooltip.ts:1-79.
- Hidden from assistive technology: textOf moves each title into data-tip and removes the attribute (18-21). The card (role="tooltip", 9-11) is never referenced by aria-describedby, so the text is no longer exposed with the element.
- Not hoverable: pointerout hides it unless the pointer moves inside the owner (64-67), so moving onto the card hides it.
WCAG 2.2 SC 1.4.13 asks author tooltips to be "hoverable": "the pointer can be moved over the additional content without the additional content disappearing". It exempts only the browser's own title tooltip, which this code replaces.
Source: https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html
What: the first hover or focus moves every element's title into data-tip and removes the attribute (17-23). The card shown is a role="tooltip" div that no element references (no aria-describedby), so whatever only lived in a title (a reason a button cannot act, a key, a full name cut by an ellipsis) is no longer exposed to screen readers. The card has pointer-events: none and hides on the trigger's pointerout, so the pointer cannot rest on it.
Proof: tooltip.ts:17-23, 28-29, 64-67; styles.css:1721-1736 (pointer-events none); WCAG 2.2 Understanding 1.4.13: custom (author) tooltips must be dismissible, hoverable and persistent; only the browser's own title tooltip is exempt. Examples of title-only information: materials-dialog.ts:173, objects-dialog.ts:320 (why delete is blocked), fields.ts:50 (the full field name).
Effect: screen-reader users lose the reasons and full names the title carried; magnifier users cannot move onto a tooltip to read it.
Fix plan: link the card with aria-describedby on the owner while shown (or keep the text in an aria-description), and keep it shown while the pointer is over the card itself (pointer events on, hide on leaving both).
Check: none

### F-0133 · fixed · S4 · src/ui/controls.ts:177 — every "pick one" control is announced as a row of independent toggle buttons
Proof (verify): re-read controls.ts:171-193. segmented builds a role="group" div of buttons, each with aria-pressed (177-179). It picks exactly one value (onChange(o.value)), and every button is its own Tab stop, with no arrow keys. That is the semantics of separate toggle buttons. The APG radio group pattern for a one-of-many choice uses role radiogroup, role radio with aria-checked, Tab into and out of the group, and arrows to move and check.
Source: https://www.w3.org/WAI/ARIA/apg/patterns/radio/
What: segmented() (used for the reference line, top rule, units, slope format, door side, hinge, kinds and every other one-of-n choice in panels, dialogs and the ribbon) is a role="group" of buttons with aria-pressed. aria-pressed describes independent on/off toggles; nothing tells assistive technology that exactly one is chosen, and each button is its own Tab stop with no arrow keys.
Proof: controls.ts:171-193; units-dialog.ts:22-28, 48-53 (one length unit, one slope format); MDN aria-pressed: a toggle button's own pressed state.
Effect: a screen-reader user hears "Metres, toggle button, pressed; Centimetres, toggle button, not pressed…" and cannot tell that pressing one releases the other; keyboard users tab through every option.
Fix plan: render one-of-n choices as a radiogroup (role radio with aria-checked, one Tab stop, arrows move and select), keeping aria-pressed for the true toggles (the 3D view bar's).
Check: src/ui/fields.ts (segmented fields), src/ui/shell.ts (view bar groups)

### F-0134 · fixed · S4 · src/core/measure.ts:130 — variables are looked up with `in`, so names inherited from Object.prototype count as existing
Proof (verify): re-read measure.ts:16-23 and 129-133, and variables-dialog.ts:30-40. The parser takes a word as a variable when `name[0] in variables` (130) and returns variables[name[0]]. The dialog refuses a name when `n in vars` (37). `variables` is a plain object literal ({} at 17, 31). MDN: `in` "returns true for properties in the prototype chain", for example hasPerson("hasOwnProperty") is true. Names such as toString or valueOf pass isVariableName (23), so they read as existing variables.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in
What: the parser takes a word as a variable when `name in variables` (130) and returns `variables[name]`; the variables dialog refuses a new name when `n in vars` (variables-dialog.ts:37). `in` walks the prototype chain, so valueOf, toString, constructor, hasOwnProperty and the like are "found" though no variable has them: typing `valueOf` in a measure returns a function (the measure then fails as not a number), and naming a variable `toString` is refused with "no other variable has it".
Proof: measure.ts:23 (these names pass isVariableName), 129-133; variables-dialog.ts:37-39; MDN `in`: true for properties in the prototype chain; use Object.hasOwn for own ones.
Effect: a confusing refusal for a handful of names, and a measure that "cannot be read" instead of saying the name is unknown.
Fix plan: Object.hasOwn(variables, name) in both places (or keep the variables in a Map).
Check: none

### F-0135 · fixed · S4 · tests/app/context-actions.test.ts:37 — test names describe a different list of actions than the one they assert
Proof (verify): re-read context-actions.test.ts:32-53.
- Door (37-38): the name lists move, flip hinge, flip swing, select similar, properties, delete. The test expects ['move', 'toggleOpen', 'flipHinge', 'flipSwing', 'properties', 'delete'], so there is no selectSimilar, and toggleOpen is not in the name.
- Window (41-42): the name says "frame", and the test expects toggleOpen with no frameSelection.
Vitest uses the first argument as the test's name, so a failure reports a description that does not match what is checked.
Source: https://vitest.dev/api/
What: "a door: move …, flip hinge, flip swing, select similar, properties, delete" asserts ['move', 'toggleOpen', 'flipHinge', 'flipSwing', 'properties', 'delete'] (no select similar, toggleOpen not named); "a window: move, centre on its wall, select similar, frame, properties, delete" asserts toggleOpen and no frame; "a wall: … (framing one is F)" and "an outline floor: … frame …" are as written. The names were left behind when the lists changed.
Proof: context-actions.test.ts:37-43.
Effect: whoever reads a failing test is told the menu should hold actions it is not asked to hold; the tests document the old menu.
Fix plan: rename the tests to what they assert (or derive the names from the arrays).
Check: none
Also: tests/app/keyboard-select.test.ts:1-2 says Tab and Shift+Tab step through elements; the keys are N and Shift+N (actions.ts:168-169, input-keys.ts:271, 323), and Tab in the drawing only moves the typed length to its angle (input.ts:843-847).
Also: tests/tools/measure-chain.test.ts:58 is named "two points stay as they were: a third click starts again", but it asserts only that Enter leaves the done measure as it is (59-61); no third click is made.
Also: tests/app/view-3d.test.ts:2 says every level's plan is cut at 1.2, but the first level is given cutHeight 1.5 (11) and the test expects 4.3 = 2.8 + 1.5 (36).

### F-0126 · fixed · S4 · src/ui/openings-dialog.ts:34 — the five stores copy the same skeleton, each with its own search folding and picture cache
Proof (verify): a grep over src/ui finds the same parts in five dialogs, each written again.
- Folding: a local fold in objects-dialog.ts:45, openings-dialog.ts:55, floors-dialog.ts:78, presets-dialog.ts:91 and types-dialog.ts:70, using the range [̀-ͯ]. ui/search.ts:12 exports a shared fold that uses \p{M}. MDN's Unicode class escape page: \p matches by property, so the fixed range is a smaller set of marks.
- Picture caches: two keyed by WeakMap (objects, types) and three by string (openings, floors, presets, F-0115).
- Workers: each has its own `working` flag (121, 32, 54, 69, 45).
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Unicode_character_class_escape
What: objects-dialog, openings-dialog, floors-dialog, presets-dialog and types-dialog each re-implement the same store: a lazy picture queue (`pending`, `working`, `work()` stepping by setTimeout), the kept grid scroll, the search box with its own `fold` (five local copies, ui/search.ts already exports one with a different, Unicode-wide mark class), folders with counts, cards with aria-pressed, a side panel and a main button. The caches differ (objects: WeakMap by materials and definition; openings and floors: Map by id and size, never invalidated).
Proof: openings-dialog.ts:16-53, 55, 93-99; floors-dialog.ts:41-74, 78, 98-104; objects-dialog.ts:45, 70-80, 119-143, 236-243; presets-dialog.ts:91; types-dialog.ts:70; search.ts:12.
Effect: a fix to one store (picture invalidation F-0115, the double-click after a redraw, keyboard behaviour) has to be made five times and is not; search folds accents differently in the palette and in the stores.
Fix plan: one store component (cards, folders, search, lazy pictures, side, main action) fed by a small description per store, and the shared `fold` from ui/search.ts.
Check: none
Also: the copies already diverge: presets-dialog.ts (130-145) does not keep the grid's scroll, so choosing a card low in the list jumps the grid back to the top on the redraw, while the other stores keep it; it also redefines `words` (20) instead of importing elements/object/fields.ts's.

### F-0127 · fixed · S4 · src/ui/openings-dialog.ts:122 — double-clicking a card to place it likely never fires: the first click rebuilds the grid
Proof (verify): re-read openings-dialog.ts:106-124. The first click sets `chosen` and calls dialog.redraw() (118-121). redraw replaces the whole layer (dialog.ts:44), so the second click lands on a new card element. MDN: dblclick fires when the button is "clicked twice on a single element". The dblclick listener (122) is on the first card, which is gone by the second click. Whether a given browser still dispatches dblclick to the new element is to be seen in the app test. By the documented definition, the two clicks are on different elements.
Source: https://developer.mozilla.org/en-US/docs/Web/API/Element/dblclick_event
What: the first click on a card sets `chosen` and calls dialog.redraw(), which replaces the whole dialog (back.replaceChildren(render(close))), so the second click of a double click lands on a new card element. dblclick is defined as two clicks on a single element; the listener on the old card is gone and the new card saw only one click. The same in objects-dialog.ts:257-264.
Proof: openings-dialog.ts:118-122; objects-dialog.ts:257-264; dialog.ts:35-50 (redraw replaces the children); MDN dblclick: fired when a button is rapidly clicked twice on a single element.
Effect: the advertised "double-click to place" does nothing on a card not already chosen; the user must click Place.
Fix plan: choose without rebuilding the grid (update aria-pressed and the side panel in place), or place on a click of the already chosen card; confirm in the app test.
Check: apptest (double click on an unchosen card in both stores)

### F-0128 · fixed · S4 · src/ui/overrides-dialog.ts:96 — the overrides dialog gives red two opposite meanings, and a second override for the same wall type can be added
Proof (verify):
- Colours: re-read overrides-dialog.ts:38-45 and 86-106. The note at 96 (i18n.ts:493, pt 2582) says walls to demolish are red and new ones green, and Add creates the first override in red, "a wall to demolish" (42, 45). The phases note at 103 (i18n.ts:1473-1474, pt 3562-3563) says, in the same dialog, that walls to be built are red and walls to be demolished yellow.
- Duplicates: `free` falls back to doc.wallTypes[0] (43), so Add stays enabled when every type already has an override and adds a duplicate.
Source: https://www.nngroup.com/articles/ten-usability-heuristics/
What: the wall overrides' note says walls to demolish are red and new ones green (ovr.note), and the first new override is created red for "a wall to demolish" (42-45); a few lines below, the phases section says that with overrides on, walls to be built are red and walls to be demolished yellow (ovr.phasesOn/ovr.phasesNone). When every wall type already has an override, Add falls back to the first type (`?? doc.wallTypes[0]`, 43) and makes a duplicate, whose precedence nothing states.
Proof: overrides-dialog.ts:42-45, 96, 101-103; i18n.ts:493, 1473-1474 (and pt 2582, 3562-3563).
Effect: on one screen red means "demolish" and "build"; a renovation plan drawn with both conventions reads backwards. Two overrides for one type make the colour depend on list order.
Fix plan: one colour convention for both (and say it once); disable Add when every type has an override, as the room overrides' Add does when no use is free.
Check: src/render/plan-view.ts (which override wins, phase colours)

### F-0028 · fixed · S4 · src/app/kind-tools.ts:324 — elevations around the model are recognised by their translated name
Proof (verify): re-read kind-tools.ts:316-334: `have` is the set of existing elevation names (324); each new elevation is named t(`section.side.<side>`) in the current language (326) and skipped only when that exact name exists (327). Case: add the four elevations in Portuguese ("Norte"…), switch to English, add again: "North"… do not match and four more are added on the same sides; renaming one does the same for its side.
Source: https://en.wikipedia.org/wiki/Internationalization_and_localization (locale-dependent text is kept apart from the program's logic and data; here a translated label is used as an identity)
What: addElevations skips a side when an elevation with the name t(`section.side.<side>`) exists; the name is the current language's word and the user can rename it.
Proof: kind-tools.ts:324 (have = names), 326 (name from t), 327 (filter by name).
Effect: after switching language or renaming an elevation, "add elevations" adds a second elevation on the same side.
Fix plan: recognise an existing elevation by its geometry (side of the box) rather than its name, or accept as documented.
Check: elements/section/schema.ts elevationsAround

### F-0029 · fixed · S3 · src/app/main.ts:11 — a failure while starting leaves a blank page with nothing said
Proof (verify): re-read main.ts:8-17: `void boot().then(...)`, no catch. boot.ts:47-70 calls listProjects, readStored→loadProject and saveProject after openDb, none inside a try (only the open itself is, 41-46). Any of them rejecting (a transaction error, quota), or a throw in new App or wireInput, rejects the chain; the default handling of an unhandled rejection is a console message, so the page stays empty.
Source: https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event (an unhandled rejection only produces a console error by default)
What: `void boot().then(...)` has no rejection handler; boot() does not catch listProjects/loadProject/saveProject rejections (boot.ts note), and a throw in new App also rejects the chain.
Proof: main.ts:11-17; boot.ts:47-71 (no catch around the database calls after openDb).
Effect: a database error at start (quota, a corrupt store, a blocked upgrade) shows an empty page; only the console says why.
Fix plan: catch the chain: on a boot failure fall back to a new document without the database (as boot already does when openDb fails) and say so.
Check: src/io/project-db.ts

### F-0030 · fixed · S2 · src/app/next-element.ts:27 — walls, doors and windows have a second field list for the next element (root cause 1)
Proof (verify): re-read next-element.ts:19-52: slotOf has no slot for walls, doors or windows (27, 49-50 default null). Their next element lives in ui.defaults and ui.openingDefaults, and their fields come from separate lists: wall/fields.ts:288 nextWallFields and opening/fields.ts:329 nextOpeningFields. The ribbon builds the next opening's fields as placeSideFields + nextOpeningFields (ribbon-tabs.ts:330), while the side panel uses nextOpeningFields alone (opening/panel.ts:75), so the leaf side and hinge appear in one and not the other. The same option is defined in three places.
Source: https://www.nngroup.com/articles/consistency-and-standards/ (internal consistency: the same function shown the same way across the product; a single source of truth)
What: next-element.ts builds every other kind's next element from the kind's own field list; walls and openings are left out (slotOf returns null for them) and keep WallDefaults / OpeningSize with separate nextWallFields / nextOpeningFields, so each option is defined twice.
Proof: next-element.ts:27 (comment), 28-52 (no wall/door/window slot); the goal names nextWallFields and nextOpeningFields.
Effect: an option added or changed in the wall/opening panel differs, or is missing, on the ribbon/panel before the click.
Fix plan: make walls and openings slots of this template, their fields from wallFields/openingFields filtered as here; remove the next* lists.
Also (stores): the next door/window chosen in the doors and windows store is written straight into ui.openingDefaults (openings-dialog.ts:100-104), the next wall's type from the wall types store into ui.defaults (types-dialog.ts:172-175), while the floor and structure stores write app.next[slot] (floors-dialog.ts:139, presets-dialog.ts:126): three different homes for "the next element" depending on the kind.
Also (ui/fields.ts): the same field list is drawn by two renderers that differ: fieldsSection (144-184, the side panel) shows readouts, notes, actions, the own-over-type mark with its reset button, sub and wide layouts; ribbonFieldRows (191-205, the ribbon) drops readouts, notes and actions and never shows the override mark or the way back to the type, and its scrub label has no `for`, so the value is not previewed while scrubbing. The same option looks and behaves differently in the ribbon and the panel, against the goal's "a mesma opção igual na faixa, no painel lateral e no painel flutuante".
Check: src/elements/wall/fields.ts, src/elements/opening/fields.ts, app.ts (wall defaults, opening size)
Fix: src/elements/wall/fields.ts:287-325 (nextWall: a template wall '__next__' of the tool's settings on the level shown, with wallFields' own fields kept to those a wall not yet drawn has; their changes become WallDefaults patches; nextWallFields removed), src/elements/opening/fields.ts:1-3, 60, 328-353, 362-384 (nextOpening: a template opening with openingFields + styleFields minus mark/kind/notes/actions, the changes made to the tool's OpeningSize, a model bringing its size; nextOpeningFields and nextStyleFields removed; modelField without its styleOf variant), src/elements/opening/panel.ts:20, 73-77, src/ui/panel.ts:12, 28-29, 173-177, src/app/ribbon-tabs.ts:18-19, 321-322, 331-332, src/app/frame.ts:339, 351 (the level shown in the panel's input and key), src/app/next-element.ts:27-31 (comment). The settings stay where the tools read them (ui.defaults, ui.openingDefaults; app.next for the registry kinds): what the finding's Effect is about, the options defined twice, is gone; moving the walls' and openings' settings into app.next is not done (it changes no option and every tool reading them, wall-ui.ts makeWall, app.ts openings, the stores).
Fix source: https://en.wikipedia.org/wiki/Prototype_pattern (new objects made from a prototypical instance instead of a separate structure per type: the next wall is a wall, the next opening an opening)
Verified by: re-read src/elements/wall/fields.ts:284-326, re-read src/elements/wall/fields.ts:5, re-read src/elements/wall/fields.ts:276-282, re-read src/app/frame.ts:25, re-read src/app/frame.ts:268-276, re-read src/app/next-element.ts:6-9, re-read src/app/next-element.ts:86-89, re-read src/elements/opening/fields.ts:1-5, re-read src/elements/opening/fields.ts:55-62, re-read src/elements/opening/fields.ts:325-384, re-read src/elements/opening/panel.ts:14-77, re-read src/ui/panel.ts:23-30, re-read src/ui/panel.ts:166-181, re-read src/app/ribbon-tabs.ts:14-21, re-read src/app/ribbon-tabs.ts:312-335, re-read src/app/frame.ts:336-353, re-read src/app/next-element.ts:24-35; npx tsc --noEmit passes; no file or test uses nextWallFields, nextOpeningFields or nextStyleFields (grep)
Also (opening/fields.ts): openingFields (37-74) and nextOpeningFields (329-341) each write their own model, width, height and sill fields. The next-opening's make is styleFields adapted by casting an OpeningSize into a fake OpeningSolid (`as unknown as`, 347-362). The next list has no mark, kind or leaf, and the placed list has its own `when`s. Two lists for one option, held together by casts the compiler cannot check.
Also: the ribbon's next-opening fields are placeSideFields plus nextOpeningFields (ribbon-tabs.ts:330). The side panel's are nextOpeningFields alone (opening/panel.ts:75), so the leaf side and hinge show in one and not the other. nextStyleFields calls styleFields without the materials list (fields.ts:352), so the leaf and frame materials can be chosen for a placed opening (520-536) but never for the next one.
Also (wall/fields.ts): nextWallFields (287-343) rewrites type, reference, base offset and top. It leaves out phase (108-122), the "up to a level" offset (166-180), "keep on type change" and the height readout. Its comment says "the same choices as a wall's, from the same fields", but they are separate copies; lines 297-299 still carry the pasted indentation. Choosing "up to a level" takes the level above for a placed wall (148, levelAbove of its level) but the highest other level for the next walls (311, levelAbove(doc, undefined)). Drawing on the ground floor of a three-storey project, the next walls rise to the top level instead of the first floor.

### F-0031 · fixed · S4 · src/app/object-handles.ts:37 — handle reach for touch decided by the primary pointer only
Proof (verify): re-read object-handles.ts:36-37: reach() is 22 px only when `(pointer: coarse)` matches, which tests the primary pointing device. On a touch-screen laptop whose primary device is the trackpad, a finger gets the 10 px reach (a 20 px target).
Source: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/pointer (`pointer` tests only the primary device; `any-pointer` tests any)
What: reach() gives 22 px only when `(pointer: coarse)` matches, i.e. when the PRIMARY pointer is coarse; a touch screen laptop (primary mouse) touched with a finger gets 10 px.
Proof: object-handles.ts:37; MDN @media/pointer: pointer = primary device, any-pointer = all.
Effect: on hybrid devices the handles are hard to hit with a finger.
Fix plan: decide by the event's pointerType (touch) where the pick happens, or use any-pointer.
Check: other `pointer: coarse` uses (grep)

### F-0032 · fixed · S3 · src/app/persist.ts:131 — keeping an unreadable old document can throw out of loadDocument
Proof (verify): re-read persist.ts:121-133: when the stored document cannot be read, setItem(`${DOC_KEY}.invalid`, raw) runs outside any try (131). This copies a document that already fills part of localStorage's quota, so a large one can exceed it. loadDocument is called by boot (boot.ts:39, 45, 65), which is not caught (F-0029), so the page stays empty. saveDocument (56-62) does wrap its setItem.
Source: https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem (setItem throws QuotaExceededError when storage is full)
What: loadDocument copies the unreadable document to `cad2.document.v1.invalid` with setItem outside any try; the copy doubles the stored size, so on a full storage setItem throws QuotaExceededError.
Proof: persist.ts:131 (no try; storage() only guards access); MDN Storage.setItem throws QuotaExceededError.
Effect: boot() rejects (boot.ts calls loadDocument), and main.ts's unhandled chain (F-0029) leaves a blank page.
Fix plan: put the copy in a try and log its failure, as saveDocument does.
Check: src/app/boot.ts (loadDocument callers)

### F-0033 · fixed · S4 · src/app/reference-ui.ts:74 — a PDF recognised by its MIME type gets a picture's scale
Proof (verify): re-read reference-ui.ts:70-78: line 71 renders a PDF when the name ends in .pdf OR the type is application/pdf; line 74 picks the PDF scale ((0.0254/150)·100 ≈ 0.0169 m per px) by the name only, else IMAGE_SCALE 0.01 (reference/schema.ts:34). Correction to the Effect above: such a PDF comes in at about 0.59 of the intended 1:100 size, not 6×. Reachable only when the File's type says PDF without the extension (a file handed over by another app or page with an explicit type), since browsers normally derive type from the extension.
Source: https://developer.mozilla.org/en-US/docs/Web/API/File/type (type is assumed from the extension, may be empty or set otherwise; not reliable alone)
What: line 71 renders a PDF when the name ends in .pdf OR the type is application/pdf; line 74 picks the PDF scale only by the name.
Proof: reference-ui.ts:71 vs 74.
Effect: a PDF dropped without the extension (e.g. from some apps or "download" names) comes in at 1 px = 1 cm instead of 1:100: about 6× the size expected.
Fix plan: decide "is PDF" once and use it for both.
Check: none

### F-0034 · fixed · S3 · src/app/reference-ui.ts:41 — every PDF imported leaves its pdf.js worker alive
Proof (verify): re-read reference-ui.ts:36-52: getDocument(...) is called without a shared worker, its loading task's promise taken, page 1 rendered, and neither the document nor the loading task is destroyed. The pdf.js API says the loading task's destroy() aborts requests and destroys the worker, and the installed types (api.d.ts:1066-1069) say the same of PDFDocumentProxy.destroy(): without either, each imported PDF leaves a worker and its document in memory for the session.
Source: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentLoadingTask.html (destroy(): "Abort all network requests and destroy the worker")
What: pdfPicture loads the document and never calls pdf.destroy(); in pdfjs-dist 4.10.38 PDFDocumentProxy.destroy() "Destroys the current document instance and terminates the worker".
Proof: reference-ui.ts:41-51 (no destroy); node_modules/pdfjs-dist/types/src/display/api.d.ts:1066-1069.
Effect: each PDF reference keeps a worker and the document's memory for the rest of the session.
Fix plan: destroy the document in a finally after the page is rendered.
Check: none

### F-0035 · fixed · S3 · src/app/room-ui.ts:32 — a new room can get the number of a room already there
Proof (verify): re-read room-ui.ts:22-46: n = (rooms on the level) + 1 (32), and the new room is named and numbered from n (34). Case: rooms 1, 2, 3; delete 2; the count is 2, so the next room is "Room 3" with number "3", the same as the one still there. kinds/room.ts:18-20 nextNumber (highest numeric number + 1) exists and is used for copies, but not here.
Source: https://en.wikipedia.org/wiki/Unique_identifier (a serial number is assigned incrementally by one reference; counting what is left repeats a number after a deletion)
What: the room tool numbers a new room as (rooms on the level) + 1; after a room is deleted (or numbers were edited) that count matches a number in use.
Proof: room-ui.ts:32-34 (n from the count, number String(n)).
Effect: rooms 1, 2, 3; delete 2; the next room is numbered 3 and named "Room 3" again: two rooms "3" in plan and in the interior elevations' names (kind-tools.ts:354 skips names already there, so the second room's elevations are not made).
Fix plan: the next number = the highest numeric number on the level + 1 (or the first unused): elements/kinds/room.ts:18-20 nextNumber already does this (copies use it; paste does the same at selection-ui.ts:142); the room tool should call it.
Check: src/app/kind-tools.ts:343-355

### F-0036 · fixed · S4 · src/app/saved-views.ts:63 — commands of the removed tour and sheets left with no caller
Proof (verify): re-read saved-views.ts:62-91; a search for updateView|moveView over src finds only these two definitions and their i18n labels (690-691, 2779-2780 "Reordenar o tour") and the sheets' labels (1825-1826, 3914-3915). Only tests call them (tests/app/saved-views.test.ts:47-63).
Source: https://en.wikipedia.org/wiki/Dead_code (unused code is hard to find, and tests can make it look used)
What: updateView (63-78) and moveView (80-91, "the tour's order") have no caller in src since the tour was taken out; their labels cmd.updateView/cmd.moveView ("Reorder the tour") and the sheets' cmd.updateViewport/cmd.moveViewport stay in i18n.
Proof: grep updateView|moveView in src: only their definitions (saved-views.ts:63, 81) and i18n.ts:690-691, 1825-1826, 2779-2780, 3914-3915.
Effect: dead code and dead strings; the owner's step 1 asked that the removed areas leave the app (the i18n cleanup missed these).
Fix plan: remove both commands and the four labels in both languages.
Also: the only callers left of updateView and moveView are tests: tests/app/saved-views.test.ts:47-63 ("renamed and captioned", "moved up and down the list: the tour order"); the captions they set were the tour's. Removing the commands goes with these two tests (as step 1 removed the tests of removed code).
Also: elements/drawing/schema.ts:60-61 PAPERS (the printing's paper sizes) has no reader in src (grep PAPERS: only its definition).
Also: comments still point users at removed areas. roof/fields.ts:45 says "its thermal check, Simulations › Thermal", roof/schema.ts:30 says "for the envelope's thermal check (sim/envelope.ts)", room/fields.ts:65 says "a schedule's column too" and 89 "a sheet's interior elevations", render/scene-3d.ts:386-388 keeps code for "the services' pipes and points (mep_…)" staying whole in X-ray (services left the app), and opening/marks.ts:1-4 says "in the schedule".
Check: src/ui/i18n.ts (other removed-area keys)
Also: ui/icons.ts keeps the removed walk and tour's icons `walk`, `play` and `pause` (19, 10, 15), and `menu` and `language` (79-80), which no code draws (grep icon('x') / 'x' outside icons.ts: none).
Also: i18n.ts keeps 'layer.services' ("Services" 1638, "Instalações" 3727), the removed services category's label; no category or code reads it.

### F-0037 · fixed · S3 · src/app/section-drawing.ts:468 — a section's extent spreads every cut point into Math.min/Math.max
Proof (verify): re-read section-drawing.ts:463-469: cutPoints is every endpoint of every cut segment of every solid (wall layers, opening parts and the kinds' meshes, including imported models), and cutBox spreads all of them four times into Math.min and Math.max. With more than 65536 points this throws in JavaScriptCore (Safari and other WebKit browsers); other engines throw at their own limits. An imported model of a few tens of thousands of triangles cut by a section reaches that.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply (more than tens of thousands of arguments: unspecified, JavaScriptCore caps at 65536, most engines throw)
What: cutBox is Math.min(...cutPoints.map(...)) / Math.max(...) over every endpoint of every cut segment; line 448 does the same per opening. Spread passes each element as an argument.
Proof: section-drawing.ts:465-469, 448; MDN Function.apply: argument limits are engine-defined (JavaScriptCore 65536), most engines throw.
Effect: a section through a model with many meshed objects (tens of thousands of cut segments) throws a RangeError and the section/elevation cannot be drawn.
Fix plan: compute the extents with a loop (as `grow` does at 403-406).
Check: other Math.min(...)/Math.max(...) over unbounded lists (grep)

### F-0038 · fixed · S3 · src/app/section-view.ts:28 — the section drawing cache ignores which categories are hidden
Proof (verify): re-read section-view.ts:17-35. modelCache is a WeakMap<Doc, Model> (19), so lookup (25) is by the Doc object's identity only. Hiding a category changes app.ui.hidden, not the Doc: the same object comes back and the model built at 28 with the old hidden set is reused. The drawings (30-34) are keyed by that model and the mark's JSON, so they are stale too.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
What: modelCache is keyed by the Doc alone, but the cached solids leave out app.ui.hidden's categories (and rooms when hidden) as they were at the first draw.
Proof: section-view.ts:19 (WeakMap<Doc, Model>), 25-29 (modelSolids(doc, g, app.ui.hidden) cached by doc), 30-34 (drawings cached by that model).
Effect: hide objects (or rooms) and open the sections dialog again without editing: the section still shows them (or the reverse).
Fix plan: key the model by the doc and the hidden set (e.g. a Map per doc keyed by the sorted hidden list).
Check: src/ui/sections-dialog.ts
Also: confirmed from the caller: sections-dialog.ts:59, 68 call sectionOf/sectionCanvas with the app on every redraw and pass nothing about the hidden categories, so the cache's key is the only thing deciding.

### F-0039 · fixed · S4 · src/app/selection-ui.ts:169 — a doc comment left over another function's
Proof (verify): re-read selection-ui.ts:169-198. Line 169's one-line doc comment ("Every wall of a type…") sits directly above selectSimilar's own doc comment (170-173). selectWallsOfType (192) has no comment. Also re-read evaluate.ts:427-429: pieceOutline's comment sits above boxCorners' own comment, and pieceOutline (513) has none. icons.ts:11's "A map pin" sits above `table`, not `pin` (14). JSDoc attaches a comment to the code right after it, so these comments document the wrong symbols.
Source: https://jsdoc.app/about-getting-started
What: "Every wall of a type on the current level, with the select tool." sits right above selectSimilar's own doc comment; it describes selectWallsOfType at line 192, which has none.
Proof: selection-ui.ts:169-174, 192.
Effect: misleading documentation (editors show the first comment for selectSimilar).
Fix plan: move the line above selectWallsOfType.
Also: elements/object/evaluate.ts:427 "A piece's outline in plan…" sits above boxCorners; it belongs to pieceOutline (513).
Also: tests/app/section-drawing.test.ts:34-36: the doc comment "The cut's extent along the line and up, per closed outline." is followed by a second comment about outlines before `extents`; the first belongs to it, the second describes nothing below.
Also: ui/icons.ts:11 "A map pin: a point of interest." sits above `table`; it belongs to `pin` (14). The header (1) says stroke 2 while icon() draws 1.8 (109).
Also: ui/i18n.ts:4257 "A layer's material: a built-in one in the language of the moment…" sits above markPrefix's own comment; it belongs to materialName (4261).
Also: elements/opening/parts.ts:290 says a shutter is "pushed aside when the window is drawn open", but line 299 draws nothing for an open shutter (tests/elements/opening/screen.test.ts:34 asserts the same part count as no shutter): the comment and the test header (screen.test.ts:2, 28) describe a behaviour that does not exist.
Also: tests/elements/wall/oracle-arc.ts:167-177 has two doc comments in a row above coverage(); editors show only the second (about `notKept`), so the main description of coverage is detached. Merge them into one. The same happens at tests/elements/wall/oracle.ts:112-119 above cornerSpec.
Also: elements/opening/commands.ts:107-112 ("The rule of another kind that leaves the opening where it is now…") sits above wallRule's own comment (113-119); it belongs to ruleKeepingPosition (135). render/scene-3d.ts:263 ("Frosted glass, traced") sits above tracedGround, two lines before tracedFrosted, and 441-444 (the X-ray doc) sits above setPhases' own comment, leaving setXray (468) without one. render/plan-view.ts:74 and 77 are doc comments left without their fields (text notes, grid axes), 256-260 stack two comments over frame(), 558 says "Outside the norms: the warning sign, over the rest" over no code (the norms left the app), and 770 ("A grid axis: a dash-dot line…") sits above font(). elements/wall/geometry/shape.ts:25-26 stacks two doc comments for exteriorOffset; the first, shorter one is left over. elements/opening/style.ts:93 (PANED's doc comment) sits above `swings` (95), whose own comment follows it; PANED (97) is left without one. The file header (1-4) says losing a member "spreads the others out again", but settleGroups (32-55, comment 36-37) dissolves the broken group and holds every member where it was.
Check: none

### F-0040 · fixed · S3 · src/app/opening-ui.ts:158 — in an exploded 3D view a door or window cannot be aimed at an upper level's wall
Proof (verify): re-read opening-ui.ts:139-162. The height at 154 is taken from the ray and compared at 157-158 with wallHeights, which are document elevations, with no lift. scene-3d.ts:1488-1496 rayAt is setFromCamera's ray, built from the NDC point and the camera alone, only remapped in its axes. input.ts:480 passes it unchanged. app.ts:397-400 lift() shows the lift exists for 3D, and view-3d.ts:64 liftOf is non-zero when exploding; wallUnderRay never receives it.
Source: https://threejs.org/docs/pages/Raycaster.html
What: wallUnderRay compares the scene ray's height with wallHeights (document elevations), but the scene draws each level lifted by liftOf (index × 2.5 m) when exploding.
Proof: opening-ui.ts:154-158 (height from the ray vs wallHeights bottom/top); view-3d.ts:63-68 (liftOf); input.ts:480 passes the scene ray (app.scene.rayAt) and only the current level.
Effect: with Explode on and an upper level current, the ray meets the wall's plane at a height 2.5 m × k above its document band, so the aim falls back to the mesh path (aimAt3d) and flickers through the preview's hole, the problem wallUnderRay was written to stop.
Fix plan: pass the level's lift and compare height − lift (or subtract it from the ray's origin z).
Check: src/render/scene-3d.ts (rayAt coordinates), src/app/input.ts:470-483
Also: render/scene-3d.ts:1487-1496 rayAt returns the camera ray in world plan coordinates (z = three.js y), with no level lift. The lift is applied to the meshes' groups (sync's place(), 1189-1192), so a ray compared with document heights misses lifted levels.

### F-0041 · fixed · S4 · src/app/view-ui.ts:181 — comments still describe the terrain and the lot taken out of the app
Proof (verify): re-read view-ui.ts:178-184. The comment explains the early return at 184 by "the terrain" and "the whole lot", and both were removed in step 1. A case-insensitive grep over src for comments naming terrain, the lot, sheets, tour, MEP, walk mode or budget matches 36 lines in 18 files. Some are legitimate, such as project-file.ts migrations of kept fields; each needs reading in fix.
Source: https://en.wikipedia.org/wiki/Comment_(computer_programming)
What: "(the terrain, a long wall seen up close)… a click on the terrain zoomed the plan out to the whole lot" explains the code by elements that no longer exist (terrain/lot left in step 1).
Proof: view-ui.ts:181-183; the terrain and lot modules are gone (tag escopo-completo-2026-10-28).
Effect: misleading comments; the same kind as F-0015 (geometry.ts lot-areas).
Fix plan: reword with an element that exists (a long wall); collect the other comments naming removed areas (grep terrain|lot|sheet|tour|walk|MEP in comments).
Check: grep over src for the removed areas' names in comments

### F-0042 · fixed · S3 · src/app/wall-ui.ts:287 — a selected opening's distance means one thing typed in the footer and another in its temporary dimension
Proof (verify): the same typed length means a different distance in each place.
- wall-ui.ts:282-288 (the footer): the value goes straight into rule.distance, measured from the host wall's reference end.
- temp-dims.ts:64-86 (the temporary dimension): it shows o.start − stopBefore and stores before + v, measured from the face of the meeting wall.
- opening-tool.ts:135-146 (while placing): it adds ruleBase only when the preview rule has a distance; otherwise the distance is bare from the reference end (143-145).
So a door showing 0,40 to a meeting wall ends up somewhere else when 0,40 is typed in the footer. This breaks the principle of least astonishment.
Source: https://en.wikipedia.org/wiki/Principle_of_least_astonishment
What: with one opening selected, a length typed in the footer becomes its rule's stored distance (from the host wall's end); its temporary dimension shows and takes the gap from the face of the neighbouring wall (stop + typed, temp-dims.ts:76, 85); while placing, the opening tool adds the stop too (opening-tool.ts:141).
Proof: wall-ui.ts:284-288 (distance: r.value.length); temp-dims.ts:65-86 (distance: before + v); tools/opening-tool.ts:141 (ruleBase + d).
Effect: a door shown "0,40" from the wall beside it; typing 0,40 in the footer moves it to 0,40 from the far end of the host wall.
Fix plan: one meaning for a typed distance (explicit position from the host's end, as the goal's fix for root cause 2 asks) in all three places, shown the same way.
Check: src/tools/opening-tool.ts, src/app/chrome.ts:200 (ruleText)
Fix: src/app/wall-ui.ts:20, 283-301 (a selected opening's typed value now goes through its temporary dimension on the side its rule measures from, tempDims(…).apply(value): the gap from the neighbouring wall's face, or from the opening it is measured from, as the dimension shows it and as the tool adds it while placing (opening-tool.ts ruleBase, chrome.ts:233 shows ruleText with the same base). The stored rule is still a station from the host's end; what is typed and shown is the gap in all three places. An arc host has no temporary dimension: the distance along it from its reference end, as before.
Fix source: https://www.nngroup.com/articles/consistency-and-standards/ (internal consistency: the same thing means the same throughout the product)
Verified by: re-read src/app/wall-ui.ts:17-21, re-read src/app/wall-ui.ts:272-313, re-read src/app/temp-dims.ts:1-40, re-read src/app/temp-dims.ts:55-104 (the dims' ids fromStart/fromEnd/fromOpening and their apply); npx tsc --noEmit passes
Also: opening-tool.ts:135-146 has a fourth meaning: typed while the preview is centred, the distance is from the host's reference end (fromStart/fromEnd with no stop base, 143-145), while typed after a start/end preview it is the gap past the meeting wall's face (141). The same "0,10" lands 10 cm from the wall's face or 10 cm from its axis end (inside the meeting wall) depending on where the pointer was.
Also: tests/app/opening-keyboard.test.ts:22-25 asserts the centred-preview case on a lone wall (typed 1 → fromStart 1); a fix that unifies the meaning must keep it right there (no stop) and extend the test with a meeting wall.

### F-0043 · fixed · S3 · src/core/id.ts:3 — new ids need a secure context and keep only 32 random bits
Proof (verify): re-read id.ts:1-3. newId keeps randomUUID().slice(0, 8), the first group of a v4 UUID. That group sits before the version and variant digits, so it is 32 fully random bits. MDN says randomUUID is available only in secure contexts, and that getRandomValues is the only Crypto member usable from an insecure context. By the birthday bound, n²/(2·2³²) at n = 9,000 is about 0.94 %.
Source: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID
Source: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
What: newId calls crypto.randomUUID(), available only in secure contexts, and keeps its first 8 hex digits.
Proof: id.ts:3; MDN Crypto.randomUUID: "available only in secure contexts (HTTPS)"; a v4 UUID's first group is 32 random bits.
Effect: (1) opened over plain http from another device (a phone on the LAN with `vite --host`), randomUUID is undefined and drawing any wall, door or object throws; (2) about 1 % chance of a repeated id among ~9,000 ids of one kind (copies and series), which merges two elements under one id.
Fix plan: fall back to crypto.getRandomValues (available outside secure contexts) and keep more bits (e.g. 12-16 hex digits).
Check: io/project-file.ts (duplicate ids on reading)

### F-0044 · fixed · S4 · src/core/measure.ts:129 — "×" after a variable is read as part of its name; "÷" and "−" are promised but not parsed
Proof (verify): re-read measure.ts:1-23 and 100-152.
- "pd×2": the name regex at 129 matches all of "pd×2", because × is U+00D7, inside À (U+00C0) to ÿ (U+00FF). That is not a variable, so the number regex at 134 fails and factor returns null.
- The operators: term (104) knows only * / x ×, and the unary minus in factor (116) knows only "-". So "÷" and the true minus "−", both promised in the header (2), are rejected.
Source: https://en.wikipedia.org/wiki/Latin-1_Supplement
What: the name pattern [A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]* covers U+00C0–U+00FF, which includes × (U+00D7) and ÷ (U+00F7); the header promises "+ − × ÷" but the parser knows only "-", "/", "*", "x", "×".
Proof: measure.ts:1-2 (header), 23 and 129 (name ranges), 91 and 104 (operators); Wikipedia Latin-1 Supplement: × D7, ÷ F7 inside À–ÿ.
Effect: with a variable pd, "pd×2" is rejected while "pd*2" and "2×pd" work; "3÷2" and "3−1" (true minus, as the app writes negatives in level marks) are rejected.
Fix plan: exclude × and ÷ from the name ranges; accept "÷" as "/" and "−" as "-" (or correct the header).
Also: elements/object/formula.ts:217 has the same name pattern, so an object formula "largura×2" fails as an unknown name though the header (3) promises ×.
Also: elements/object/valid.ts:50 accepts parameter names matching /^[A-Za-z_À-ÿ][\wÀ-ÿ]*$/, so a definition file may name a parameter "a×b" or "÷"; the range is by code point (MDN Character_class), × and ÷ included.
Check: src/ui/units.ts (typingExamples)

### F-0045 · fixed · S4 · src/app/stacked.ts:23 — the in-line angle written again instead of taken from the single source
Proof (verify): re-read tolerance.ts:1-6 ("Single source of every geometric tolerance"; COLLINEAR_ANGLE = 0.6) and stacked.ts:6, 22-23. stacked.ts imports POINT_TOLERANCE from tolerance.ts but writes 0.6 again as a literal, with a comment calling it "the engine's in line". The same fact is kept in two places.
Source: https://en.wikipedia.org/wiki/Single_source_of_truth
What: tolerance.ts says it is the single source of every geometric tolerance (changes need an ADR), but stacked.ts sets PARALLEL = sin(0.6°) with its own literal ("the engine's in line") instead of COLLINEAR_ANGLE.
Proof: tolerance.ts:1, 6; stacked.ts:22-23.
Effect: changing COLLINEAR_ANGLE (per its ADR) leaves the stacked-walls check on the old angle: two answers to "are these walls in line".
Fix plan: derive PARALLEL from COLLINEAR_ANGLE.
Check: other literal copies of tolerance values (grep 0.6, 1e-3)
Fix: src/app/stacked.ts:6 (COLLINEAR_ANGLE imported), 22-23 (PARALLEL = sin(COLLINEAR_ANGLE · π/180)). A grep of src for 0.6 as an angle finds no other copy (the rest are object sizes, a light's intensity, a canvas arc, text offsets).
Fix source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sin (Math.sin takes radians: the degrees of COLLINEAR_ANGLE are turned with π/180 as before)
Verified by: re-read src/app/stacked.ts:1-27; npx tsc --noEmit passes

### F-0046 · fixed · S4 · src/elements/column/fields.ts:19 — the column's top-level choices come from the first selected column only
Proof (verify): re-read column/fields.ts:15-45. `own` is columns[0]'s level, and `above` lists the levels over it; set applies the choice to all ids. commands.ts:24-43 does not check topLevelId against each column's level. kinds/column.ts:48-50 then takes the top from that level's elevation and clamps it to bottom + 0.01, so an upper-floor column given a lower level becomes a 1 cm stub without a word. This is an error-prone condition the UI offers instead of eliminating.
Source: https://www.nngroup.com/articles/ten-usability-heuristics/
What: `above` lists the levels above columns[0]'s level; the choice is then applied to every selected column (updateColumns(ids, …)).
Proof: column/fields.ts:19-20, 42, 44; column/commands.ts:36 (no check of the level against each column's own).
Effect: select a ground-floor column and a first-floor column, pick "up to level 1": the first-floor column's top is set to its own floor (or below).
Fix plan: offer only levels above every selected column's level (or hide the field for mixed levels); reject in the command a top level not above the column's own.
Check: src/elements/kinds/column.ts (derivation of such a column)

### F-0047 · fixed · S3 · src/elements/contract.ts:43 — the DXF and GLB export code is still in the contract and in all 20 kinds
Proof (verify): re-read contract.ts:43-54 (DxfOut). A grep for `.dxf`, `.dxfLayers`, `.exportName` and `.exportColour` member reads over src finds only reference-ui.ts's ".dxf" file-name tests, which are a different thing (DXF import, kept). A grep for the names outside elements/kinds finds only contract.ts. The members are defined 62 times across the 20 kind files and read by nothing: dead code left from the removed exports.
Source: https://en.wikipedia.org/wiki/Dead_code
What: the exports were taken out in step 1 (boundary decision: IFC/DXF/OBJ/GLB/image export LEAVE), but the contract keeps DxfOut, dxfLayers, dxf, exportName and exportColour (the last two required), and every kind still implements them.
Proof: contract.ts:43-54, 141-145, 197-199; grep over src for `.dxf(`, `.dxfLayers`, `.exportName`, `.exportColour`: no reader; the same names appear in 20 files of elements/kinds/.
Effect: dead code across every kind (and their i18n keys), against the owner's order that the removed areas' code leave the app; every new kind must still write export code nobody runs.
Fix plan: remove the members from the contract and from each kind (and the i18n keys only they used).
Check: src/elements/kinds/*.ts, src/ui/i18n.ts
Also: elements/opening/style.ts:171-212 ifcOperation (IFC door/window operation names) is read by nothing in src/ or tests/. render/scene-3d.ts:1116-1180 snapshot() (the saved picture of the 3D view, image export) has no caller in src (grep `.snapshot(`), nor has TRACE's `picture` sample count (57-62) outside it. Comments still name the GLB and exports at opening/parts.ts:1, opening/fields.ts:474, object/schema.ts:55, style.ts:3 and render/prisms.ts:1-2 ("for the export (export-gltf.ts)").
Also: tests/elements/measure.test.ts:83-86 still asserts measureDxfText (kinds/measure.ts:37, read only by the kind's dead dxf at 144); remove those asserts with the function.

### F-0048 · fixed · S4 · src/elements/curtain/fields.ts:49 — curtain fields apply the first selected curtain's mode and spacing to all
Proof (verify): re-read curtain/fields.ts:17-63.
- The spacing field (41-50) is shown when no selected curtain counts, so a mix of spacing and max is allowed. Its set (49) still writes items[0]'s mode onto every id.
- The mode select (30-38) computes one rule from items[0]'s size and line count and applies it to every id.
A value typed for several curtains thus silently changes the others' mode, an unprevented error.
Source: https://www.nngroup.com/articles/ten-usability-heuristics/
What: the spacing field (shown when none counts) sets { mode: items[0].mode, value } on every selected curtain; the mode select converts using items[0]'s length and line count only.
Proof: curtain/fields.ts:33-37, 49 (items[0]!).
Effect: two curtains selected, one "spacing" and one "max": typing a spacing turns both into the first one's mode; switching to "count" gives both the first one's panel count.
Fix plan: keep each curtain's own mode when setting a value; convert per curtain when switching modes.
Check: other kinds' fields using items[0] (grep "items\[0\]!")

### F-0049 · fixed · S2 · src/elements/curtain/schema.ts:63 — a curtain wall's grid has no limit: a large count or tiny spacing freezes the app
Proof (verify): re-read curtain/schema.ts:47-65.
- isGridRule only asks for a finite value > 0, and the count field has min 1 with no max (fields.ts:58-61). So count makes round(value) + 1 lines with no bound (63-64).
- Spacing is worse: the loop at 59 adds rule.value to x. x stops growing once value is under half the spacing of doubles at x (MDN: absolute accuracy falls as numbers grow). With a spacing of 1e-20 that happens near x ≈ 1e-20 · 2⁵³ ≈ 9e-5 m, far below any wall's length, and from then on x + value === x. The loop then never ends and the page hangs for good. It is not only slow.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON
What: gridLines makes round(value) parts for a count and loops by value for a spacing, with no bound; isGridRule accepts any finite value > 0; the panel-count field has min 1 and no max; geometry.ts then builds a box per cell (vertical × horizontal parts).
Proof: curtain/schema.ts:47-51, 54-64; curtain/fields.ts:58-61 (min 1, no max); curtain/geometry.ts:54-66 (boxes per cell).
Effect: typing 100000 panels (or opening a file with a spacing of 0.000001) blocks the page while it builds millions of boxes, then the 3D and plan redraw them on every frame.
Fix plan: cap the lines per direction (e.g. by a minimum cell size of a few cm, and a maximum count) in gridLines and in the guard; give the field a max.
Check: src/elements/kinds/curtain.ts (valid)

### F-0050 · fixed · S3 · src/elements/dimension/constraints.ts:67 — a locked dimension pulling a door replaces its centred, aligned or grouped rule
Proof (verify): re-read constraints.ts:58-78. At 67 a centered, aligned or inGroup rule is replaced by ruleKeepingPosition(…, 'fromStart'), which is { fromStart, distance: me.start } (opening/commands.ts:141-142). Its distance is then shifted (69-78) and written into the doc, with no message.
settleGroups (commands.ts:32-55) is private and is called only by commands.ts's own commands (71, 103). So the rewritten member stays listed in its group until a later opening command breaks the group. That command turns every member into fromStart (47-53).
The user's chosen rule is lost silently: high astonishment.
Source: https://en.wikipedia.org/wiki/Principle_of_least_astonishment
What: to slide an opening held by a locked or EQ dimension, shiftEnd turns a centered/aligned/inGroup rule into fromStart (ruleKeepingPosition) and then changes its distance; the user is not told and the group/alignment is lost.
Proof: constraints.ts:66-78.
Effect: a centred window measured by a locked dimension stops being centred after a wall moves; a distributed door leaves its group (the group's other members keep spreading over a stretch without it).
Fix plan: refuse (say why) instead of rewriting a rule the user chose, or keep the rule and move what it is measured from.
Check: src/elements/opening/commands.ts (ruleKeepingPosition), groups
Fix: src/elements/dimension/constraints.ts:12 (ruleKeepingPosition no longer imported), 65-68 (an opening with a centred, aligned or grouped rule returns null from shiftEnd: settleDimensions refuses the change, and app.ts's wrapper says so with dim.refusedLocked / dim.refusedEqual; the rule is never replaced, so no group is left half-dissolved).
Fix source: https://help.autodesk.com/cloudhelp/2014/ENU/Revit-LT/files/GUID-BD91C1BE-4FBC-41F0-AC82-5C60A545EAC6.htm (a locked dimension's value is fixed, preventing any change to the distance; to change it, the user unlocks it)
Verified by: re-read src/elements/dimension/constraints.ts:1-80; npx tsc --noEmit passes; tests/elements/dimension-constraints.test.ts uses fromStart openings only (grep), no test relied on the conversion
Also: opening/commands.ts:135-146 — ruleKeepingPosition(…, 'fromStart') returns { fromStart, distance } at the current place. The group is settled only by settleGroups (32-55), which is private to commands.ts and runs inside its own commands. A member rewritten by constraints.ts stays in its group's `members` list with a non-inGroup rule until some opening command runs settleGroups; that command then dissolves the whole group.

### F-0051 · fixed · S3 · src/elements/grid/carry.ts:19 — dragging a grid axis drags every wall and column on its line, a link nobody made
Proof (verify): re-read grid/carry.ts:1-28. onLine (10-16) tests the axis's infinite line within 1 mm. wallsOnGrids takes every wall onGrid plus every kind on that line, with no level filter. It is called by select-drag.ts:169-170 (drag), tools/nudge.ts:30 (arrows) and tools/transform.ts:156 (Modify move, not copy), so every way of moving an axis carries them. No element stores or shows the link. In Revit "Moves With Grids" is an instance property of the column that the user sets on the Properties palette ("Columns move when grid lines are moved").
Source: https://help.autodesk.com/cloudhelp/2015/ENU/Revit-Model/files/GUID-E8F03F7F-8886-4F92-B821-D2C500CEB64F.htm
What: wallsOnGrids takes every wall on the axis and every element whose point is within 1 mm of the axis's infinite line, on every level; select-drag moves them with the axis. Nothing records or shows the link, and it cannot be turned off.
Proof: grid/carry.ts:10-16 (infinite line), 19-28; select-drag.ts:169-170. Revit makes it a visible per-column constraint ("Moves With Grids").
Effect: moving an axis to correct its position moves walls that only happened to be drawn on it, even past the axis's ends and on other levels; the same kind of hidden link as root cause 2.
Fix plan: carry only elements the user tied to the axis (a stored, shown flag, as Revit's), or ask; at least limit to the axis's extent.
Check: src/elements/grid/schema.ts (onGrid), tools/transform.ts
Fix: src/app/select-drag.ts:162-172 (the drag moves the selected walls and the selection's kinds only), src/tools/nudge.ts:28-29 (arrows: the selection only), src/tools/transform.ts:155-156 (Modify: the selection only); the three imports of wallsOnGrids removed. An axis now moves alone; nothing lying on its line is tied to it. A stored, shown "moves with grids" flag as Revit's would be a new feature (not done). Left to delete when shell commands are allowed again (after apptest): src/elements/grid/carry.ts, now imported by nothing, with what only it used (registry.ts kindsOnLine, the kinds' onGrid members and contract.ts onGrid, grid/schema.ts onGrid): the hooks let no file be removed now.
Fix source: https://help.autodesk.com/cloudhelp/2015/ENU/Revit-Model/files/GUID-E8F03F7F-8886-4F92-B821-D2C500CEB64F.htm ("Moves With Grids" is an instance property the user sees and sets on the Properties palette: never a hidden carry)
Verified by: re-read src/app/select-drag.ts:20-31, re-read src/app/select-drag.ts:160-177, re-read src/tools/nudge.ts:1-32, re-read src/tools/transform.ts:1-20, re-read src/tools/transform.ts:143-222; npx tsc --noEmit passes; no test covers the carry (grep of tests for wallsOnGrids, onGrid, kindsOnLine)

### F-0052 · fixed · S3 · src/elements/kinds/object.ts:190 — the edges of a cut object piece are found in quadratic time
Proof (verify): re-read object.ts:157-215. For each triangle (178) and each of its 3 edges (184), verts.forEach (190) tests every welded vertex. That is 3·(T) × V work, O(n²) in the mesh size. It runs for every cut geometry: in scene-3d.ts:1447, each time the 3D builds the piece's edges, and in definition-editor.ts:579.
Source: https://en.wikipedia.org/wiki/Time_complexity
What: creaseEdges splits every triangle edge at the welded vertices lying on it by testing every vertex of the geometry for every edge (verts.forEach inside the edge loop).
Proof: kinds/object.ts:178-205 (3 edges per triangle × all vertices).
Effect: a piece cut by a void (a sink in a counter, a hole in a panel) with a curved or imported mesh of a few thousand vertices makes millions of tests per derivation; with 10,000 vertices about 3·10⁸, freezing the 3D whenever the object is derived again.
Fix plan: find vertices on an edge through a spatial index (a grid or the project's RTree on edge boxes) instead of every vertex.
Check: render/scene-3d.ts (when creaseEdges runs), elements/object/evaluate.ts

### F-0053 · fixed · S3 · src/elements/kinds/railing.ts:99 — a guardrail held by a stair or a floor, moved alone, jumps to the points it was created with
Proof (verify): re-read railing.ts:55-106. A hosted railing's shown path is recomputed from its host on every derive: the floor outline (61-66), the stair side (77-86) or the well (87-89). r.points is only a fallback. moved (99-102) and mapped (103-106) drop the host and move r.points. A grep of src finds no code that updates a railing's points when its stair or floor changes (only addRailing/addRailings write railings). So after the host changes, the railing moved alone leaves the path it showed. In Revit a railing's path is its own sketch, and the host only adjusts it.
Source: https://help.autodesk.com/cloudhelp/2025/ENU/RevitLT-ArchDes/files/GUID-BD09E46E-2A8C-4C40-A809-64BFF366B6BA.htm
What: a hosted railing's shown path is derived from its stair or floor every time (56-89), but moved/mapped drop the host and move r.points, the points stored when it was made.
Proof: kinds/railing.ts:61-89 (path from the host), 99-106 (r.points moved, host dropped).
Effect: draw a stair, let it make its guardrail, change the stair (turn, width) and drag the guardrail a little: it lands on the old path, away from the stair, and no longer follows it.
Fix plan: when letting go of the host, take the derived path (the solid's points) as the new points (the registry's moved receives the element only: give it the derived points or move it through transformed).
Check: elements/registry.ts (moveKinds), the stair's guardrail creation

### F-0054 · fixed · S4 · src/elements/kinds/reference.ts:13 — every reference picture ever shown stays in memory for the session
Proof (verify): re-read reference.ts:12-30. `pictures` is a module-level Map from the data URL string to its Image. picture() only gets and sets it, and a grep of src for `pictures.` in this file finds only lines 22 and 27, with no delete or clear. MDN: such data structures hold their contents strongly, so nothing is ever collected. WeakMap keys can be collected, but a string cannot be a WeakMap key.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management
What: a module-level Map keyed by the picture's whole data URL holds its Image; nothing removes entries when a reference is deleted, replaced, undone away or another project is opened.
Proof: kinds/reference.ts:13, 20-30 (set, never delete).
Effect: importing and deleting a few large scanned plans (tens of MB as data URLs) keeps both the strings and the decoded bitmaps alive; long sessions grow memory.
Fix plan: keep the cache in a WeakMap keyed by the reference's source object (immutable docs), or prune entries no reference uses on each frame.
Check: none

### F-0055 · fixed · S4 · src/elements/kinds/section.ts:170 — a section or elevation named with more than 3 characters shows only its first letter
Proof (verify):
- The label: section.ts:170 cuts any name over 3 characters to its first letter, although 171-176 already narrow a wide label to fit. kind-tools.ts:354 names interior elevations `${room.number}-${sideShort}`, so a room numbered 10 or more makes "12-N" (4 characters), shown as "1".
- The next name: schema.ts:62 at i = 702 gives fromCharCode(65 + 27 − 1) = fromCharCode(91) = "[" (MDN: UTF-16 code units, no validity checks).
- The language: kind-tools.ts:326 stores the elevations round the model under the translated side name.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/fromCharCode
What: the bubble's label is m.name when it has up to 3 characters, else its first letter upper-cased; the text is then narrowed to fit anyway (172-176).
Proof: kinds/section.ts:170; kind-tools.ts:354 names interior elevations "<room number>-<side>" ("12-N"), and addElevations names them by the translated side ("Norte").
Effect: the interior elevations of rooms 10 and up all show "1"; "Norte"/"Sul"/"Leste"/"Oeste" show N, S, L, O (fine), but any user name like "AA'" + more letters loses its meaning.
Fix plan: drop the first-letter cut and rely on the fit-to-bubble scaling (already there), or widen the bubble.
Check: src/elements/section/schema.ts (names)
Also: section/schema.ts:58-65 nextSectionName has no case past two letters. Index 702 gives fromCharCode(91) = "[", so names after "ZZ" read "[A". The elevations round the model are stored under the translated side name (kind-tools.ts:326), and "already made" is tested by that name (327). After switching the interface language, "make elevations" adds four more (North… beside Norte…).

### F-0056 · fixed · S4 · src/elements/kinds/zone.ts:50 — a zone whose rooms are all gone stays in the project, invisible and impossible to select
Proof (verify): re-read zone.ts:27-61. derive returns null when no listed room is enclosed (48-50). The kind declares no `holders`, and registry.ts:168-183 (goesWith, dropKinds) deletes an element only when its id or a holder is deleted. A grep of src for doc.zones / zones: finds only addZone and updateZones (zone/commands.ts:12, 24), actions.ts:136 and document.ts. Nothing drops a deleted room's id from a zone. The zone keeps references to rooms that no longer exist, a broken referential integrity, and with no solid it can be neither picked nor deleted.
Source: https://en.wikipedia.org/wiki/Referential_integrity
What: derive returns null when none of the zone's rooms is enclosed or present; the zone kind declares no holders, so deleting its rooms does not delete it.
Proof: kinds/zone.ts:48-53 (null), 27-61 (no holders); opening/commands.ts deleteElements has no zone handling (grep "zones": none).
Effect: delete the rooms of a zone (or open walls so they are no longer enclosed): the zone vanishes from the plan and the panel but stays in the file; it comes back if a room is redrawn with the same id only by undo.
Fix plan: declare holders as its rooms (deleted with the last one), or drop missing room ids on delete; check registry deletion first.
Check: src/elements/registry.ts, src/elements/zone/commands.ts
Also: registry.ts:167-186 confirms it. dropKinds removes an element when its own id or ANY of its holders is deleted (goesWith uses `.some`), and the zone kind declares no holders. Declaring the rooms as holders would delete the zone with its first room, not its last. The fix needs either a `released` that drops the missing room ids and removes the zone when none is left, or an "all holders gone" rule.
Also: zone/commands.ts:7-33 has only addZone (which drops zones it empties itself) and updateZones. No command removes deleted rooms from zones, and updateZones stores the name untrimmed (it only refuses a blank one). zone/schema.ts:3 promises "a room deleted leaves it", but no code does that.

### F-0057 · fixed · S2 · src/elements/level/commands.ts:59 — deleting a level leaves its floors, rooms, objects and other elements orphaned and invisible
Proof (verify): re-read level/commands.ts:37-68. deleteBlocker refuses only a missing level, the last level, or one with walls (41). deleteLevel then returns only new `levels` and `walls` (66): every other list keeps elements whose levelId no longer exists. The only caller, levels-dialog.ts:61-65, dispatches it, moves the current level when needed and refreshes. It does no cleanup and shows no count. These are references to a deleted key. A database would either cascade the delete or refuse it; this code does neither.
Source: https://en.wikipedia.org/wiki/Referential_integrity
What: deleteLevel is blocked only when walls stand on the level; it removes the level and re-tops walls that reached it, but every other element with that levelId stays in the document.
Proof: level/commands.ts:38-42 (blockers: missing, last, walls), 56-67 (only levels and walls changed); every kind keeps a levelId (contract.ts, kinds/*.ts) and the views show the current level's elements only.
Effect: a level with a slab, furniture and notes but no walls is deleted: none of them is shown anywhere again, they cannot be selected or removed, the file keeps them; columns topped at that level silently fall back to their own top.
Fix plan: delete the level's elements with it in the same step (after saying how many), or block on any element, as walls do; re-point topLevelId references.
Check: the levels dialog (message), elements/registry.ts (a list of kinds by level)

### F-0058 · fixed · S3 · src/elements/material/commands.ts:45 — a material a roof is covered with counts as unused and can be deleted
Proof (verify): re-read material/commands.ts:40-61. materialUses sums wall type layers, floor layers, room finishes and definitions, and nothing else. roof/schema.ts:34-41 stores covering.materialId (default 'clayTile'), and presets.ts:48-52 name clayTile, graniteBlack, metal and concrete. So materialDeleteBlocker returns null for a material only roofs use, and deleteMaterial removes it, leaving references with no row. That breaks referential integrity: the delete should have been refused.
Source: https://en.wikipedia.org/wiki/Referential_integrity
What: materialUses counts wall type layers, floor layers, room finishes and object definitions only; roofs store covering.materialId (roof/schema.ts) and presets name materials (presets.ts), neither counted.
Proof: material/commands.ts:45-49; grep materialId in src/elements: roof/schema.ts, roof/commands.ts, roof/fields.ts, presets.ts also hold material ids.
Effect: the materials dialog offers to delete the roof's tile material; after deleting, the roof is drawn in another material (materialIn's fallback) and its covering field points at nothing.
Fix plan: count roofs' coverings (and presets) in materialUses.
Check: src/elements/material/schema.ts (materialIn), src/elements/presets.ts
Also: presets.ts:48-52 name clayTile, graniteBlack, metal and concrete as roof coverings. A deleted material makes the preset (and every roof placed from it) cover with a missing id.

### F-0059 · fixed · S3 · src/elements/note/fields.ts:17 — a note cannot be given several lines, and editing a multi-line note loses its breaks
Proof (verify): re-read note/fields.ts:15-17 (a 'text' field) and ui/fields.ts:229-248. textField is an `<input type="text">`, and Enter blurs it (240), so a line break cannot be typed. Setting input.value (233) runs the HTML value sanitization for the Text state, "Strip newlines from the value". So a note with \n shows joined, and committing an edit stores it without the breaks (236). kinds/note.ts:93 and 118 split the text on '\n', so breaks are meaningful in the model.
Source: https://html.spec.whatwg.org/multipage/input.html
Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/text
What: the note's text field is a 'text' field, built by ui/fields.ts as a one-line input (no textarea there); the plan draws notes line by line (kinds/note.ts:93-96), so line breaks are part of the model.
Proof: note/fields.ts:17; grep "textarea" in src/ui/fields.ts: none; MDN input type=text is single-line and its value sanitization strips line breaks.
Effect: a two-line label ("Sala\nde estar") cannot be typed; a note with line breaks from a file becomes one line as soon as its text is edited in the panel.
Fix plan: a multi-line control (textarea) for note text, Enter for a new line, the change on blur.
Check: src/ui/fields.ts (text control), src/app/kind-tools.ts:83 (focus of the first text input)
Also: confirmed in ui/fields.ts: textField (229-248) is the only text control, an `<input type="text">`, used for every 'text' field kind (215); Enter blurs it, so no line break can be typed.

### F-0060 · fixed · S3 · src/elements/object/evaluate.ts:67 — an object's pieces have no overall limit: repeated parts nesting repeated objects multiply
Proof (verify): re-read evaluate.ts:67-68, 218-224 and 342-368. Each part is capped at MAX_REPEAT (500) copies (222). A nested part calls evaluateIn at depth + 1 (363) and appends all its pieces (364). Nesting stops only at MAX_DEPTH (348). No count is kept across the whole evaluation, so the pieces multiply by up to 500 per nesting level. This is the expansion pattern of the billion laughs attack, whose mitigation is a cap on the total expansion.
Source: https://en.wikipedia.org/wiki/Billion_laughs_attack
What: each part may repeat up to MAX_REPEAT (500) and nest a definition up to MAX_DEPTH (4) levels; nothing caps the product, so pieces can reach 500 per level multiplied over levels.
Proof: evaluate.ts:67-68, 222 (per-part cap), 342-367 (nested evaluation adds all its pieces); evaluateObject may evaluate several more times (174, 180-191).
Effect: a library definition (from a file or a library link) with a shelf of 100 boxes of 100 items each, or a mistyped count formula, makes 10⁴–10⁸ pieces: the page hangs on placing or opening it; the CSG and merge steps (kinds/object.ts) multiply the cost.
Fix plan: a total piece budget across the whole evaluation (stop and say so when passed).
Check: src/elements/object/valid.ts (limits when reading definitions)

### F-0061 · fixed · S4 · src/elements/object/library-office.ts:180 — the meeting table's "3.60 m, 10 chairs" type makes 8 chairs
Proof (verify): re-read library-office.ts:163, 174-175 and 179-180. porLado = max(1, floor((largura − 0.3)/0.7)). At 3.6, (3.3)/0.7 = 4.714…, and floor gives 4. That is two rows of 4 chairs, so 8, but the type's name says 10. At 2.4: floor(2.1/0.7) = floor(3.0) = 3 a side, which gives 6, matching its name but not its id 'eight'.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor
What: porLado = max(1, floor((largura - 0.3) / 0.7)); at 3.60 m that is floor(4.71) = 4 a side, 8 chairs, while the type's name says 10. The default type's id 'eight' names 6 chairs (floor(3.0) = 3 a side, which is right).
Proof: library-office.ts:163 (count formula), 174-175 (two rows of porLado chairs), 179-180 (type names).
Effect: the library promises 10 chairs and places 8; the user picks the wrong type for the room.
Fix plan: name the type after what the formula gives ("8 chairs"), or set the length that gives 10 (≥ 3.80 m: floor(3.5/0.7) = 5).
Check: none

### F-0062 · fixed · S4 · src/elements/object/library-outdoor.ts:237 — a fire pit lower than 12 cm has its floor, embers and logs under the ground
Proof (verify): re-read library-outdoor.ts:235-246. altura has a minimum of 0.1 (237). The lathe profile's floor points are at altura − 0.12 (243). The embers are at z = altura − 0.12 (244) and the logs at altura − 0.1 (245). At altura = 0.1 the profile reaches y = −0.02, below its own base at 0, so the cup's inside drops under the ground. The lathe turns this profile about its up axis exactly as given.
Source: https://threejs.org/docs/pages/LatheGeometry.html
What: the rim height may go down to 0.10 m (line 237), but the cup's floor, the embers and the logs sit at `altura - 0.12` / `altura - 0.1` (243-245): at 0.10 m the floor is at −0.02 m, below the object's base and the slab.
Proof: library-outdoor.ts:237 (min 0.1), 243 (profile points [largura/2 - 0.12, altura - 0.12], [0, altura - 0.12]), 244 (embers z), 245 (logs z).
Effect: a low fire pit pokes through the floor in 3D and in sections; its lathe profile folds below its own base.
Fix plan: raise the minimum rim height to 0.15 m, or make the floor depth min(0.12, altura - 0.03).
Check: none

### F-0063 · fixed · S4 · src/elements/object/library-outdoor.ts:139 — the kettle barbecue shows a width handle that changes nothing
Proof (verify): re-read library-outdoor.ts:104-145. All of the kettle's parts (133-137, when 'modelo == 1') use constants only: none reads largura, profundidade or altura. The single handle (139) drags largura. The params at 111-113 carry no `when`. schema.ts:41 allows a `when` on a ParamDef, and HandleDef (94-103) has none. So on the kettle the handle and the three size fields change nothing visible: feedback that never comes.
Source: https://www.nngroup.com/articles/ten-usability-heuristics/
What: the barbecue's only handle drags `largura` (139), but the kettle model (modelo == 1, 133-137) has fixed sizes and no formula uses largura; width, depth and height fields show for it too.
Proof: library-outdoor.ts:110-115 (params for both models), 133-137 (kettle parts in constants), 139 (handle).
Effect: on the kettle the user drags a handle or types a width and nothing happens: a control that lies.
Fix plan: the kettle as its own definition (or its parts sized from largura), and the handle and sizes only where they act.
Check: src/elements/object/schema.ts (whether a handle or param can carry a `when`)
Also: schema.ts:41 lets a ParamDef carry `when` (shown only when true), so the kettle's sizes can be hidden by data; HandleDef (94-103) has no `when`, so its handle cannot be hidden without a schema change.

### F-0064 · fixed · S4 · src/elements/object/library-sectors.ts:186 — the reception desk's NBR 9050 warning says "no higher than 90 cm"
Proof (verify): re-read library-sectors.ts:172-186. The model's own accessible part is 0.9 m wide (173-174), with its top at 0.73 + 0.025 = 0.755 m. The rule's message (186) says "a até 90 cm (75 a 85)", "no higher than 90 cm". The source opened gives the lowered part's height as 0.75 m to 0.85 m. 90 cm is the part's minimum width (NBR 9050:2015 9.2.1.4, as quoted in public tender documents found by search; the ABNT text itself could not be opened: the PDFs tried returned 401, 403 or 404, or were binary). The message mixes the two measures.
Source: https://www.boaconta.com.br/blog/laudo-acessibilidade-nbr-9050/
What: the rule's message asks for "a part no higher than 90 cm (75 to 85)". In NBR 9050 the accessible part of a service counter is at least 0.90 m wide and between 0.75 and 0.85 m high; 90 cm is its width, not a height.
Proof: library-sectors.ts:172-174 (the model itself: 0.9 m wide, top at 0.73 + 0.025 m), 186 (the message).
Effect: the warning tells the user a wrong limit (a 0.88 m counter would read as compliant).
Fix plan: "NBR 9050: a service counter needs a part at least 90 cm wide, 75 to 85 cm high".
Check: none

### F-0065 · fixed · S3 · src/elements/object/library.ts:106 — a bookcase inside its own ranges asks for more than 500 books: the top shelves stay empty and an error shows
Proof (verify): re-read library.ts:72-112. Take largura = 3 and altura = 3, both maxima allowed (77, 79), with espessura 0.018 and vao 0.35:
- porNivel = floor(2.964 × 0.72 / 0.032) = floor(66.69) = 66;
- prateleiras = floor(2.964 / 0.35) − 1 = 8 − 1 = 7.
Each of the four book parts (106-112) then repeats 66 × 8 = 528 times, over evaluate.ts's MAX_REPEAT 500 (222-223). Copies past 500 are dropped and a problem is pushed. The last shelf runs from i = 462 to 527, and i stops at 499, so its last 28 places (i = 500 to 527) stay empty. Each part also evaluates every i, and its `when` keeps only a quarter.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor
What: each of the four book parts repeats `porNivel * (prateleiras + 1)` times and keeps a quarter by `when`. At 3 m × 3 m (both allowed, lines 77, 79) with the default spacing 0.35: porNivel = floor(2.964 × 0.72 / 0.032) = 66 and prateleiras = 7, so 528 copies per part. evaluate.ts caps each part at 500 and pushes "at most 500 copies".
Proof: library.ts:77-85 (ranges and counts), 106-112 (four parts with the full count each), evaluate.ts:67, 222-223 (cap and message).
Effect: a library object used inside its own limits shows a problem and loses the top shelf's books. It also evaluates every book four times, three of them thrown away.
Fix plan: one book part with its material chosen by formula, if the schema allows it, or each part repeating only its own quarter (count ceil(n/4), index 4·i + k). Keep the total under the cap, or derive the cap from the definition's own maximum.
Check: src/elements/object/schema.ts (can material take a formula?)
Also: schema.ts:53-54 — a part's material is a plain string (a parameter's name or an id), not a formula; the fix is the per-part quarter count (repeat ceil(n/4), index 4·i + k).

### F-0066 · fixed · S4 · src/elements/object/valid.ts:54 — a definition read from a file is not checked for its handles' shift and sign, nor for any count limit
Proof (verify): re-read valid.ts:12-64.
- Handles: the check at 54 covers param, axis and at only.
- Parts: repeat is checked only for count being an Expr (16).
- Shift: evaluate.ts:424 passes h.shift ?? 0 through unchecked, and object-handles.ts:228 multiplies by it. A string such as "x" coerces to NaN (MDN: "foo" * 2 is NaN), which makes the new position NaN.
- Sign: evaluate.ts:420-421 uses h.sign ?? 1 directly as a direction component.
- Reopening: isObjectInstance (73) requires isPoint(at), so an instance saved with a NaN position is refused on reopening.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Multiplication
What: the handle check covers param, axis and at only; `shift` and `sign` pass with any type. object-handles.ts:228 multiplies the drag by `handle.shift`, and evaluate.ts:420 uses `h.sign ?? 1`. Nothing bounds repeat counts or nesting either: the check F-0060 asked for is not here.
Proof: valid.ts:54 (handle check), 16 (repeat: only count's type); evaluate.ts:420, 424; app/object-handles.ts:163, 228.
Effect: a definition from a file or a library link with `shift: "x"` turns a drag into NaN for the object's position. isObjectInstance (valid.ts:73, isPoint) then refuses the instance when the file is reopened, so the object is lost. A huge count passes reading and hangs on evaluation (F-0060).
Fix plan: check shift as a finite number in [0, 1] and sign as ±1 (or drop them to defaults on reading). Bound counts and depth at evaluation (F-0060).
Check: none

### F-0067 · fixed · S3 · src/elements/opening/commands.ts:195 — listing an opening's align candidates derives every opening once per other opening
Proof (verify): re-read commands.ts:184-213. alignCandidates filters every other opening through alignFits (205). alignFits rebuilds the openings list and runs deriveOpenings over all of them (185-186). derive.ts:211-220 compares every pair of openings, so each derivation is O(n²) and one candidate list is O(n³). Callers, by grep: fields.ts:81 (each panel build), fields.ts:321 (once per other selected opening), commands.ts:155 and 213 (once per id).
Source: https://en.wikipedia.org/wiki/Time_complexity
What: alignCandidates calls alignFits for every other opening, and each alignFits runs a full deriveOpenings over all openings (184-188). One call costs n derivations of n openings. The opening panel calls it on every build (fields.ts:81). The multi-selection "align" entry calls it once per selected opening (fields.ts:321), and alignOpenings once per id (213), which also checks ruleKeepingPosition (155).
Proof: commands.ts:184-188, 195-207, 213; fields.ts:80-81, 321.
Effect: in a house with 100 openings, selecting one door runs about 100 full derivations to build its panel. Selecting 10 runs about 1,000, and the panel is rebuilt on each render (F-0011), so selection and editing become sluggish as the model grows.
Fix plan: derive once and test each candidate's centre projection against the opening's wall directly (the check alignFits does). Or compute the candidates only when the align list is opened.
Check: src/elements/opening/derive.ts (cost of deriveOpenings)
Also: derive.ts:211-220 compares every pair of openings in the document (the wall test sits inside the inner loop), so a single deriveOpenings costs O(n²). alignCandidates is therefore O(n³), and at 300 openings that is about 2.7·10⁷ pair tests to build one panel.

### F-0068 · fixed · S2 · src/elements/opening/derive.ts:172 — an opening's position is computed from other openings: moving or resizing one door moves the doors measured from it, aligned with it or grouped with it
Proof (verify): the position is never stored, so other openings decide it.
- The design: schema.ts:1-2 says the position is "always derived … never stored", and PositionRule (16-22) holds fromOpening, aligned and inGroup.
- The derivation: derive.ts:165-193 startOf computes these from another opening's startOf and width (175, 176-185, 186-189) and from the group's spread (129-154). A bad reference falls back to the centre (174).
- Where the link is made: opening-tool.ts:100-124 ruleAt adds a fromOpening candidate for every opening on the wall (113-116) and keeps the nearest. A door placed near a window is silently measured from it, and that window's later resize or move moves the door.
In Revit such a link exists only when the user locks a dimension, explicitly, by clicking its lock.
Source: https://help.autodesk.com/cloudhelp/2014/ENU/Revit-LT/files/GUID-BD91C1BE-4FBC-41F0-AC82-5C60A545EAC6.htm
What: startOf derives each station from a rule. fromOpening is refStart + ref.width + distance (189). aligned projects the reference's jambs from another wall (176-185). inGroup re-spreads every member from their widths and the stretch (129-154, 175). Changing one opening's place or width therefore changes the stations of every opening that refers to it, and in a group with equal spacing it changes all the others. A rule whose reference turns bad falls back silently to the centre of the wall (174).
Proof: derive.ts:165-193 (startOf), 129-154 (group stations), 174 (centred fallback). commands.ts:120-133 (wallRule/detachedFrom) and select-drag.ts:189, 279 hold dependents still only during a drag. A width change in the panel (updateOpening) or a nudge of a group member still moves the others.
Effect: root cause 2 of the goal ("mover uma porta mexe nas vizinhas"). A door widened in the panel pushes the window measured from it. A distributed member resized moves all its siblings. A broken reference (its wall made curved, its reference moved to another wall) jumps the opening to the wall's centre with only a warning.
Fix plan: store each opening's station explicitly (fromStart/fromEnd as the only stored position). Turn fromOpening/aligned/inGroup into explicit, visible links that the user creates (a locked dimension, an EQ group) and that are solved as constraints and shown in the drawing. Add a versioned migration that writes every opening's current station so nothing moves on opening a file. Revit hosts a door on its wall and links it to others only through dimensions the user locks.
Check: src/elements/opening/schema.ts (rule kinds), src/io/project-file.ts (migration), src/app/keep-openings.ts
Also: io/project-file.ts has no migration that writes stations: rules are read as stored (211-218, 247), and the only opening migration is regroupOffJoints for version < 4 (421-434). The fix needs a new version that turns fromOpening/aligned/inGroup into explicit stations at their current places.
Fix: src/io/project-file.ts:51, 116-120, 422, 425-433 (file version 68: heldByWalls gives every opening of an older file measured from or aligned with another the wall rule that keeps it where it is, wallRule, all worked out on the file as read), src/app/document.ts:75, 179 (Doc version 68), tests/io/project-file.test.ts:297-319 (the migration and a current file's kept link). What the code already did and stays: the door and window tools store only a wall rule (app.ts:564 wallRule on placing, select-drag.ts:277 on dropping; the tool's fromOpening candidate is only the preview's reference for the typed distance), and dragging holds dependents (select-drag.ts:187). Links left are the user's own: a fromOpening or aligned rule chosen in the panel's rule field (shown there), and a distributed group (made by the Distribute action, shown in the panel's group section); those move with their reference by the user's choice. Not done: a dimension-lock UI as Revit's in place of the panel's rule field (a new feature, out of this task's scope).
Fix source: https://help.autodesk.com/cloudhelp/2014/ENU/Revit-LT/files/GUID-BD91C1BE-4FBC-41F0-AC82-5C60A545EAC6.htm (a locked dimension fixes the distance; unlocked, the element is free to move: a link exists only when the user sets it)
Verified by: re-read src/io/project-file.ts:48-52, re-read src/io/project-file.ts:110-121, re-read src/io/project-file.ts:418-449, re-read src/app/document.ts:74-75, re-read src/app/document.ts:177-180, re-read tests/io/project-file.test.ts:290-320, re-read src/elements/opening/derive.ts:160-195 (fromOpening toward end: ref start + width + distance = 2.5 in the test), re-read src/elements/opening/commands.ts:100-159 (wallRule), re-read src/app/app.ts:512-586 (placing stores wallRule); npx tsc --noEmit passes
Also: schema.ts:1-2 states the design: "its actual position along the wall is always derived from the rule and the wall as it is now, never stored". PositionRule (16-22) holds the six kinds, three of which (fromOpening, aligned, inGroup) take their position from other openings. The fix changes this type and needs a file version bump.
Also: tools/nudge.ts:57-63 (slid) rewrites each rule kind by hand for an arrow-key move (fromStart +, fromEnd −, fromOpening ± by `toward`, anything else turned into fromStart), and nudge.ts:42 silently leaves a group member where it is. Another place that has to know every rule kind; with explicit stations it becomes `station + along`.
Also: the link is made silently at placing: tools/opening-tool.ts ruleAt (100-124) adds a fromOpening candidate for every opening on the wall (113-116) and keeps whichever reference is nearest, so a door placed nearer a window's jamb than the wall's end is stored as "0,40 from that window" with no sign to the user. That window's later move or resize then moves the door (derive.ts startOf). This is where the hidden links of root cause 2 are born.
Also: the tests pin this design: tests/app/temp-dims.test.ts:80-103 assert that a window "measured from another opening" shows the gap to the door and that typing keeps the fromOpening rule; 46-66 assert distances typed from a wall face are stored as fromStart/fromEnd stations. The RC2 fix (explicit stations, links only when the user makes them, a migration) has to rewrite these expectations, not delete them.
Also: tests/elements/opening/arrange.test.ts pins the derived design too: 70-74 asserts that moving the reference window moves the aligned door; 123-128 that a group's members move when the wall is lengthened; 76-88 and 193-197 that a broken reference centres the opening with only a warning. Its deletion and ungroup cases (99-105, 148-174) already keep positions as fromStart, which is the behaviour the fix makes general.
Also: tests/tools/opening-tool.test.ts:33-40 and 80-81 assert that placing near another opening stores fromOpening (the gap to its jamb), including a typed distance; with explicit stations these become fromStart/fromEnd at the same place (or a visible link the user makes).

### F-0069 · fixed · S4 · src/elements/opening/fields.ts:296 — switching a fixed-gap group's anchor from centred to start or end jumps the row to that end
Proof (verify): re-read fields.ts:262-305. fixed() keeps sp.distance, which is 0 for a centred row or an equal one (273), and the anchor set (296) changes only the anchor. derive.ts:145 places the row at from + distance (start) or length − distance − row (end). With distance 0, a centred row slides flush to that end. The comment at 265 ("nothing jumps more than it must") covers only the switch to fixed. The row moves when only its reference changed: high astonishment.
Source: https://en.wikipedia.org/wiki/Principle_of_least_astonishment
What: `fixed()` carries the old distance (0 while centred), so choosing anchor 'start' or 'end' sets distance 0. derive.ts:145 then puts the row against that end of the stretch. The comment at 265 promises "nothing jumps more than it must".
Proof: fields.ts:269-275 (distance kept from the old spacing, 0 when it was centred or equal), 296 (anchor change), derive.ts:145 (row placed at stretch start + distance).
Effect: a centred row of windows slides to the corner when the user only wanted to measure it from one end.
Fix plan: when the anchor changes, compute the distance that keeps the row where it is (row start minus stretch start, or stretch end minus row end).
Check: none

### F-0070 · fixed · S4 · src/elements/opening/index.ts:1 — a barrel file nothing imports
Proof (verify): re-read index.ts:1-6, which only re-exports with `export *`. A grep over the project, node_modules excluded, for "opening/index", "/opening'" and "elements/opening'" finds no import of it. The only matches are review files and docs/agent/work.md:65, which names it as an orphan. Code nobody imports is dead code.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export
What: index.ts re-exports schema, derive, commands and void ("the element's public parts, in one place"), but no file in src/ or tests/ imports it: every caller imports the modules directly.
Proof: index.ts:3-6; a search of src/ and tests/ for "opening/index", "elements/opening'" and "./opening'" finds nothing; the scope-cut notebook (docs/agent/work.md) listed it as an orphan before the cut.
Effect: dead code claiming to be the public surface; with `export *` any name clash between the four would be dropped silently (MDN export).
Fix plan: delete the file.
Check: none

### F-0071 · fixed · S3 · src/elements/opening/marks.ts:19 — two identical doors get different type marks when one stands open or their style keys were set in another order
Proof (verify): re-read marks.ts:14-27. The make is JSON.stringify(o.style) (19), compared as a string (21). The style includes `open`, how far the leaf stands open (schema.ts:96-97), so a door shown ajar becomes another type. JSON.stringify visits properties by the Object.keys order (MDN), which for string keys is insertion order. So the same values set in another order make another string, and another type.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
What: a type's "make" is JSON.stringify(o.style), the whole style. It includes `open`, how far the leaf stands open (schema.ts:96-97), and it depends on key order: removing and re-adding a screen or muntins (fields.ts rest-destructuring) moves the key to the end. Two equal doors, one drawn 50% open, or two equal windows edited in a different order, become two types (P1, P2).
Proof: marks.ts:19 (make = JSON.stringify(style)), 21 (make compared as a string); schema.ts:96-97 (open is in the style); fields.ts:442-443, 460, 516-517 (keys removed and re-added). MDN JSON.stringify: properties in insertion order.
Effect: the plan's door and window tags count more types than exist. Setting a door ajar for a 3D view changes its mark. Marks also renumber after unrelated edits.
Fix plan: compare makes by their type-defining fields only (operation, leaves, frame, casing, transom, screen, threshold, design, handle, glazing, muntins, splits, materials), in a fixed key order. Leave out `open`.
Check: none
Also: the header (1-4) still says the mark is the same "in the schedule" ; schedules left the app (F-0036). `localeCompare` without a locale (24) orders makes by the machine's language, though makes are JSON and ASCII here.
Also: style.ts:79-83 modelOf finds a style's catalogue model the same way, by JSON.stringify equality. fitStyle (100-118) rebuilds a style as rest, screen, mullions, transoms, operation, leaves, threshold, an order different from the models' literal one (18-33). Any edit through `change()` (fields.ts:412), even setting the open amount or putting a value back, makes a catalogue door read "custom" in the model field (fields.ts:375).

### F-0072 · fixed · S4 · src/elements/opening/parts.ts:227 — a one-leaf sliding door or window never looks open, and an open window's shutter vanishes instead of being pushed aside
Proof (verify): re-read parts.ts:180-182 and 218-231. The sliding leaf: with n = 1, lap = 0, w = clear = b − a, spread = 0 and shut = a. Then aside = a (hinge start) or b − w − 0 = a (hinge end), so t0 = a whatever the amount, and the leaf never moves. A sliding door opens by sliding parallel to the wall, so a single leaf should move past its jamb. The shutter: lines 299-303 draw it only when `!open`, while the comment at 288-290 says it is "pushed aside" when open.
Source: https://en.wikipedia.org/wiki/Sliding_door
What: in `sliding`, with one leaf w = clear and spread = 0, so `aside` is a (hinge at the start) or b − w = a (hinge at the end). The leaf's open position equals its shut one, so it stays shut at any amount. A shutter is drawn only when the window is closed (`!open`, 299), although the comment (288-290) says it is pushed aside when the window is open.
Proof: parts.ts:221-231 (n = 1: lap 0, w = clear, aside = a), 288-290 (comment), 299-303 (shutter only when closed).
Effect: setting "open amount" on a single sliding door or window changes nothing in 3D. Opening the view's doors leaves single sliders shut. An open window with a shutter loses the shutter.
Fix plan: slide a single leaf past the jamb (a pocket or surface slide), toward its hinge side by its width × amount. Draw the shutter's leaves folded to the jambs when open.
Check: none
Fix: src/elements/opening/parts.ts (sliding: one leaf runs into the wall past its hinge-side jamb, 6 cm left out; shutter: rolls up toward the head by the open amount, its guides kept). Branch worktree-revisao-interface, e297fed; checked in the app: a single sliding door at 50 % in 3D, a shuttered window at 60 % in the north elevation.

### F-0075 · fixed · S3 · src/elements/opening/parts.ts:249 — a closed pivot door is drawn in 3D shifted by a sixth of its width: it runs into the strike jamb and leaves a gap at the pivot side
Proof (verify):
- The symbol: symbol.ts:78-88 draws the pivot leaf from pivot − out·short to pivot + out·long, with short = clear/6 and pt = a + short (start hinge).
- The 3D: parts.ts:235 keeps that line, being perpendicular to the wall. Its first point projects to station tH = pt (245). Closed, the leaf starts at P(tH, mid), along the wall (249, u0 = along), for len = short + long = clear (243). So it spans [a + short, b + short], one sixth past the strike jamb, and leaves [a, a + short] open.
- Open: it turns about h0, the point `short` behind the pivot, not about the pivot.
A pivot door turns about the vertical axis of its top and bottom hardware, set in from the edge.
Source: https://rustica.com/what-is-a-pivot-door/
What: the plan symbol's pivot leaf runs from `short` behind the pivot to `long` in front of it (symbol.ts:80-86, short = clear/6). In 3D, `swung` takes that line's first point as the hinge. Closed, it puts the leaf's start at the pivot's station (P(tH, mid), tH = the pivot's t) and runs it along the wall for the line's whole length (short + long = clear). The leaf then covers [pivot, pivot + clear], `short` past the strike jamb.
Proof: symbol.ts:78-88 (leaf [pivot − out·short, pivot + out·long]), parts.ts:241-250 (h0 = l[0], len = |l|, closed h = P(tH, mid) with tH the pivot's station, u0 = along), 282 (pivot doors go through swung).
Effect: every closed pivot door (models doorPivot 1.20 m and doorPivotSlatted 1.40 m) shows its leaf ~18-23 cm into the wall at the strike side and a slot of light at the pivot side. Partly open, it turns about the face point behind the pivot rather than about the pivot.
Fix plan: give swung the pivot's own station and the short/long split for pivot leaves, so the closed leaf spans [a, b] and turns about the pivot. Or build pivot leaves separately from the symbol.
Check: none

### F-0076 · fixed · S4 · src/elements/presets.ts:14 — presets are untyped patches merged into the next element: a key renamed in a kind stops applying without a sign
Proof (verify): re-read presets.ts:10-45 and presets-dialog.ts:28-29. The patch is `Readonly<Record<string, unknown>>`, any keys with unknown values, and templateOf spreads it over nextOf(app, p.slot) with no check. The type checker therefore accepts any key, so a renamed field such as plate, infill or grade stops applying without an error. A Partial of each slot's element type would have it checked.
Source: https://www.typescriptlang.org/docs/handbook/utility-types.html
What: a preset's patch is `Readonly<Record<string, unknown>>` and presets-dialog.ts:29 merges it over the slot's next element (`{ ...nextOf(app, p.slot), ...p.patch }`). Nothing checks its keys or values against the column, beam, stair, railing, roof or curtain schema. Also, "Steep gable 45 %, slate" covers with graniteBlack, and railStair sits at the end, apart from the other railings.
Proof: presets.ts:10-15 (type), 26-58 (patches with shape, plate, infill, grade, vertical/horizontal…), ui/presets-dialog.ts:29 (spread).
Effect: a renamed or mistyped field (e.g. `plate`) silently does nothing, or leaves an unknown key on the next element that may be saved. This is root cause 1 again: a kind's options also live in this untyped list.
Fix plan: type each slot's patch as Partial of that kind's next-element type (a mapped type keyed by slot). Name the slate preset's material honestly or add a slate material, and keep the railing presets together.
Check: src/app/next-element.ts (slot types)

### F-0077 · fixed · S4 · src/elements/railing/fields.ts:28 — a railing's gap is always shown in centimetres, whatever the project's unit
Proof (verify): re-read railing/fields.ts:28-29. The gap is written as gap × 100 + " cm" by hand, while the length beside it uses lengthText. units.ts:10-11 makes the project's unit m, cm, mm or ft. A grep for "cm`" in src/elements also finds stair/fields.ts:58-59, the riser height and the Blondel sum. In a project in feet, one panel then mixes two units, against consistency and standards.
Source: https://www.nngroup.com/articles/ten-usability-heuristics/
What: the gap readout formats `railingGap × 100` with " cm" by hand. Every other length uses ui/units (lengthText), which follows the project's unit: m, cm, mm or feet and inches (units.ts:10-11).
Proof: railing/fields.ts:28 (literal "cm"), 29 (the length beside it uses lengthText); ui/units.ts:2, 10-11.
Effect: in a project in feet or millimetres, one field of the railing panel speaks another unit than the rest, and the user cannot compare it with the 11 cm (NBR 9077/14718-style) limits written in their own unit.
Fix plan: format the gap with lengthText (or a unit-aware short length).
Check: other hand-written "cm"/"m" in fields (grep `cm\``)
Also: stair/fields.ts:58-59 and 66 write the riser height, the Blondel sum (2h + p) and a ramp run's rise in hand-made "cm" too, beside lengthText for the run length.

### F-0078 · fixed · S3 · src/elements/railing/schema.ts:45 — a railing without infill is drawn with a top and a mid rail only: 51 cm openings, and nothing warns
Proof (verify): re-read railing/schema.ts:29-46. An unset infill is "a mid rail" (29), and railingGap gives height/2 − RAIL_SIZE = 1.1/2 − 0.04 = 0.51 m (45). The file knows the 11 cm limit (34-35 comment). The source opened says NBR 14718 asks for a clear opening ("vão-luz") of at most 0.11 m between profiles, and a closing up to 0.45 m where horizontal members can be climbed. The panel only shows the gap (fields.ts:28) and gives no warning.
Source: https://sienge.com.br/blog/guarda-corpos-devem-atender-a-nbr-14718/
What: an unset infill means "a mid rail" (29, 45). Its widest opening is height/2 − 0.04 = 0.51 m at 1.10 m, and 'rails' is offered beside balusters and glass with no warning. The baluster spacing (34-35) is written for NBR 14718's 11 cm limit, so the norm is known here. Its own height default cites NBR 9077's 1.10 m (9-10).
Proof: schema.ts:29-30, 41-46 (gap), 33-36 (8 cm baluster gap "under the 11 cm NBR 14718 asks"); fields.ts:25 (unset shown as rails); kind-tools.ts:102 (the tool's next railing defaults to balusters, but railings from older files, from other tools or with infill cleared stay on rails). NBR 14718: clear openings at most 0.11 m, and a closing up to 0.45 m when horizontal members can be climbed (sienge.com.br).
Effect: a balcony guardrail drawn with rails reads as finished and correct while its openings are five times the norm's limit.
Fix plan: warn on any railing whose gap is over 0.11 m (the warning list the panels show), and default an unset infill to balusters on reading.
Check: src/elements/stair (railings added on stair sides: their infill), app/kind-tools.ts:102

### F-0079 · fixed · S3 · src/elements/reference/commands.ts:22 — every change to a reference picture serialises its whole image twice
Proof (verify): re-read reference/commands.ts:15-28. Each update runs isReference(next) and JSON.stringify(next) === JSON.stringify(r) (22). reference/schema.ts:12-13 keeps the picture as a data URL, the image's bytes inline as base64 text. That is as large as the picture itself (a scanned plan runs to megabytes), and browsers allow data URLs up to 512 MB (MDN). For a DXF, schema.ts:73 walks every coordinate with `every(finite)`. So each opacity, turn, scale or move step pays for the whole image or drawing.
Source: https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/data
What: updateReferences decides "no change" by JSON.stringify of the old and new reference. A picture reference holds its image as a data URL (reference/schema.ts:12-13), often megabytes. Moving, turning, scaling or changing the opacity of a reference stringifies that string twice per command, and a dragged slider or a move sends many commands.
Proof: reference/commands.ts:19-25; reference/schema.ts:12-13 (data URL); MDN JSON.stringify (walks every value).
Effect: dragging the opacity or moving a 5 MB scanned plan copies about 10 MB of text per step. Interaction stutters exactly where the user traces over a reference.
Fix plan: compare only the patched fields (opacity, angle, scale, at) with the current ones; never serialise `data`. Validate only the patched fields.
Also: isReference (schema.ts:61-87) is run on every update (commands.ts:22). For a DXF reference it walks every coordinate (`lines.every(finite)`), tens of thousands of numbers on each drag step. The opacity comment says 0.1-1 (29) but the check allows 0.05 (84).
Check: src/app/reference-ui.ts (how often updates are sent while dragging)

### F-0080 · fixed · S4 · src/elements/roof/commands.ts:34 — a roof's slope has no upper limit, and a negative side slope silently turns the side into a gable
Proof (verify): re-read roof/commands.ts:29-50. Line 34 refuses only grade < 0, and 32-33 only non-finite values: no upper bound. A side's grade is not range-checked at all, and `g > 0 ? g : null` (49) turns any value ≤ 0, a typed minus included, into a gable without a word. A percent grade grows without bound toward vertical (100 % = 45°), so a typo such as 3000 for 30 raises the ridge 30 times as high.
Source: https://en.wikipedia.org/wiki/Grade_(slope)
What: updateRoofs refuses a negative or non-finite `grade` but takes any size. Percent grade grows without bound toward vertical, so a typo of 30000 for 30 (or 3000 for 30) raises the ridge to 900 m or 90 m over a 6 m span. A side's grade is checked only for finiteness, and any value ≤ 0 sets that side to a gable (49).
Proof: roof/commands.ts:32-34 (checks), 45 and 49 (applied); Wikipedia "Grade (slope)": 100 % is 45° and the percentage tends to infinity near vertical.
Effect: one wrong keystroke builds a roof hundreds of metres tall. The 3D view frames it, the camera far plane and shadows stretch, and the user hunts for what happened. A minus sign typed in a side's slope removes the slope instead of warning.
Fix plan: bound grades to a sane range (e.g. 0-1000 %, or by angle under 85°) in the command and the field. Refuse a negative side grade, or offer "gable" as its own choice.
Check: src/elements/roof/fields.ts (field limits)
Also: roof/fields.ts:36 and 78 give the slope fields `min: 0` and no max. In a project writing slopes in degrees, slopeTyped clamps to 89.9° (ui/units.ts:122), which is 57,296 %: a 6 m wide gable then rises about 1.7 km. In 1:n, typing 0.01 means 10,000 %.

### F-0081 · fixed · S3 · src/elements/roof/geometry.ts:89 — a sloped roof over an L-, T- or U-shaped outline is built flat
Proof (verify): re-read geometry.ts:61-102. notConvex is set whenever a sloped side exists and the outline is not convex (86). Line 89 then returns one flat face at the eaves (88, 101): the sides' slopes are dropped. The page opened says the straight skeleton is defined for simple polygons, non-convex ones included. A vertex meeting a non-adjacent edge splits the shrinking polygon, and the skeleton serves as a roof's ridge lines. So an L, T or U plan has a sloped roof, and this code gives it none.
Source: https://en.wikipedia.org/wiki/Straight_skeleton
What: the roof is the lower envelope of its sides' planes, which is the hip roof only on a convex outline. On any non-convex outline with a sloped side, the code gives up and returns one flat face at the eaves, with `notConvex` true and a panel note.
Proof: geometry.ts:1-6 (method), 86 (notConvex), 89-102 (flat face returned); fields.ts:66 (the note). Wikipedia "Straight skeleton": the roof of any simple polygon, non-convex included, is its straight skeleton, computed by splitting the shrinking wavefront at reflex vertices.
Effect: the most common house plans (L, T, U) cannot have a hip or gable roof. The user draws one, gets a flat slab and a note, and must split the roof by hand into convex pieces whose planes do not meet at the valleys.
Fix plan: build sloped roofs on non-convex outlines with a straight skeleton (weighted by each side's grade), or split the outline into convex parts and trim each part's planes by the others' at the valleys.
Check: src/elements/roof/schema.ts (edgesFor on non-convex outlines), app/geometry (roof covers for walls)
Also: roof/schema.ts:55-68 edgesFor sets the sides by kind with no regard to convexity. A "hip" or "gable" on an L outline gets its sloped sides, and geometry.ts then discards them. Wikipedia "Hip roof": hip roofs are built on many plan shapes, the inner corner of an L forming a valley.

### F-0082 · fixed · S4 · src/elements/room/fields.ts:120 — a floor's slope is always in %, unlike a roof's, and editing it on several floors gives them all the first one's direction
Proof (verify): re-read room/fields.ts:114-133 and roof/fields.ts:29-41.
- The unit: the floor grade has a fixed `unit: '%'` with no min and no conversion, while the roof's grade uses slopeUnit()/slopeShown/slopeTyped and min 0.
- The selection: setting the grade writes floors[0]'s dir on every id (122), and setting the dir writes floors[0]'s grade on all (132).
The same slope option is shown two ways, and a multi-edit overwrites each floor's other component.
Source: https://www.nngroup.com/articles/ten-usability-heuristics/
What: the floor grade field has `unit: '%'`, no slopeUnit conversion and no limits. The roof's slope fields follow the project's unit (percent, degrees or 1:n) through slopeShown/slopeTyped (roof/fields.ts:35-40). Setting the grade writes `{ grade: v, dir: floors[0]'s dir }` on every selected floor, and setting the direction writes floors[0]'s grade on all.
Proof: room/fields.ts:115-133; roof/fields.ts:34-40; ui/units.ts:112-125.
Effect: in a project that writes slopes in degrees, a ramp's slope reads 8.33 while the roof beside it reads 16.7°: the same kind of option shown two ways (root cause 1). Two terraces falling to different drains, edited together, both end up falling the same way.
Fix plan: use the slope unit helpers and bounds for the floor's grade. Patch only the changed component per floor (keep each floor's own dir or grade).
Check: none

### F-0083 · fixed · S3 · src/elements/stair/geometry.ts:96 — a stair gets as many treads as risers: one tread too many, and a run one step longer than built
Proof (verify): re-read geometry.ts:80-105 and 153-154. A straight stair calls flight(at, u, risers, 0, 0), and flight lays n = risers parts of depth t. Their tops run from riser up to risers × riser = height (96), and the walk line is n × t long (97). So the last "step" is a full tread at the upper floor's height, inside the stair. The source opened says the treads are always one fewer than the risers, because the upper floor is the last step.
Source: https://engineerfix.com/how-to-calculate-stairs-rise-run-and-treads/
What: a flight of n risers is laid as n steps of depth t, the last one's top at the full height (96, 154; L, U and spiral the same). In a stair the last riser lands on the upper floor, so a straight flight has risers − 1 treads. Here the top "step" is a tread-deep slab at the upper floor's level, inside the stair.
Proof: geometry.ts:94-104 (n parts of depth t, tops (i+1)·riser up to the height), 154 (straight: risers steps), 202-208 (spiral: risers wedges); stairWell (65-78) cuts the upper floor over every step, so the well is one tread longer. cznull.com stairs calculator: "Treads equal risers minus 1."
Effect: every straight stair is drawn about 28 cm longer than built (17 risers → 17 × 0.28 = 4.76 m instead of 4.48 m). The well opened in the floor above is one tread longer, and plans fitted to the real run no longer fit. Riser counts read from the plan disagree with sections.
Fix plan: lay risers − 1 treads (the last riser arriving at the upper floor's edge), the well ending at the last riser. For L and U, count landings and winders the same way.
Check: src/elements/stair/schema.ts (STAIR_RISER), the stair tool's preview length, railing.wellPath (open side at the top step)

### F-0084 · fixed · S4 · src/elements/stair/schema.ts:55 — stairs and ramps get one handrail at 0.90 m, not NBR 9050's pair at 0.92 and 0.70 m extended 30 cm
Proof (verify): re-read schema.ts:43-55 and geometry.ts:98-104. Each side gets one rail, at RAIL_HEIGHT = 0.9 above the first and last nosing, with no extension. The same file cites NBR 9050 for the ramp's values (43-46). The clauses opened (tender texts quoting NBR 9050) ask for handrails at 0.70 m and 0.92 m from the floor, extended at least 0.30 m at the start and end of stairs and ramps. The ABNT text itself was not opened.
Source: https://lawinsider.com/pt/clause/rampas-e-escadas
What: RAIL_HEIGHT is 0.90 m and geometry.ts draws one rail per side, ending at the first and last nosing. The same file quotes NBR 9050 for the ramp's grade, rise and landing (43-46), but its accessible ramp (presets.ts: "Accessible ramp 8.33 %") has a single rail at 0.90 m with no extensions.
Proof: schema.ts:54-55; geometry.ts:98-104, 131 (one polyline per side at RAIL_HEIGHT, from first to last step). NBR 9050 as quoted by clauses at lawinsider.com: handrails at 0.70 m and 0.92 m, extended at least 0.30 m at the start and end of stairs and ramps.
Effect: an "accessible" ramp or stair modelled here does not show the handrails the norm asks of it. Its sections and 3D read as compliant to someone who trusts the preset's name.
Fix plan: for ramps (and stairs marked accessible) draw two rails at 0.92 and 0.70 m with 0.30 m extensions, and set RAIL_HEIGHT to 0.92.
Check: none
Also: render/prisms.ts:159-163 draws the handrail's end posts 0.9 m long as a literal, not from RAIL_HEIGHT. Changing the constant would leave the posts short or poking through.

### F-0085 · fixed · S4 · src/elements/wall/commands.ts:12 — deleteWalls is used only by a test and would orphan the deleted walls' doors, windows and dimensions
Proof (verify): re-read wall/commands.ts:12-19. It only filters doc.walls. A grep over src and tests finds its definition, tests/core/store.test.ts (5, 34, 50, 68-73) and two i18n labels (812, 2901). No app code calls it, so in the app it is never executed: dead code. Used, it would leave openings and dimensions pointing at deleted walls.
Source: https://en.wikipedia.org/wiki/Dead_code
What: the app deletes through opening/commands.ts deleteElements, which removes the walls' openings and drops held elements (registry.dropKinds). deleteWalls only filters the walls list. Only tests/core/store.test.ts calls it, and its labels sit in i18n.
Proof: wall/commands.ts:12-19; grep deleteWalls over src and tests: the definition, store.test.ts:5-73 and i18n.ts:812, 2901.
Effect: dead code that looks like the way to delete walls. Anyone wiring it to a button leaves openings without a host (openingNoHost), dimensions pointing at nothing and rooms not re-settled.
Fix plan: remove it (and its labels), and point the store test at deleteElements; or make it a thin call to deleteElements.
Check: none

### F-0086 · fixed · S3 · src/elements/wall/fields.ts:278 — changing how a wall's top is set changes its height: "fixed" jumps it to 2.80 m, "level"/"up to a level" drop any offset
Proof (verify): re-read wall/fields.ts:142-151 and 276-282. The top select's set passes topRule(v, …), and topRule builds the rule from constants: fixed is 2.8, a level offset is 0, toLevel's offset is 0. None of them reads the wall's current height. In Revit the Unconnected Height is "the height of the wall when it is sketched", and a Top Offset belongs to a level top: a fixed height is the wall's own, not a constant.
Source: https://help.autodesk.com/cloudhelp/2021/ENU/Revit-ArchDesign/files/GUID-ED2045E5-90BF-418F-AAD6-3BB1544F34F5.htm
What: topRule builds a new rule from constants: fixed 2.8 m, level offset 0, up to a level offset 0. It does not start from the wall's current height. A 3.20 m wall switched from "the level's height" to "fixed" becomes 2.80 m; a wall up to the level above with −0.10 m becomes its full height when switched to "level". Revit's Unconnected Height keeps the wall's sketched height when the top constraint is changed.
Proof: wall/fields.ts:142-151 (top select → topRule), 276-282 (constants); the height readout (194-207) shows the current height that is thrown away. Autodesk Revit help (Wall Instance Properties): Unconnected Height is the wall's height measured up from its base; Top Offset applies to a level top.
Effect: the user only wanted to "fix" the height they see, and walls change height silently, along with everything that follows them (roof covers, openings near the top).
Fix plan: build the new rule from the wall's current top: fixed = current top − base, level offset = current top − level top, toLevel offset = current top − that level's elevation.
Check: src/app/document.ts (wallHeights)
Also: wall/type-fields.ts:27 does the same for a wall type: "fixed" sets 2.80 m and "level" drops the offset. Every wall following the type changes height at once. The type's top offers only level and fixed (22-25), while a wall's offers four (wall/fields.ts:261-267), a third list of the same option (root cause 1).

### F-0087 · fixed · S3 · src/elements/wall/flip.ts:50 — flipping a wall swaps its ends but not what is named by them: chosen end joins and dimension anchors jump to the other end
Proof (verify): re-read flip.ts:40-56.
- What is swapped: start and end (50), and the openings and groups are remapped (52-53).
- What is not: `joins` ({ start?, end? }, wall/schema.ts:67-68) is spread through `rest` unchanged, so a join chosen for one corner now names the other. Dimension anchors name a wall's `end` or an opening's `jamb` (dimension/schema.ts:17-18), and doc.dimensions is not touched.
In Revit the wall flips about its location line and nothing else moves (cutouts keep their orientation). Here the dimensions and the chosen join jump to the other end.
Source: https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-FDBDB1AF-6750-4C00-A87A-C9DF191F04BC.htm
What: flipWalls swaps start and end and remaps the openings' rules, hinge, swing and groups. It keeps `joins` ({ start, end }, schema.ts:68) as is, so a join chosen for one corner now applies to the other. Dimensions anchored to a wall end (`{ kind: 'wall', end, along, offset }`) or to a door jamb (`{ kind: 'opening', jamb }`) (dimension/schema.ts:17-18) are not touched. After the flip, "start" names the other physical end or jamb.
Proof: flip.ts:29-34 (openings remapped), 47-51 (walls: only start, end and bulge), no handling of `joins` or `doc.dimensions`; wall/schema.ts:67-68; dimension/schema.ts:17-18. Revit help (Flip the Orientation of Compound Walls): the wall flips about its location line and nothing else moves.
Effect: the flip control on a wall makes its dimensions jump to the other end or jamb and its hand-set corner join reappear at the opposite corner. The plan's numbers change though nothing moved.
Fix plan: in flipWalls, swap `joins.start`/`joins.end`. For dimensions anchored to the flipped walls, swap `end` (along stays the distance from that physical end) and negate `offset` if it is measured to the wall's left. For dimensions on their openings, swap `jamb`. Check measures and other end-named refs the same way.
Check: src/elements/measure (arc measures on walls), src/elements/dimension/anchor.ts (meaning of along/offset)
Also: Mirror does the same. tools/transform.ts swaps the ends of mirrored walls in place (edit.ts transformWalls with swap, transform.ts:177 for disjoin) and of mirrored copies (212) and remaps their openings (mapRule, mapOpening), but keeps `joins` unswapped; dimensions on mirrored walls are left to mapKinds/copyKinds (registry), which must also swap `end`/`jamb`. One helper "swap a wall's end-named data" should serve flip, mirror and mirrored copies.
Also: tests/elements/wall/flip.test.ts checks openings, hinge, swing, groups and flip-twice identity but no wall with joins and no dimension, so these cases are not covered; flip.ts is also a fourth place that rewrites every opening rule kind by hand (F-0068 Also: nudge, opening-tool, derive).
Fix: src/elements/wall/flip.ts:1-5, 10-11, 42-50 (withSwappedJoins, exported), 57-65 (a dimension held by a flipped wall's end, or by a hosted opening's jamb, gets the other name with its offset negated: the same physical point), 70-71 (walls swapped with their joins), 75-77 (dimensions re-held; an arc's measures at 1 − t), src/tools/transform.ts:18, 177, 179-180, 184, 214 (Mirror: the walls' chosen joins swapped with their ends, in place, disjoined and copied). Mirrored dimensions already swap end/jamb in kinds/dimension.ts:86-87 (transformed), and keep their offset (a reflection and a swap of direction leave the wall's left on the image of its left).
Fix source: https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-FDBDB1AF-6750-4C00-A87A-C9DF191F04BC.htm (the wall flips about its location line; nothing else changes on its own)
Verified by: re-read src/elements/wall/flip.ts:1-81, re-read src/tools/transform.ts:1-20, re-read src/tools/transform.ts:143-222, re-read src/elements/dimension/anchor.ts:58-77 (resolve: from the end, into = −dir; normal = left of start→end, so a swapped wall's offset changes sign); npx tsc --noEmit passes

### F-0088 · fixed · S3 · src/elements/wall/geometry/footprint.ts:129 — the end-join choices the panel offers act only at an L between two straight walls
Proof (verify): re-read footprint.ts:52-63 and 112-155. A grep for `choice` in the file finds it set at 54-63 and read only at 129-130, inside the graph.corners loop. There `force` is undefined unless both walls are straight (121, 134-135). Junctions (85-111) and the later node and abutment passes never read it. The only other use is the 'off' set (63). Revit itself says square off and miter cannot be applied between a wall and the interior of another, so the choices must be offered per join, not on every end.
Source: https://help.autodesk.com/cloudhelp/2015/ENU/Revit-Model/files/GUID-19EAF7A9-331F-4271-94CC-43B76B13011E.htm
What: the wall panel offers six joins for each end of any one selected wall (auto, miter, through, stop, square, off: wall/fields.ts:45, 237-249). The engine reads them in one place: the corner loop, for two straight walls (`force` is undefined when either is an arc, 134-142). 'off' also removes the end from the graph (63-64). At a T (abutments, 201-223), a node of three ends (187-196), a junction (89-111) or a crossing, 'miter', 'through', 'stop' and 'square' are stored and do nothing. Revit allows only butt where a wall meets another's interior and says so.
Proof: footprint.ts:52-63 (choices collected), 129-142 (the only reader besides `off`), 187-223 (nodes and abutments ignore them); wall/fields.ts:237-249 (offered whenever one wall is selected). Revit help "Change the Configuration of a Wall Join": butt is the only option for a wall meeting the interior of another; miter and square off apply where wall ends meet.
Effect: the user picks "miter" at a T or at an end touching two walls and nothing changes, with no message. The choice stays saved and silently starts acting if the joint later becomes an L.
Fix plan: offer per end only the choices that apply to the join that end is in (from the join graph), or say "not available here". Keep the stored choice visible as inactive.
Check: src/elements/kinds/wall.ts (end sides passed to the fields), src/elements/wall/join/discover.ts

### F-0089 · fixed · S4 · src/elements/wall/geometry/footprint.ts:623 — the final overlap guard checks only arcs: straight walls whose bodies overlap without any end or axis contact go unreported
Proof (verify): re-read footprint.ts:619-639 and discover.ts:99-135, 201-228.
- The guard loops only over chains.keys(), the arcs (630).
- Abutments need the free end's point inside the host's band (104).
- Crossings need the axes to cross inside both walls (218).
So two non-parallel straight walls whose rectangles overlap, with neither condition met, are never compared. A test of whether the two convex pieces are disjoint (a separating axis exists) would find them, and none is made for them.
Source: https://en.wikipedia.org/wiki/Hyperplane_separation_theorem
What: the last guard (overlapsWithArcs) compares pieces only when one wall is an arc. Corrected after reading join/discover.ts: discovery already warns 'wallsOverlap' for parallel straight walls lying over each other (lyingOver, discover.ts:168-170, 176-199), for a wall inside another (116-126), for overrun corners whose lines cross far away (128-146) and for parallel abutments (107-108). What no check sees is two non-parallel walls whose bodies overlap while neither reference end lies inside the other's band and the axes do not cross inside both. Example: a slanted wall stopped with its axis end a few millimetres outside a thick wall's face, so one corner of its body pokes into the other.
Proof: footprint.ts:356, 619-639 (arcs only); discover.ts:100-114 (abutments need the end inside the band), 208-228 (crossings need both axes interior). STATE.md lists "overlaps without warning" among known wall-engine breaks (reports/breaks/RELATORIO.md), still to be matched to a case in the app test.
Effect: a wedge of one wall's hatch drawn over another's, with no warning, in near-miss joints.
Fix plan: extend the final guard to all walls of a level (pieces bucketed by an R-tree of their boxes), reporting overlaps the graph did not already report.
Check: reports/breaks/RELATORIO.md (the exact overlap case the owner saw)
Fix: src/elements/wall/geometry/pieces.ts overlapsUnjoined (straight walls whose reference lines do not touch and whose pieces overlap by 1 cm² or more: wallsOverlap), called after overlapsWithArcs in footprint.ts. Branch worktree-revisao-interface, e297fed; measured: a slanted wall stopped 2 mm short of a thick one is reported, walls apart and a T are not, the two test projects' 408 walls give no new warning.

### F-0090 · fixed · S3 · src/elements/wall/types.ts:56 — deleting the wall type chosen for the next walls leaves the wall tool drawing walls of a missing type
Proof (verify): re-read types.ts:55-65. The blocker looks only at doc.walls (59). A grep of src for `defaults =` / `defaults:` finds the next walls' type set at app.ts:301 (once, from wallTypes[0]), frame.ts:425, ribbon-tabs.ts:318 and types-dialog.ts:174. Nothing resets it when its type is deleted. makeWall (wall-ui.ts:127-131) writes d.wallTypeId into each new wall, and shapeOf returns 'missingWallType' for an unknown type (shape.ts:46-47). So each new wall references a missing type: a broken reference.
Source: https://en.wikipedia.org/wiki/Referential_integrity
What: typeDeleteBlocker only refuses a type that walls use, or the last one. The next walls' type (ui.defaults.wallTypeId) is not consulted. After deleting it, makeWall (wall-ui.ts:127-131) keeps writing that id, and each new wall has no type: shapeOf returns 'missingWallType' (shape.ts:47), so the wall has no body, only a warning.
Proof: wall/types.ts:56-65; app/wall-ui.ts:127-131 (defaults used as they are); app/app.ts:301 (the default set once from wallTypes[0]); ui/types-dialog.ts:185-188 (the delete button enabled when the blocker is null).
Effect: the user picks a type for the next walls, decides to delete it in the types dialog (no wall uses it yet), and every wall drawn afterwards is invisible apart from a warning.
Fix plan: block deleting the next walls' type, or move the next walls to another type when it is deleted. Have makeWall fall back to an existing type.
Check: src/app/frame.ts and ribbon-tabs.ts (where defaults change)

### F-0091 · fixed · S4 · src/elements/wall/types.ts:10 — a wall type's layer order is not checked against the function priorities the joins rely on
Proof (verify): re-read types.ts:10 and layers/stack.ts:12-15. `usable` checks a non-blank name and stackProblem, and stackProblem checks only that there are layers and that each thickness is finite and above 0. No function or priority order is checked. Revit's layer assignment rules say priorities "cannot ascend from the core boundary to the finish face", with the example of a finish inside the core and a structure layer outside it.
Source: https://help.autodesk.com/cloudhelp/2014/ENU/Revit-LT/files/GUID-CCDEE011-2A5E-43AC-BD60-8F81CF432A6B.htm
What: a type is usable when its name is not blank and its stack has layers of positive thickness (stackProblem). Revit also refuses priorities that ascend from the core to a face, for example a structure layer outside a finish, or a substrate outside a finish. The T join walk (cut-t.ts:39-53) assumes they do not ascend, and the core is "first to last structure layer", which swallows finishes between two structure layers.
Proof: types.ts:10; layers/stack.ts stackProblem (count and thickness only); cut-t.ts:39-53; shape.ts:38-44. Revit help (layer assignment guidelines): "Layer function priorities cannot ascend from the core boundary to the finish face."
Effect: a hand-made type with layers in an odd order joins strangely: finishes cutting through cores at Ts, or a finish counted as core. Nothing tells the user why.
Fix plan: reject (or warn on) ascending priorities from the core outward when editing a type, and say which layer breaks the rule.
Check: ui/types-dialog.ts (layer editing)
Fix: src/elements/wall/geometry/shape.ts layerOrderProblem (priorities rising from the core toward a face), said in src/ui/layer-editor.ts under the layers (types.orderProblem), not refused: the library's 19 types keep the order. Branch worktree-revisao-interface, e297fed; checked in the app: a substrate outside a finish is named.

### F-0092 · fixed · S3 · src/io/import-dxf.ts:67 — a DXF reference loses every arc inside its polylines (bulges ignored), and ellipses the header promises are skipped
Proof (verify): re-read import-dxf.ts:1-103.
- LWPOLYLINE (67-74) reads only codes 10/20 and joins the vertices with straight segments.
- POLYLINE's vertices (84) read only 10/20.
- No group 42 is read anywhere, and ezdxf's docs say a non-zero bulge makes the segment from that vertex an arc.
- There is no ELLIPSE case (63-102), so an ellipse falls into `skipped`, although the header (2) promises "ELLIPSE's full turns".
- Group 210-230 (extrusion) is never read.
Source: https://ezdxf.readthedocs.io/en/stable/dxfentities/lwpolyline.html
What: LWPOLYLINE reads only the 10/20 coordinates and draws a straight segment between each pair of vertices. The bulge on each vertex (group 42), which makes that segment an arc, is ignored, and so are the VERTEX bulges of POLYLINE (84). ELLIPSE, promised by the header (1-4), has no case and is counted as skipped. Arcs and circles mirrored by an extrusion direction of (0,0,−1) are drawn unmirrored.
Proof: import-dxf.ts:1-4 (ELLIPSE promised), 67-74 (LWPOLYLINE: 10/20 only), 75-90 (VERTEX: 10/20 only), 63-102 (no ELLIPSE case; extrusion 210-230 never read). ezdxf LWPOLYLINE docs: each vertex carries a bulge; non-zero makes the segment from it an arc. Autodesk DXF reference: LWPOLYLINE group 42 is the bulge per vertex.
Effect: an architect's floor plan DXF with curved walls, rounded corners, door swings drawn as polyline arcs, or mirrored blocks traces wrongly: chords instead of curves, missing ellipses, arcs on the wrong side. The reference the user traces over is not the drawing.
Fix plan: for a non-zero bulge, draw the arc from the vertex to the next (centre and sweep from the bulge, as wall/geometry/arc.ts does). Add ELLIPSE (centre, major axis, ratio, parameters). Apply the OCS mirror when the extrusion's z is negative. Or correct the header to what is read.
Check: src/app/reference-ui.ts (how skipped types are said to the user)

### F-0093 · fixed · S3 · src/io/import-mesh.ts:64 — a glTF model larger than 20 m is shrunk a hundredfold: its unit is guessed although glTF is always in metres
Proof (verify): re-read import-mesh.ts:50-66. The unit is guessed from the largest extent for every file (64): over 20 means ×0.01, over 2000 means ×0.001. Its only caller, model-import.ts:56, passes no format, though it loads .glb, .gltf and .obj (55). glTF 2.0 §3.4 says "The units for all linear distances are meters", so a 25 m glTF model becomes 25 cm.
Source: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
What: the unit is guessed from the model's size for every file: over 20 units across means centimetres, over 2,000 means millimetres. The glTF 2.0 specification fixes "the units for all linear distances are meters". Only OBJ has no unit and needs a guess. meshDefinition does not know the format.
Proof: import-mesh.ts:5-6 (header), 62-64 (the guess); glTF 2.0 spec §3.4: linear distances are meters.
Effect: importing a glTF of a building, a tree row or a site model over 20 m makes an object 100× too small (a 30 m model becomes 30 cm), with a "unit" the user did not choose. The 20 m threshold also misreads OBJ files in metres of large things.
Fix plan: pass the format; for glTF use metres (unit 1) always. For OBJ keep the guess but show it and let the user change it before placing.
Check: src/app/model-import.ts (format passed, the guess told to the user)

### F-0094 · fixed · S3 · src/io/library-file.ts:176 — a library link is inflated without a size limit and merged into the open project without asking
Proof (verify): re-read library-file.ts:165-181 and app/library-link.ts:1-62.
- No limit: `through` reads the whole DecompressionStream into one ArrayBuffer (166), and libraryFromHash JSON.parses it. MDN's DecompressionStream page names no output limit, and deflate's ratio limit is about 1032:1 (Wikipedia, Zip bomb). LINK_MAX (10) only guards copying.
- No question: openLibraryLink runs at start and on every hashchange (59-61) and dispatches the merge directly (48-54), telling the user only by a toast (55).
Source: https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream
Source: https://en.wikipedia.org/wiki/Zip_bomb
What: libraryFromHash decompresses the link's deflate-raw data in full and JSON.parses it. openLibraryLink (app/library-link.ts:28-56) merges it into whatever project is open, at start or on any hashchange, without a confirmation. The 100 kB limit applies only when copying a link (LINK_MAX), not when opening one. A deflate stream can expand about a thousandfold. Merged definitions are checked only for shape (valid.ts: no count or depth limits, F-0060, F-0066).
Proof: library-file.ts:165-167 (stream piped whole), 176-181 (no limit), 86-147 (merge); app/library-link.ts:28-56 (opened on hashchange and merged with a toast only), 9-10 (LINK_MAX for copying). MDN DecompressionStream: decompresses a stream of data with no size bound of its own.
Effect: a crafted or broken link (a few hundred kB of hash) inflates to hundreds of MB and freezes or crashes the tab. A link with heavy definitions lands in the user's project unasked and hangs evaluation where it is placed.
Fix plan: count bytes while reading the DecompressionStream and stop past a limit (e.g. 20 MB). Ask before merging, showing what the library brings. Apply the definition limits of F-0060/F-0066.
Check: src/app/boot.ts (when wireLibraryLinks runs)

### F-0095 · fixed · S3 · src/io/pdf-canvas.ts:1 — the vector PDF writer of the removed documentation area is still in the app (714 lines), kept alive by one type check
Proof (verify): re-read pdf-canvas.ts:1-9 (the vector PDF of the plan, sections and sheets). A grep over src and tests:
- `new PdfCanvas` and calls of pdfOfVectorPages: none in src.
- The only src imports: render/hatch.ts:6, for isPdfCanvas (53, 75), a branch that is never taken because no PdfCanvas is ever made.
- Otherwise: plan-view.ts:194, a comment; tests/io/pdf-canvas.test.ts tests it.
The writer and the hatch branches are code never executed in the app.
Source: https://en.wikipedia.org/wiki/Dead_code
What: pdf-canvas.ts is the vector PDF of phase 10 ("the plan, the sections and the sheets" printed as lines). Printing, sheets and PDF export left the app in step 1. The file stays because render/hatch.ts imports `isPdfCanvas` to draw hatch tiles as lines on a vector page, and plan-view.ts still takes a "vector page" context. No code in src makes a PdfCanvas any more. tests/io/pdf-canvas.test.ts tests it.
Proof: pdf-canvas.ts:1-9 (purpose: plan, sections, sheets as vector PDF); grep pdf-canvas over src: render/hatch.ts:6, 52 (isPdfCanvas), plan-view.ts:194 (comment on the optional context); no `new PdfCanvas` or pdfOfVectorPages call in src (only the test).
Effect: about 700 lines of a removed area kept against the owner's step-1 order ("o código sai do aplicativo e fica na tag"), plus branches in the hatch and plan renderers for a page type nothing creates.
Fix plan: remove pdf-canvas.ts and its test, drop the isPdfCanvas branch in hatch.ts and the vector-page context in plan-view.ts (the code stays in tag escopo-completo-2026-10-28).
Check: src/render/hatch.ts, src/render/plan-view.ts (the branches to remove)
Also: render/plan-view.ts keeps the print path of the removed app/print.ts: the `printing` property (187-191, "drawn for paper (app/print.ts)") and its branches (213, 274, 279, 287, 290, 352, 417, 774), plus the vector-page constructor context (194-202). Nothing in src sets `printing` (grep: only plan-view reads it).
Also: render/hatch.ts:6, 52-53, 74-78 are the only importers: paperHatch and hatchPattern branch on isPdfCanvas to return a vector pattern. Without pdf-canvas both functions keep only their canvas paths.

### F-0096 · fixed · S4 · src/io/project-file.ts:194 — reading a file accepts wall layers with unknown functions or no material, and keeps doors and windows whose wall is gone
Proof (verify):
- Layers: project-file.ts:194 requires only `typeof l.function === 'string'`, not one of the five functions (wall/schema.ts:10). materialId is not checked at all, and 304 then makes a material for every layer's materialId, undefined included.
- Openings: 296 keeps them by isOpening alone (234-248), which checks that wallId is a string but not that the wall exists. Registry kinds whose holder is missing are dropped and reported (401-405).
These are a missing table look-up check and a missing cross-reference check.
Source: https://en.wikipedia.org/wiki/Data_validation
What: isWallType checks only that each layer's function is a string and does not check `materialId` at all. A layer of function "membrane" (or a typo) has no LAYER_PRIORITY, so the T join walk compares NaN (cut-t.ts:51). A layer without a materialId reaches `materialFor(undefined)` (304). Openings are kept whether or not their wall survived reading (296), while dimensions held by a missing wall are dropped (401-405). An opening on a dropped wall then stays in the file, never drawn, with only an 'openingNoHost' warning.
Proof: project-file.ts:188-196 (layer check), 304 (materialFor of every layer's materialId), 296 (openings kept without a wall check) vs 401-405 (registry kinds dropped when their holder is missing); wall/schema.ts:10-19 (five functions); cut-t.ts:51.
Effect: a hand-edited or partly broken file opens without a word about its bad layers (joins quietly wrong) and carries invisible doors that resurface if a wall with that id comes back.
Fix plan: check layer functions against the five and materialId as a string, dropping or fixing and reporting. Drop openings whose wall is missing, as dimensions are, and say so.
Check: none
Also: the version history comment (56-115) stops at 43 and jumps to 67; versions 44-66 are explained only inline where they migrate.

### F-0097 · fixed · S4 · src/io/typed-ids.ts:33 — renaming untyped ids on reading leaves several references pointing at the old names
Proof (verify): re-read typed-ids.ts:13-46. Every kind's ids are renamed (25, 30), but references are remapped only for openings, groups, floors' rooms and dimension anchors (33-44). Zones' room lists, railing hosts (stair or floor ids) and the other kinds' held ids keep the old names. The renames also share one Map keyed by the bare id across all kinds (15, 21). A rename has to be forwarded to every referencing field, as a CASCADE on update does.
Source: https://en.wikipedia.org/wiki/Referential_integrity
What: typedIds renames every registry element and group id that lacks its kind's prefix. It then remaps references only in openings (wall, rule), groups, floors from rooms, and dimension anchors. Zones' rooms (zone.rooms), hosted railings (host.stairId / host.floorId), arc measures (wallId) and every other kind's held ids keep the old names. The renames map is keyed by the bare id for all kinds at once, so two elements of different kinds with the same raw id ("a") collide and references go to whichever was renamed last.
Proof: typed-ids.ts:14-30 (renames keyed by id across kinds), 33-44 (references remapped: openings, groups, floors, dimensions only); zone/schema.ts:24 (rooms), railing/schema.ts:28 (host), kinds/measure.ts:102 (holders wallId).
Effect: a file written by another tool, or edited by hand, opens with zones that lost their rooms (invisible, F-0056), guardrails no longer hosted on their stair or floor, and arc measures holding nothing. The file looks repaired ("typed ids" reported) while links are broken.
Fix plan: key renames by kind and id, and remap through each kind's declared references (a `references` hook in the contract next to `holders`). Then every holder and follower is renamed in one place.
Check: src/elements/contract.ts (holders/follows hooks)
Fix: src/project/typed-ids.ts (this branch's place for io/typed-ids.ts): renames keyed by list and id; zones' rooms, guardrails' stair or floor hosts and arc measures' walls follow. Branch worktree-revisao-interface, 30cd3a9 (the main checkout's uncommitted change of io/typed-ids.ts, carried); checked by script: a wall and a room both "a" become wall_a and room_a, their references follow, typed files come back the same object.

### F-0098 · fixed · S3 · src/render/pattern-texture.ts:230 — preview textures are cached forever, one 1024-px canvas and GPU texture per pattern and colour tried
Proof (verify): re-read pattern-texture.ts:229-247. previewTextures is a module Map keyed by JSON of the pattern and the colour (239). It is only read and set (240-244), with no delete or dispose. Each entry is a CanvasTexture of a period painted up to SIDE = 1024 px (8-9). three.js frees a texture's GPU resources only through dispose(), "whenever this instance is no longer used". Every new pattern or colour tried in a dialog therefore keeps a texture for the whole session.
Source: https://threejs.org/docs/pages/Texture.html
What: previewMesh keeps every painted pattern texture in a module Map keyed by the JSON of the pattern and the colour. Nothing removes or disposes them. Each is a canvas up to 1024 × 1024 px plus its GPU copy (about 4 MB each). Trying colours in the materials or definition dialogs, or editing a pattern's joint or size, paints and keeps a new one at every step.
Proof: pattern-texture.ts:229-247 (Map without bound or dispose), 8-9 (SIDE 1024), 183-191 (a CanvasTexture per paint). three.js Texture docs: dispose() frees the GPU resources and must be called when a texture is no longer used.
Effect: memory grows while the user explores materials in the dialogs, until the tab slows or the GPU context is lost (WebGL context lost in long sessions).
Fix plan: bound the cache (LRU of a few dozen) and dispose evicted textures. Or key previews by material id and dispose on change.
Check: src/render/scene-3d.ts (whether the 3D view's own pattern textures are disposed)
Also: render/scene-3d.ts:412-430 (setPattern) disposes a material's old texture before painting the new one, so the 3D view itself does not leak. Only the previews' module cache does.

### F-0099 · fixed · S4 · src/render/scene-3d.ts:739 — the photorealistic view patches three-gpu-pathtracer's private internals, with the dependency on a caret range
Proof (verify): re-read scene-3d.ts:733-754. Line 739 casts WebGLPathTracer to reach `_pathTracer.material` and set its defines. Line 747 reaches `_pathTracer.compileMaterial` and `_primaryTarget` and replaces compileMaterial (749). These are private members, so a library update breaks this code where the type checker cannot see it.
Correction to What/Effect: node-semver says `^0.0.27` means >=0.0.27 <0.0.28-0, with no updates for 0.0.x. So package.json:30 already holds this exact version, and a routine install cannot move it. The break comes only with a deliberate upgrade, which makes it S4 maintenance risk, not a live failure.
Source: https://github.com/npm/node-semver
What: traceStep reaches into undocumented members of WebGLPathTracer: `_pathTracer.material` (its shader, whose defines and fragment source are rewritten by trace-shader.ts), `_pathTracer.compileMaterial` (replaced), `_primaryTarget` and `_blendTargets` (filters changed). package.json allows any 0.0.x from 0.0.27 on (`^0.0.27`), and the README documents none of these, only the public API.
Proof: scene-3d.ts:739-770 (casts to `{ _pathTracer: … }`, setDefine, fragmentShader replaced, compileMaterial wrapped, targets' filters); package.json:30 (`"three-gpu-pathtracer": "^0.0.27"`); the library's README documents only its public API.
Effect: a dependency update renames or restructures those internals, and the photorealistic style fails or silently loses its fixes (fireflies, compile stalls, filtering). The cast hides the break from tsc.
Fix plan: pin the exact version, check the internals at start (fall back to the realistic view with a message when they are missing), and prefer the library's public hooks where they exist.
Check: src/render/trace-shader.ts (string replacements on the shader source)
Also: trace-shader.ts patches the library's GLSL by string search and throws when it does not match (clampedSamples 89-91: 'gl_FragColor.a *= opacity;' / 'void main()'; oneShadowRay 101-103: directLightContribution with exactly 2 attenuateHit calls). The call at scene-3d.ts:758 sits in traceStep's setup (690-772), where the only try (752) wraps the patched render, not the patch: a version whose shader differs throws out of draw() in the animation frame, uncaught.
Also: tests/render/trace-shader.test.ts:7-8 reaches PhysicalPathTracingMaterial through a cast because the export is "left out of its typings": the test guards the shader patch against the installed version, but only when the suite runs; the app has no runtime check (the fix plan's start-up check).

### F-0073 · fixed · S3 · src/elements/room/derive.ts:191 — a room ignores free-standing walls inside it: their footprint and any space they enclose count in its area
Proof (verify): re-read derive.ts:185-220. holesOf keeps only `poly.slice(1)` of each polygon of the union (191), its holes. polyclip-ts returns a MultiPolygon of non-overlapping polygons, outer rings counter-clockwise and inner rings clockwise. A free-standing box of walls inside a room's hole is therefore a separate polygon of that MultiPolygon, its outer ring lying inside the hole. deriveRooms takes the room's outline, area and perimeter from the hole alone (216-217) and never subtracts those islands.
Source: https://github.com/luizbarboza/polyclip-ts
What: a room is the hole of the walls' union that holds its point (191, 208-217). Walls standing free inside that space (a shaft or stair core of four walls, a single partition stub, a column-like box of walls) form separate polygons of the MultiPolygon lying inside the hole. They are never subtracted, so the room's outline, area and perimeter are those of the hole as if the island were not there.
Proof: derive.ts:191 (only `poly.slice(1)`, the holes, are kept; the islands are other polygons of the union), 216-217 (outline, area and perimeter from the hole alone); polyclip-ts README: the result is a MultiPolygon of non-overlapping polygons, exterior ring then holes.
Effect: a living room around a closed shaft reports the shaft's area as its own. The floor made from the room (deriveFloor, 233) covers the shaft. labelPoint may put the name on the core, and two rooms (one in the shaft's own hole, one around it) overlap in area.
Fix plan: subtract from each room's hole the union's polygons lying inside it (their exteriors), keeping them as the room's holes. Compute area, perimeter and label with the holes; floors from rooms carry them.
Check: src/elements/kinds/room.ts, the room tag and the floor from a room

### F-0074 · fixed · S3 · src/elements/room/derive.ts:206 — deriving rooms serialises the level's wall pieces once per room
Proof (verify): re-read derive.ts:185-219. For each room (205), holesOf is called with the level's pieces (206), and its first step is `JSON.stringify(pieces)` (187), before the cache lookup. MDN: arrays are serialised index by index, and objects by their own enumerable properties. So every room pays a full walk of every wall polygon of its level, and line 218 serialises the room's hole again for its key. The cache is cleared whole past 64 entries (192).
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
What: holesOf is memoised by `JSON.stringify(pieces)`, the whole list of the level's wall polygons, and deriveRooms calls it once per room (206), then serialises the room's hole again for its key (218). The cache holds 64 entries and is cleared at once when full.
Proof: derive.ts:185-195 (key = JSON of all pieces), 205-219 (per room). app.ts runs keepRooms on every dispatch (F-0008), which derives rooms.
Effect: on a level with 300 wall pieces and 30 rooms, every change stringifies tens of kilobytes 30 times before any geometry. Dragging walls and typing in the panel slow down as the plan grows.
Fix plan: group rooms by level and call holesOf once per level. Key the cache on the pieces array's identity (a WeakMap) or on a cheap version stamp from the geometry derivation. Key spaces by hole index, not JSON.
Check: src/app/geometry.ts (how piecesByLevel is built and whether its arrays are stable)

### F-0100 · fixed · S4 · src/tools/arrange.ts:21 — the selection's box spreads every outline point into Math.min/Math.max, and there are two boxOf functions
Proof (verify): re-read arrange.ts:16-31 and select-drag.ts:98-111.
- arrange.ts: boxOf spreads every x and y into Math.min and Math.max (21), and arrangeSteps does the same over the boxes (31).
- select-drag.ts: smartBoxes pushes every selected wall piece's and outline's points with `mine.push(...pts)` (105) and boxes them all (110). That runs at the start of a drag.
- Limits: MDN says engines limit argument counts (JavaScriptCore at 65536), and most throw past it.
- Duplicates: a grep finds a second exported boxOf in core/rtree.ts:81.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply
What: boxOf spreads all x and all y values as call arguments (`Math.min(...xs)`), and arrangeSteps does the same over the boxes (31). select-drag.ts:105 also pushes every selected outline point with `mine.push(...pts)` and then calls this boxOf over them all (110). core/rtree.ts:81 has a second boxOf (a loop-free reduce over boxes) used by registry.ts.
Proof: arrange.ts:17-22, 31; select-drag.ts:101-111 (walls' pieces and every kind's outlines of the selection); rtree.ts:80-84. MDN Function.prototype.apply: engines limit argument counts (JavaScriptCore 65,536), past it most throw, and it recommends chunks.
Effect: dragging a large selection (select all on a big plan, a bookcase of hundreds of copies, curtain walls) can throw a RangeError out of the drag, at a size that differs by browser. Two box helpers with the same name differ in shape (Point2 min/max vs minX/maxX).
Fix plan: compute min/max in one loop; keep one boxOf (core) and adapt the box shape at the call.
Check: src/app/select-drag.ts (the drag's snap boxes)

### F-0101 · fixed · S2 · src/tools/edit.ts:79 — moving a wall throws a nearly parallel neighbour kilometres away: the slide onto the moved wall's line intersects two almost parallel lines with no guard
Proof (verify): re-read edit.ts:25-32 and 55-88, and core/vector.ts:22-28.
- The end-at-end path uses meet() (70), which refuses lines within NEAR_PARALLEL (30).
- The end-on-body path (76-80) calls intersectLines directly. intersectLines returns null only when cross(u, v) === 0 (25), so for nearly parallel lines s = cross(q − p, v)/denom grows without bound.
The page opened says the denominator is zero for parallel lines, and the formula is for infinite lines, so it can give a point outside both segments. reports/breaks/RELATORIO.md:18 records exactly this: 1,023 sequences, wall_0's end sent to about 10¹⁴ m.
Source: https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection
What: follow() slides an unselected wall's end that lies on a moved wall's body along its own line to the moved wall's new line with `intersectLines` (79), which returns null only when the cross product is exactly 0 (core/vector.ts:25). A neighbour whose end lies on the moved wall's line and whose own direction is almost the same (two walls nearly in line, overlapping or end-to-body) gets an intersection at about move / sin(angle): 10^14 m for a near-zero angle. keepOnHosts (152) has the same unguarded intersectLines for the moved wall's own ends, though it checks the result lies on the host. The corner paths use meet() with NEAR_PARALLEL 0.05 (30, 70, 119), which still allows a 20× throw at a 2.9° angle.
Proof: edit.ts:76-81 (no parallel or distance guard), 152-155; core/vector.ts:23-28 (denom === 0 only); reports/breaks/RELATORIO.md:18: 1,023 sequences, "duas paredes quase em linha ... moveWalls de wall_1 por 0,7 m manda a ponta de wall_0 para (8,4×10¹⁴; −9,4×10¹⁴) m".
Effect: the most frequent break of the wall engine: a move of one wall sends an unselected wall to near-infinite coordinates, the plan's extent explodes, and the joins, rooms and 3D around it break; undo is the only way back.
Fix plan: an end follows a moved line only when the angle between its own line and the moved line is clearly away from parallel (one shared guard for every path, the same as meet's) and the slide is no longer than a bound tied to the move (e.g. a few times its length); otherwise the end goes by the map itself (moves with the wall) or stays. Use one helper for the three paths.
Check: src/app/select-drag.ts and src/app/app.ts (callers of moveWalls/rotateWalls), src/tools/arrange-walls.ts (moves through moveWalls)
Fix: src/tools/edit.ts:29 (meet exported), 34-49 (slideOnto: meet's near-parallel guard plus a bound of 4 × the wall's own move; movedBy), 85-98 (follow: both the end-at-end slide and the end-on-body slide use slideOnto; a body end refused stays where it is), 137 (transformWalls' corner uses slideOnto), 170-171 (keepOnHosts uses meet instead of the bare intersectLines), src/tools/split.ts:9, 13, 166-177 (cornerWalls uses meet: two walls 0.5° apart are no longer cornered tens of metres away). All callers (select-drag, nudge, transform, arrange-walls, constraints, temp-dims, wall-ui, frame) reach these through moveWalls/transformWalls/rotateWalls, so one change covers them.
Fix source: https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection (the denominator is zero only for parallel lines; the formula, for infinite lines, can give a point outside both segments: a guard and a bound are the caller's)
Verified by: re-read src/tools/edit.ts:24-148, re-read src/tools/edit.ts:149-183, re-read src/tools/split.ts:1-16, re-read src/tools/split.ts:164-187; npx tsc --noEmit passes. The break scripts (scripts/breaks) are not run in this phase (nothing is run before apptest).
Also: tests/tools/edit.test.ts covers only neighbours square to the moved wall (corners of a box, a perpendicular divider, 90° rotations); no case has a neighbour nearly in line with the moved wall, which is exactly the case that breaks. The fix needs that case added (two walls at 179°, one moved 0,7 m: the other's end stays within a bound).
Also: tools/split.ts:175 cornerWalls uses the same unguarded intersectLines: two walls 0.5° from parallel are "cornered" by stretching both to a crossing tens of metres away (only exactly parallel lines return null; tests/tools/split.test.ts:89-92 covers only that exact case). The shared near-parallel guard should serve it too.

### F-0102 · fixed · S3 · src/tools/edit.ts:62 — following a move looks each moved wall up by a linear search, per unmoved wall end
Proof (verify): re-read edit.ts:55-88 and 110-127.
- follow maps every wall (56). For each unmoved wall's two ends (84-85), each moved wall (61, 76) is looked up with walls.find (62, 77). MDN describes find as a scan in index order until a match, so each lookup is linear.
- transformWalls' corner() loops over all walls for each moved end (115).
A move of m walls among n therefore costs on the order of (n − m) · 2 · m · n steps, and it runs on every pointer move of a drag.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
What: in follow(), for every unmoved wall, for each of its two ends, for every moved wall, `walls.find((x) => x.id === id)` scans the whole list (62, 77); the same in transformWalls' corner() over all walls per moved end (115). The cost is (n − m) · 2 · m · n per call.
Proof: edit.ts:55-88, 110-127. moveWalls runs on every pointer move of a drag (select-drag.ts) and arrange-walls calls it once per wall in turn (arrange-walls.ts:24-27).
Effect: dragging 50 walls of a 500-wall plan does about 22 million comparisons per pointer move before the join engine runs; distributing many walls multiplies it again. The drag stutters on real plans.
Fix plan: build a Map of the walls by id (and of ends by rounded position) once per call.
Check: src/app/select-drag.ts (how often moveWalls runs in a drag)

### F-0103 · fixed · S4 · src/tools/measure-tool.ts:54 — a closed measuring chain that crosses itself reads a wrong area, with no warning
Proof (verify): re-read measure-tool.ts:35-62. A chain closes on any click on its first point with 3 or more points (39), with no check for crossings. chainArea takes one signed shoelace sum and its absolute value (55-61). The page opened gives the formula for a simple polygon. On a figure eight, the two lobes wind opposite ways, so their signed areas cancel. For example, (0,0)→(2,0)→(0,1)→(2,1), closed, has the terms 0 + 2 − 2 + 0 = 0, so it reads 0 m². Its two triangles, meeting at (1, 0.5), enclose 0.5 m² each.
Source: https://en.wikipedia.org/wiki/Shoelace_formula
What: chainArea is the absolute shoelace sum. For a chain whose stretches cross (a figure eight), the two lobes have opposite signs and cancel, so the reading is their difference, not the area enclosed; the tool accepts such a chain and shows the number as the area.
Proof: measure-tool.ts:54-62 (one signed sum, abs at the end); measureTransition 39 closes any chain of 3+ points without checking crossings; chrome.ts:424 and frame.ts:96 show it as the area.
Effect: a user measuring an irregular room who clicks the corners out of order gets a plausible but wrong m² (a figure-eight 2×1 + 2×1 reads 0).
Fix plan: when the closed chain crosses itself, say so in the reading (no area), or give the area of the union of its lobes.
Check: none

### F-0104 · fixed · S3 · src/tools/modify-tool.ts:71 — Copy's second click on the base point places a copy exactly over the originals
Proof (verify): re-read modify-tool.ts:61-127. For move and copy, the second click goes through previewTransform, which returns translation(cursor − base) with no length check (71). modifyTransition applies it (110-111). The other steps all refuse a degenerate value: mirror (72), the third point (107), scale (81), and a typed move or copy (122, v > 0). So a double click, or a click snapped back on the base, copies the selection onto itself. That error-prone condition is neither eliminated nor checked.
Source: https://www.nngroup.com/articles/ten-usability-heuristics/
What: for move and copy, the second click always gives translation(cursor − base) (71) and modifyTransition applies it (110-111) with no check of its length, unlike mirror (72), scale (81), the third point (107) and a typed distance (122, v > 0). A copy with a zero (or sub-millimetre) step duplicates the selection in place.
Proof: modify-tool.ts:68-73, 104-111; modify-ui.ts:79-86 (transformSelection with m.copy, dispatched); modify-ui.ts:90 only skips the series offer when the step is 0, the copy itself is still made.
Effect: a double click, or a second click snapped back to the base, makes walls lying on walls (the break report's overlap case, joins lost), doubled doors and objects, with only an overlap warning at best; the user sees nothing changed.
Fix plan: reject a move/copy step shorter than MIN_WALL_LENGTH like the other tools do (stay on the second step).
Check: src/tools/transform.ts (transformSelection with copy)
Also: transform.ts transformSelection (146-228) copies whatever step it is given, and copyToLevel (252) calls it with a zero translation on purpose (the copy then gets another level), so the guard belongs in modify-tool, not in transformSelection.

### F-0105 · fixed · S4 · src/tools/snap.ts:378 — the aligned snap on a steep snapped direction can put the point far from the pointer
Proof (verify): re-read snap.ts:350-385. The alignment fires when |base.x − e.x| ≤ r (377). p is then where the ray from + t·dir meets the vertical x = e.x, t = (e.x − from.x)/dir.x (378). That is a line intersection whose denominator, dir.x, goes to 0 as the ray turns vertical, and it is guarded only at 1e-9. So p can sit up to r/|dir.x| along the ray from the snapped point, with no distance check against the cursor. The extension snap (361-362) bounds its move by `slack`.
Source: https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection
What: with an angle or parallel snap in force (best, dir), an alignment with another wall's end slides the point along dir to that end's x (or y): p = from + dir·(e.x − from.x)/dir.x (378, 382). The condition only checks that the angle-snapped point is within r of e.x, so p lies up to r/|dir.x| from it; dir.x is only guarded against 1e-9. Every other snap that moves along the ray (body 318-320, guide 331-333, extension 361-362) limits the move with `slack`; this one does not.
Proof: snap.ts:369-385 (no distance check of p against the cursor); 254 and 264 allow parallel directions within 5° of a wall at any angle, so |dir.x| can be ~0.03 for a near-vertical wall direction.
Effect: drawing along a nearly vertical wall's direction, the point jumps up to ~30 times the snap radius (metres at plan zoom) along the line when the pointer passes near the x of some wall end, and a click there draws a wall to the wrong length.
Fix plan: apply the same slack bound as the other ray snaps (skip the alignment when p is farther than slack from the cursor).
Check: none

### F-0106 · fixed · S3 · src/tools/split.ts:65 — split and merge carry the wall's per-end data to the wrong ends: end joins, and dimensions anchored to the wall
Proof (verify): re-read split.ts:52-98 and 125-150.
- Split: both parts copy `...w` (60-61, 65-66), `joins` included. The first part's joins.end and the second's joins.start now apply at the cut, a point that is not a wall end, and doc.dimensions is not touched (97-98).
- Merge: it is built from `...wa` (136), keeping a's joins, and only openings are re-hosted (146-149).
Splitting should divide the wall into two separate parts, each with its own outer end. The per-end choices and anchors land on the wrong ends instead.
Source: https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-1FD99EBE-5F75-4B54-858B-B18D7DE297C6.htm
What: splitWall copies the whole wall into both parts (`{ ...w, end: cut }`, `{ ...w, id: newId, start: cut }`), so `joins.end` (chosen for the old end's corner) now applies at the cut on the first part and `joins.start` at the cut on the second; nothing moves the dimensions anchored `{ wallId, end: 'end', along }` (dimension/schema.ts:17), which now measure from the cut instead of the old end, now on the new part. mergeWalls keeps `{ ...wa }` with a's joins even when b comes first (a's start join lands on the inner point) or b was flipped, drops b's joins, and deletes b while dimensions, railings or other references to b keep its id.
Proof: split.ts:56-67, 97 (parts from `...w`), 126-163 (merged from `...wa`, b filtered out, only openings re-hosted); wall/schema.ts:67-68 (joins per end); dimension/schema.ts:17, 42 (anchors by wall id and end).
Effect: part of the break report's "dividir muda a planta": a wall whose end was set to "no join" or a butt order splits into parts that do not join at the cut, and its dimensions jump to the cut point; after a merge, a dimension on the removed wall loses its anchor and a chosen corner join applies in the middle of the wall.
Fix plan: give each part only the end data of its outer end (first: joins.start, second: joins.end, nothing at the cut); re-anchor dimensions of `end` to the second part (along unchanged); in merge, take each outer end's joins from the wall that owned it (flipped when b ran the other way) and re-host references to b onto a with their stations shifted.
Check: src/elements/dimension/anchor.ts (anchor resolution after a wall is gone), src/elements/railing (hosted on walls)
Also: tests/tools/split.test.ts splits and merges a lone wall with one door; no case has an end join set, a neighbour joined at either end, or a dimension, so the defect is not covered.
Fix: src/tools/split.ts:12-13 (EndJoin, DimAnchor types), 70-72 (split: the first part keeps only joins.start, the second only joins.end), 103-109 (dimensions held from the wall's end move to the second part, same end and distance; an arc's measures go to the part their t falls on, t rescaled), 112-117 (withEndJoins), 154-174 (merge: the outer ends' joins from the wall that owned each, b's swapped when flipped; dimensions on a or b re-held by the merged wall at the same point, from an end that is still an end or from the merged start, b's offset negated when flipped), 201 (dimensions returned). Railings are not hosted by walls (no wall id in their schema), so nothing else names a wall here.
Fix source: https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-1FD99EBE-5F75-4B54-858B-B18D7DE297C6.htm (Split Element divides an element into two separate parts: each part has its own ends)
Verified by: re-read src/tools/split.ts:1-18, re-read src/tools/split.ts:18-53, re-read src/tools/split.ts:54-213, re-read src/tools/split.ts:213-226, re-read src/elements/dimension/anchor.ts:58-77 (resolve: from the end, into = −dir, normal = left of start→end: the four merge cases worked through by hand); npx tsc --noEmit passes

### F-0107 · fixed · S4 · src/ui/browser.ts:12 — the shown/hidden categories are listed three times (root cause 1)
Proof (verify): the same six names are written three times:
- app/geometry.ts:468, as the Category type;
- app/layer-sets.ts:12, as the CATEGORIES list that validates saved layer sets (64);
- ui/browser.ts:12-19, as another CATEGORIES list with labels.
TypeScript checks each entry's type but not that every list holds every member, so a seventh category would be missing silently from one list. This breaks DRY.
Source: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
What: the same six categories are written as a type in app/geometry.ts:468, as a list in app/layer-sets.ts:12 (used to validate saved layer sets), and as a third list with their labels in ui/browser.ts:12-19 (the browser's rows). Nothing ties the lists to the type beyond each being typed `Category`, so a category added to the type and one list is silently missing from the other.
Proof: geometry.ts:468; layer-sets.ts:12, 64; browser.ts:12-19, 83.
Effect: the goal's root cause 1 in small: a category added for, say, dimensions would validate in saved sets but have no row in the browser, or the reverse; the label lives apart from the category.
Fix: src/app/geometry.ts:467-473 (CATEGORIES as const, the one list, and Category = (typeof CATEGORIES)[number]), src/app/layer-sets.ts:9, 62 (its own list removed; the check reads geometry's), src/ui/browser.ts:6, 8, 74 (its list with labels removed; each row labelled layer.<category>, a template the type check holds to existing messages), src/app/actions.ts:16, 188-190 (a fourth copy found there, the palette's show/hide actions, now CATEGORIES.map).
Fix source: https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html (typeof list[number] captures the element type of an array literal: the type made from the list, never written apart)
Verified by: re-read src/app/geometry.ts:465-474, re-read src/app/layer-sets.ts:1-13, re-read src/app/layer-sets.ts:58-67, re-read src/ui/browser.ts:1-12, re-read src/ui/browser.ts:70-77, re-read src/app/actions.ts:1-36, re-read src/app/actions.ts:170-191; npx tsc --noEmit passes (layer.<category> is a MessageKey for all six); no other copy of the list in src or tests (grep: tests/app/browser.test.ts:36 passes four of them to hideCategories, a test input, not a copy)
Fix plan: one list of { id, key } in app/layer-sets.ts (or geometry.ts) with the type derived from it; browser and validation read it.
Check: none

### F-0108 · fixed · S4 · src/ui/controls.ts:333 — the search list opened near the bottom of the screen is placed by its empty height and then grows down over its own button and off the screen
Proof (verify): re-read controls.ts:255-336. The list `ul` is created empty (268) and filled only by update(), which replaceChildren's it (289-301) and is first called at 335, after the top is set at 333. At 333, pop.offsetHeight is the height of the popup with the input and an empty list. MDN: offsetHeight returns the element's height including padding and borders. That is non-zero, so `|| 260` never applies, and the popup's top is fixed by its empty height before its options are added below.
Source: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetHeight
What: when there is no room below (under 260 px), the list's top is r.top − 4 − min(260, pop.offsetHeight || 260), but pop.offsetHeight is read before update() fills the list (335), so it is the height of the search input alone (~30 px, non-zero, so the 260 fallback never applies). The list is placed just above the button, then filled, and extends downward over the button and past the bottom edge.
Proof: controls.ts:325-336 (append, measure, position, then update()); MDN offsetHeight: the value is the layout at the moment of reading.
Effect: a material, type or model chosen from a field low in the properties panel (the common case on a 880-1280 px tall window) opens a list whose options are partly below the screen and cover the field.
Fix plan: fill the list first (update()), then measure and place; or anchor with bottom: (innerHeight − r.top + 4) when opening upward.
Check: none

### F-0109 · fixed · S4 · src/ui/controls.ts:161 — scrubbing a value on a field's label never ends when the pointer is cancelled
Proof (verify): re-read controls.ts:145-169. The drag's move and up listeners are removed only in `up`, on pointerup (161-167). No pointercancel or lostpointercapture listener exists. Pointer Events 3 §4.1.3.3: on suppressing a stream the agent fires pointercancel, pointerout and pointerleave, and releases the capture, and pointerup is not in those steps. The cases are listed by MDN: palm rejection, touch-action, an orientation change, switching apps.
After a cancel, the old `move` keeps rewriting the input on later hovers, and the old `up` commits its stale value at the next pointerup on the label.
Source: https://www.w3.org/TR/pointerevents3/
Source: https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event
What: scrub() captures the pointer and ends only on pointerup (161-167). A pointercancel (touch turned into a scroll or zoom, palm rejection, an app switch) or a lost capture leaves the move/up listeners on the label; the value shown in the field keeps the scrubbed number while the model keeps the old one, and the next press adds a second pair of listeners.
Proof: controls.ts:146-169 (no pointercancel or lostpointercapture handler); MDN pointercancel: fired instead of the remaining events when the browser takes over the pointer, drag handlers should end on it too.
Effect: on touch (the app is meant to work on a phone) a label scrub interrupted by a scroll leaves the field showing a value that was never applied; the panel may then commit it on blur.
Fix plan: end the scrub (one idempotent function) on pointerup, pointercancel and lostpointercapture; on cancel, restore the field's text.
Check: none

### F-0110 · fixed · S4 · src/ui/cursors.ts:8 — most placing tools show the plain arrow over the drawing, not the aiming cross
Proof (verify): re-read cursors.ts:1-38 and shell.ts:12. GLYPH lists 6 of the 27 ToolIds, and toolCursor returns 'default' for every other one (33-34). MDN: 'default' is the platform's cursor, "typically an arrow". Its hotspot is the arrow's tip, while the aim cursor's is the cross's centre (10 10). So placing a column, stair, dimension, section and the like shows the arrow, and the header's promise (1-2) holds only for six tools.
Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor
What: GLYPH gives the aiming cursor to six tools (wall, door, window, room, floor, measure); every other tool of ToolId (column, beam, roof, stair, railing, curtain, separator, grid, object, dimension, guide, section, note, levelMark, mark, callout, calibrate, modify, split, corner) falls to 'default', the system arrow, whose hotspot is its tip, not a centre.
Proof: cursors.ts:8-15, 33-34; shell.ts:12 (27 tools).
Effect: placing a column, a stair or a dimension, the user aims with an arrow whose point is not the click point the snaps use, and nothing over the drawing says which tool is on, which the header promises "as in Revit, ArchiCAD and SketchUp".
Fix plan: every tool that clicks points on the drawing gets the cross (with its ribbon icon when there is one); only select keeps the arrow.
Check: src/ui/icons.ts (an icon exists for each tool)
Also: ui/icons.ts has a glyph for most of them already (column, beam, roof, stair, railing, dimension, guide, text, cut for the section, move, split, corner, rotate, scale, mirror, offset, copy), so the cursor table can cover every placing tool.

### F-0111 · fixed · S3 · src/ui/definition-editor.ts:182 — renaming a parameter leaves the old name in several formula fields, breaking the definition
Proof (verify): re-read definition-editor.ts:176-191. swapAll renames inside a string only when its reviver key is in a fixed list (182). 'round', 'tilt', 'roll' and 'turn' are not in it, and the editor writes formulas there (schema.ts:63-77 has them as Expr). The corners of a profile or revolve are strings inside arrays, and MDN says the reviver's key for an array element is its index as a string ("0", "1"), which is never in the list. Those formulas keep the old name. Correction to What: a sphere's 'd' is renamed, because 'd' is in the list. The parts left out are round, tilt, roll, turn and the points.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse
What: renameParam rewrites formulas only under a fixed list of keys ('x','y','z','w','d','h','r','r2','count','dx','dy','dz','when','angle','formula','watts','kelvin'). The editor also writes formulas into a box's 'round', 'tilt', 'roll', 'turn', a sphere's 'd', and every corner of a profile's or revolve's 'points' (strings inside arrays, whose keys are "0", "1"). Those keep the old name. A choice parameter's options or a material default naming it are not covered either beyond `material`.
Proof: definition-editor.ts:180-191 (key list), 212-219 and 240 (round/tilt/roll/turn/d written as formulas), 224-236 (points as formulas); JSON.parse reviver is called with the array index as key for array elements.
Effect: rename "largura" to "width" on a definition whose profile corners or tilts use it: the status line turns red with unknown-name problems, objects of it fail to evaluate after saving, and the user has to find every field by hand.
Fix plan: rename by walking every Expr in the definition (the same walk the evaluator uses to read them), not by a key list; or rename inside parsed formulas.
Check: src/elements/object/schema.ts (every Expr field of Part)

### F-0112 · fixed · S3 · src/ui/definition-editor.ts:567 — the object editor's preview leaks its edge lines on every update
Proof (verify): re-read definition-editor.ts:564-611. update disposes each group child's own geometry and material (567-572). Each mesh, however, gets a LineSegments child with a new EdgesGeometry or creaseEdges geometry and a new LineBasicMaterial (579-580), and neither update nor dispose() (602-607) visits children. three.js: dispose "frees the GPU-related resources … call this method whenever this instance is no longer used". So every update leaves one edge geometry and one material per piece on the GPU.
Source: https://threejs.org/docs/pages/BufferGeometry.html
What: Preview.update disposes each mesh's geometry and material, but each mesh has a LineSegments child with its own EdgesGeometry (or creaseEdges geometry) and LineBasicMaterial (579-580), never disposed; dispose() at close (602-611) misses them too. update runs on every slider input event and every field change.
Proof: definition-editor.ts:567-572, 579-580, 602-607; three.js BufferGeometry docs: dispose "whenever this instance is no longer used"; removing from the scene frees nothing.
Effect: dragging a flex slider for a few seconds creates hundreds of edge geometries and materials kept on the GPU; long edits slow the editor and the main 3D (one GPU) down.
Fix plan: traverse the group and dispose every geometry and material (children included) on update and on close.
Check: src/render/pattern-texture.ts previewMesh (shared textures not to dispose)

### F-0113 · fixed · S3 · src/ui/definition-editor.ts:54 — Escape anywhere in the object editor closes it and throws the draft away, unasked
Proof (verify): re-read definition-editor.ts:37-63 and 614. onKey is added on window with capture true (614), so MDN says it runs before any listener on the focused field. On Escape it prevents, stops propagation and calls close() (54-59). close removes the overlay and calls done() without saving (47-53). The draft lives only in the closure (39), not in the store, so nothing asks and nothing can be undone. Whether a native select's open list delivers Escape to the page is browser-dependent and is left to the app test.
Source: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
What: onKey is registered on window in the capture phase (614) and closes the editor on any Escape (54-59). It runs before the fields' own keydown handlers (which stop propagation in the bubble phase, 87-90), so Escape pressed to leave a formula field, a datalist suggestion or a native select's list closes the whole editor. Nothing asks whether to drop the unsaved changes.
Proof: definition-editor.ts:47-59, 614; 87-90 (field keydown in bubble phase); MDN addEventListener: capture listeners on window run before the target's.
Effect: an hour of parts and formulas is lost by one Escape meant to close an autocomplete list; there is no undo (the draft never reached the store).
Fix plan: let fields handle Escape first (listen in the bubble phase or check the target); close on Escape only from the dialog itself, and ask before dropping a changed draft.
Check: other dialogs with window capture Escape handlers
Also: ui/dialog.ts (openProjectDialog, used by all 14 project dialogs) does the same in a milder form: its window capture listener closes the dialog on any Escape (75-79), so Escape meant to close a search list (controls.ts searchSelect, a popup on body whose own Escape handler runs later) or a native select's list closes the dialog behind it as well. Edits there are already in the store, so nothing is lost, but the user lands back on the plan.

### F-0114 · fixed · S4 · src/ui/dialog.ts:106 — the project dialogs are marked modal but Tab walks out of them into the page behind
Proof (verify):
- Tab: re-read dialog.ts:72-106. onKey acts only on Escape and Ctrl+Z/Y. A grep of src finds aria-modal="true" on 18 dialogs but no `inert` and no focus trap, so Tab leaves the dialog. The WAI-ARIA APG modal dialog pattern says Tab and Shift+Tab move only among the dialog's tabbable elements and wrap at the ends.
- Close: close() focuses the plan canvas (100). The APG says "focus returns to the element that invoked the dialog".
Source: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
What: openProjectDialog handles Escape, undo and focus restoring, but nothing keeps Tab inside the dialog layer: no wrap from the last control to the first, no `inert` on the rest of the page (grep finds no inert or trap in src). The definition editor's dialog says aria-modal="true" (definition-editor.ts:506) and the same layer hosts the project dialogs.
Proof: dialog.ts:18-111 (keydown handles only Escape and Ctrl+Z/Y); grep inert|trapFocus in src: none; WAI-ARIA APG modal dialog: Tab and Shift+Tab move focus only among the dialog's elements and wrap.
Effect: keyboard and screen-reader users tab from the last button of the levels or materials dialog into the ribbon and the canvas behind the overlay, where keys act on the hidden drawing (shortcuts fire while a dialog is open).
Fix plan: make the rest of the shell `inert` while the dialog layer is shown (or wrap Tab inside it); return focus to the control that opened the dialog when it closes, as the APG says, instead of always to the plan canvas.
Check: ui/shell.ts (the dialog layer's place in the DOM)
Also: the same layer hosts three dialog frameworks: openProjectDialog (14 dialogs), definition-editor.ts's own (window capture Escape, no backdrop close), and projects-dialog.ts's own (12-131: its own Escape handler, its own focus restore by data-focus, closing focuses the sidebar button). They differ in what Escape, a backdrop click and closing do, and none contains Tab.

### F-0115 · fixed · S4 · src/ui/floors-dialog.ts:41 — floor build-up pictures are cached by name and size only, so they keep old material looks for the whole session
Proof (verify): re-read floors-dialog.ts:24-46. Each picture is drawn from the `materials` passed in (34-35, materialIn and previewMesh with its colour and pattern). The module Map's key is the string `${key}@${w}x${h}` (43), and MDN says a Map compares string keys by value. The same build-up and size therefore hit the first picture whatever the materials are now. Nothing clears the Map.
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
What: `pictures` is a module-level Map keyed `${key}@${w}x${h}` (41-46). The pictures are drawn from the project's materials (materialIn, previewMesh with the material's colour and pattern), but the key does not include them: after a material's colour or pattern is changed, or another project with other materials is opened, the store keeps showing the first pictures.
Proof: floors-dialog.ts:41-46 (key without materials), 25-38 (picture depends on materials); nothing clears the map.
Effect: the floor store shows a white porcelain sample after the porcelain was made grey, until the page is reloaded; the samples disagree with the 3D.
Fix plan: key by the build-up and the JSON (or a version stamp) of the materials it uses; or clear on materials changes.
Check: src/ui/objects-dialog.ts and src/ui/types-dialog.ts (the same picture caches)
Also: ui/presets-dialog.ts:52-57 caches by preset id and size only, though each picture is derived from the tool's current next element (templateOf = nextOf(app, slot) plus the preset's patch, 29) and the project's materials: a preset pictured once keeps the next element's width, material and so on of that moment for the session, while Place uses the current ones.
Also: ui/objects-dialog.ts:70-80 shows the right way: pictures in a WeakMap keyed by the materials array and the definition object (both immutable in the store), so a material edit or a definition edit makes new pictures and old ones are collected.

### F-0116 · fixed · S4 · src/ui/i18n.ts:1614 — about 95 messages per language belong to the removed areas, and live messages still promise them
Proof (verify): re-read i18n.ts:1605-1624. 'tool.cloud', 'rib.s.tool.cloud', 'cmd.addCloud' and 'cmd.updateCloud' belong to the revision clouds removed in step 1, and a grep of src outside i18n.ts finds none of them. The mats.* physics keys are still read, by materials-dialog.ts:109 (that is F-0117, the physics section still shown). This re-check covered the cloud block and the physics block only. The "about 95" count is from the read phase and was not recounted here. Keys never read are dead text.
Source: https://en.wikipedia.org/wiki/Dead_code
What: both dictionaries keep keys no code reads (grep outside i18n.ts finds none, and the dynamic `rib.place.${tool}`, `rib.s.${id}`, `pal.show/hide.${category}` builders cannot reach them): walk (view.walkSoon, pal.walk, ctx.walkHere, rib.s.view.walk, rib.ctx.walkHere), tour (pal.tour, rib.s.view.tourEdit), points (pal/ctx/cmd addPoint, updatePoint, deletePoint, rib.ctx.addPoint, rib.s.view.points), rules (cmd.updateRule, resetRules, addRule, deleteRule, updatePack, importPacks, rib.s.rules.edit/report), schedules and sheets (rib.s.view.schedules/sheets, cmd.addSheet…deleteViewport, rib.p.documents), exports (rib.s.file.exportGlb/Dxf/Obj/Ifc, rib.p.export, rib.s.view.image, rib.s.file.printPlan), clouds and tags (tool.cloud, rib.s.tool.cloud, cmd.addCloud/updateCloud, cmd.addTag/updateTag, tool.tag, rib.s.tool.tag, rib.place.cloud/tag), services (layer.services, pal.show/hide.services, cmd.addMep/updateMep, rib.s.mep.point.* ×23, rib.s.mep.run.sys_* ×12, rib.s.autoRoute, cmd.autoRoute, rib.s.services.open, rib.s.servicesCheck/Size, rib.p.servicesCalc/water/drainage/otherServices, rib.place.mepPoint/mepRun), simulation (rib.s.sim.open, cmd.setSimulation), approval, budget (cmd.setCub…setStages), lot, terrain and site (rib.s.terrain.add, cmd.addTerrain/updateTerrain/addSpot, rib.place.spot, rib.s.site.edit, rib.s.siteLocal, cmd.setSite), tool.soon, tool.slab, panel.modulation. Live messages still describe removed features: mats.note ("in the GLB"), draw.note ("where printing starts"), vcb.scaleTip and ovr.note/ovr.roomsNote ("on paper"); the export names (export.*, schedule.col.wall) are still read by every kind's dead exportName (F-0047).
Proof: i18n.ts 14-16, 76, 301-302, 680-691, 937, 961-966, 983-986, 1016, 1334, 1343, 1346, 1353, 1364-1365, 1379-1381, 1396-1398, 1448, 1452, 1479-1482, 1614-1716, 1724, 1753, 1820-1827 and the same in pt (2103-…, 3703-3805, 3909-3916); grep of every key outside i18n.ts: only export.* (kinds' exportName), schedule.col.wall (kinds/wall.ts:40) and meas.arcDxf (kinds/measure.ts:40, a DXF word for an arc label).
Effect: the owner's step 1 asked that the removed areas leave the app; the step's i18n sweep missed a block of ~95 keys ×2 that nobody can see, and the visible notes tell the user about GLB export and printing that no longer exist.
Fix plan: delete the unread keys in both languages; reword mats.note, draw.note, vcb.scaleTip, ovr.note, ovr.roomsNote to what the app does now; rename meas.arcDxf to what it means.
Check: src/elements/contract.ts (exportName with F-0047)

### F-0117 · fixed · S3 · src/ui/materials-dialog.ts:109 — the materials dialog still shows the simulations' physics section, and the roof panel its thermal covering
Proof (verify):
- Materials dialog: re-read materials-dialog.ts:105-131. It shows five physics fields under "Physics (for the simulations)" (i18n.ts:1618). A grep shows physicsOf and DEFAULT_PHYSICS read only in materials-dialog.ts and physics.ts, and `.physics` only there and in validation (project-file.ts:186, commands.ts:14). Nothing in the app uses the values.
- Roof: kinds/roof.ts:45-46 and 100 draw the roof in its covering's material, so the field is a real model setting. Only its label "Covering (thermal)" (i18n.ts:327, 2416) and the comment at roof/fields.ts:45 name the removed thermal check. Correction to the title: the roof field stays, and its wording is fixed.
Irrelevant information shown to the user goes against aesthetic and minimalist design.
Source: https://www.nngroup.com/articles/ten-usability-heuristics/
What: every material in the materials dialog shows "Physics (for the simulations)" with conductivity λ, density ρ, specific heat c, vapour resistance μ and "Wi-Fi loss of a wall", a "from the table" note, back/set buttons, and, when none, "No physics: the simulations leave out the walls of it until they are set". The roof panel shows "Covering (thermal)" and its thickness. The simulations, the thermal check and the Wi-Fi map left the app (tag escopo-completo-2026-10-28); only the data had to be kept.
Proof: materials-dialog.ts:109-130; i18n.ts:1618-1628, 3707-3717 (texts naming the simulations); roof/fields.ts:45-55 (label roof.covering "Covering (thermal)", already noted in F-0036's comment Also); docs/prompt-escopo-fundamental.md (Simulações sai; dados guardados).
Effect: the user edits five numbers per material and a roof covering that nothing in the app uses, under labels that name a feature that is gone; the dialog is twice as long as it needs to be.
Fix plan: keep the physics and covering values in the data (carried untouched) but take their fields out of the dialog and the roof panel until the simulations come back.
Check: src/elements/material/physics.ts, src/elements/roof/schema.ts (the data stays)

### F-0118 · fixed · S4 · src/elements/kinds/measure.ts:89 — the repair message for dropped special dimensions is a bare word
Proof (verify): re-read measure.ts:80-91, where dropped is 'fix.droppedMeasures'. A grep of 'fix.dropped' in i18n.ts shows every other kind's message as a sentence with {count}, while this one is 'measures' (1499) and 'cotas especiais' (3588). The repair report then reads one word, with no count and no reason. Error messages should describe the exact problem.
Source: https://www.nngroup.com/articles/error-message-guidelines/
What: every kind's `dropped` key is a sentence with {count} ("{count} beams with invalid data … were dropped"); measures point at 'fix.droppedMeasures', whose text is just "measures" / "cotas especiais".
Proof: kinds/measure.ts:89; i18n.ts:1499 ('fix.droppedMeasures': 'measures'), 3588; compare 375, 397, 430.
Effect: opening a file with a broken angular or radius dimension reports "measures" (or "cotas especiais") with no number and no verb.
Fix plan: "{count} special dimensions with invalid data or on a deleted level were dropped" in both languages.
Check: src/io/project-file.ts (how dropped messages are filled)

### F-0119 · fixed · S4 · src/ui/i18n.ts:3462 — one thing has two or three names in the Portuguese interface
Proof (verify): re-read the pt dictionary.
- Room: 'tool.room' is "Criar cômodo" (2118), while the ribbon says "Colocar ambiente" (3462) and "separador de ambiente" (3467).
- Floor: 'tool.floor' is "Criar piso" (2119), but 'rib.place.floor' is "Colocar laje" (3463).
- Curtain wall: 'tool.curtain' is "Parede-cortina" (3300), but its ribbon label is "Pele de vidro" (3301).
- Decimal point: the editor's note asks for a "ponto decimal" (3154), and exprOf (definition-editor.ts:33) takes only `\d+(\.\d+)?` as a number, so "0,5" is stored as a formula string.
Different words for the same thing break consistency and standards.
Source: https://www.nngroup.com/articles/ten-usability-heuristics/
What: the same element or action is named differently depending on where it appears: rooms are "cômodo" in tools, panels and hints but "ambiente" in the ribbon's place labels and panel ("Colocar ambiente", "Ambientes e áreas", "separador de ambiente"); a floor is "piso" (tool.floor "Criar piso") but "laje" in the ribbon ("Colocar laje"); a curtain wall is "Parede-cortina" (tool, panel), "Pele de vidro" (ribbon button) and "Cortinas de vidro" (store); Scale is "Escalar" everywhere but "Escala" on its ribbon button. The object editor's notes ask for a decimal point ("ponto decimal", "0.5") while every other field takes the Brazilian comma ("2,5").
Proof: i18n.ts pt: 2118, 2119 vs 3462, 3463, 3467, 3088; 3300, 3301, 3687; 2717 vs 3038; 3154, 3202 vs 2936; definition-editor.ts:33 (exprOf accepts only a point).
Effect: the user cannot tell whether "Colocar laje" and "Criar piso" are the same tool, or where "Pele de vidro" lives in the panel; a value typed "0,5" in the object editor is taken as a formula string.
Fix plan: one term per concept in pt (cômodo, piso, parede-cortina, Escalar) and the comma accepted in the editor's numbers as in every other field.
Check: src/ui/definition-editor.ts (exprOf), src/elements/object/formula.ts (decimal comma)

### F-0136 · fixed · S4 · src/elements/room/commands.ts:90 — the "usable layer stack" rule is written four times with different tests
Proof (verify): the same rule is written four times:
- layers/stack.ts:14 (finite and > 0);
- wall/geometry/shape.ts:49 (Number.isFinite && > 0);
- kinds/floor.ts:56 (finite and > 0, on load);
- room/commands.ts:90 (setFloorLayers), which checks only `!(l.thickness > 0)`.
Infinity > 0 is true while Number.isFinite(Infinity) is false (MDN). So a layer of Infinity passes the command, and the floor holding it is refused as invalid on the next read (floor.ts:56).
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite
What: layers/stack.ts:14 (stackProblem) wants a finite thickness above zero; wall/geometry/shape.ts:49 repeats it; kinds/floor.ts:56 checks the same for floors on load; room/commands.ts:90 (setFloorLayers) checks only `> 0`, so a layer of Infinity is accepted by the command and then refused by the floor's own validity when the file is read. The test header (tests/elements/layers/stack.test.ts:1) still says floor types will use the stack "later".
Proof: stack.ts:14; shape.ts:49; kinds/floor.ts:56; room/commands.ts:90; tests/elements/layers/stack.test.ts:1-2.
Effect: one rule, several homes (RC1); a floor build-up the panel accepts can be dropped as invalid on the next open.
Fix: src/elements/layers/stack.ts:1-3, 11-18 (layerThicknessOk: a number, finite, above zero; stackProblem uses it), src/elements/wall/geometry/shape.ts:5, 50 (shapeOf asks stackProblem), src/elements/room/commands.ts:4, 84-92 (setFloorLayers asks stackProblem: Infinity is refused, as the file reader refuses it), src/elements/kinds/floor.ts:22, 57 (the floor's check on reading uses layerThicknessOk), src/io/project-file.ts:39, 198 (a fifth copy found there, the wall type's check on reading, now layerThicknessOk), tests/elements/layers/stack.test.ts:1-2 (header no longer says floors "later").
Fix source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite (false for Infinity, -Infinity and NaN, no coercion: the one test of a buildable thickness)
Verified by: re-read src/elements/layers/stack.ts:1-20, re-read src/elements/wall/geometry/shape.ts:1-55, re-read src/elements/room/commands.ts:1-8, re-read src/elements/room/commands.ts:82-104, re-read src/elements/kinds/floor.ts:18-59, re-read src/io/project-file.ts:36-41, re-read src/io/project-file.ts:190-201, re-read tests/elements/layers/stack.test.ts:1-6; npx tsc --noEmit passes. Single thicknesses of an element (a floor's own thickness, a roof's) are a different value, not a layer stack, and keep their own checks.
Fix plan: setFloorLayers (and shape.ts) call stackProblem; the floor validity uses the same check; update the test header.
Check: src/ui/floors-dialog.ts (what it passes to setFloorLayers), src/elements/kinds/floor.ts

### F-0137 · fixed · S3 · src/io/project-file.ts:281 — one bad optional field in a saved element drops the whole element on opening
Proof (verify): re-read project-file.ts:277-284. keep() returns only the elements whose `ok` passes (281), and the rest are counted as dropped (282). kinds/room.ts:53-54 checks the optional `use` against ROOM_USES and the optional `height` as finite and > 0 inside valid. So a room with an unknown use, from a newer build or a hand edit, fails as a whole and is dropped with its name, number and finishes, although only the optional field was bad. The robustness principle, "be liberal in what you accept", argues for dropping the bad field and keeping the element.
Source: https://en.wikipedia.org/wiki/Robustness_principle
What: reading checks each element with its kind's `valid` and keeps only those that pass (keep, 277-284; 398 for every registry kind). `valid` also checks optional fields, so a room whose `use` is not in ROOM_USES, or whose own height is 0, fails, and the whole room is dropped with its name, number and finishes (kinds/room.ts:53-54). The same holds for any kind with optional fields. The repair message says only that "rooms with invalid data were dropped".
Proof: project-file.ts:277-284, 396-405; kinds/room.ts:46-55; tests/elements/room/commands.test.ts:40-48 asserts that an unknown use or a zero height empties the rooms list.
Effect: a file edited by hand, or saved by a newer build with a new room use, loses whole rooms (and so the floors made from them) on opening. A missing optional value would lose less than the element.
Fix plan: per kind, repair what can be repaired before validating: drop the optional field that is bad (use, height, finishes) and report a "fixed" count; drop the element only when a required field is bad. Update the test to expect the room kept without the bad field.
Check: src/elements/kinds/*.ts (optional fields in valid), src/elements/registry.ts (where a per-kind repair could live)
Also (F-0137, for walls): tests/elements/wall/join-overrides.test.ts:117-119 asserts that a wall whose optional end join is unknown ('bevel') is dropped whole (droppedWalls), and with it every door and window it hosts (dropped as having no wall). Dropping the unknown join would keep the wall with an automatic join. tests/io/project-file.test.ts:106-111 asserts the same for a wall whose optional top is malformed ({kind: 'level'} without offset).

### F-0138 · fixed · S3 · src/elements/wall/geometry/footprint.ts:102 — walls meeting at one point that the sector solver cannot make exact stay unjoined and overlapping, and the tests accept up to one scene in ten
Proof (verify): re-read footprint.ts:85-111 and sectors.property.test.ts:113-167. When resolveSectors or goingThrough returns null, complexJoin is reported and the junction absorbs nothing (102-105). By the comment at 85-86, its joins then "stay" and go to the ordinary corner, node, crossing and abutment passes. In the property suite, a complexJoin scene returns early (119, 135), and fast-check counts a predicate returning undefined as a pass. So none of the overlap, gap or coverage checks run on those scenes, and the last test (162-167) accepts up to 10 % of them.
Correction to What: the walls are not necessarily left square. They fall back to the pairwise join passes (node.ts squares only in the cases cited), and whether those overlap is untested. The app test must look at a star of walls.
Source: https://fast-check.dev/docs/core-blocks/properties/
What: at a junction (three or four walls crossing, or three to six ends at a point), footprint.ts calls resolveSectors / goingThrough; when that returns nothing it reports complexJoin and leaves every wall there square, as drawn (101-104; node.ts:55 does the same past four ends without sectors, and node.ts:91, 105 for ends the passage cannot take). The property suite only requires that more than 90 % of random scenes be split (sectors.property.test.ts:162-167), so up to 10 % of ordinary junctions (angles ≥ 20° apart, 8–35 cm walls) may stay overlapping with only a warning. Arcs never use sectors (node.ts note).
Proof: footprint.ts:101-104; join/node.ts:55, 91, 99-105; tests/elements/wall/sectors.property.test.ts:119, 135, 162-167 (complexJoin scenes skipped and only bounded).
Effect: a user drawing a star of walls, or a third wall into a crossing, can get overlapping squares at the point. This matches the reported breaks "overlaps without warning" and "wall gone at a 3-end node" (reports/breaks/RELATORIO.md); which share it has must be measured, not assumed.
Fix plan: in verify, read sectors.ts to find which exactness checks refuse (the scenes the suite skips with the fixed seed); fix the solver so every scene with arms ≥ 20° apart is split, then tighten the test to 100 %. If some configurations are truly impossible, state them in the spec and show the warning on the plan at the point.
Check: src/elements/wall/join/sectors.ts (resolveSectors, goingThrough exactness), src/elements/wall/join/node.ts, reports/breaks/RELATORIO.md
Blocker: the fix needs the scenes the sector solver refuses (resolveSectors returns null), and those are known only by running tests/elements/wall/sectors.property.test.ts with its fixed seed or by drawing stars of walls in the app: in phase fix nothing may be run (the skill's hook), and the owner's rule is no test suites. Reading sectors.ts:81-120 gives the three refusals (arms on top of each other, a corner past an arm's far end, a dividing line outside its gap) but not which real scenes hit them, so any change to the solver now would be a guess. The refusal is already said: footprint.ts:102-104 reports complexJoin and the pairwise passes join the walls. To check in the app test (a star of walls, a third wall into a crossing) and to fix from what it shows.
Tried: read footprint.ts:85-111 (refusal → complexJoin warning, pairwise passes kept) and sectors.ts:78-120 (the refusal cases and the fallbacks: widest arm taking in a corner, a passing wall thickest first); researched the property-based testing page; no edit made.
Source: https://fast-check.dev/docs/core-blocks/properties/
Fix: src/elements/wall/join/sectors.ts (splitSectors, around: a corner of an obtuse gap past either arm's far end steps across at the centre, as one past the miter limit did; a passage 2° off straight of unlike walls refused its whole point); tests/elements/wall/sectors.property.test.ts now asks every scene split. Branch worktree-revisao-interface, 627f8b9; measured with the suite's own generators (not run as a suite): 10,000 scenes of three seeds, no refusal (6 of 2,000 stars before), no overlap or coverage fault.

### F-0139 · fixed · S3 · src/elements/wall/type-fields.ts:27 — the default storey height 2.8 m and the "level not found" fallback are written by hand in 14 places
Proof (verify): a grep of src for the literal 2.8 finds it used as the storey height or the level fallback in 16 places, more than the title's 14:
- the default level: document.ts:177;
- the fallback `{ elevation: 0, height: 2.8 }`: document.ts:292, 316, and kinds/curtain.ts:72, column.ts:46, stair.ts:49, roof.ts:44, beam.ts:81, stair/well.ts:11;
- the fallback `?.height ?? 2.8`: frame.ts:275, next-element.ts:84, room-ui.ts:100, view-ui.ts:213;
- a "fixed" top: wall/fields.ts:278 and type-fields.ts:27;
- a scene minimum: app.ts:393.
The other matches are object-library parameter ranges and a units sample, a different meaning. Changing the default means editing 16 literals, the risk a named constant removes.
Source: https://en.wikipedia.org/wiki/Magic_number_(programming)
What: the ground level's height (document.ts:177) is the only definition of 2.8. But every element that cannot find its level falls back to `{ elevation: 0, height: 2.8 }`, each with its own literal: document.ts:292 and 316, frame.ts:275, next-element.ts:84, view-ui.ts:213, room-ui.ts:100, kinds/curtain.ts:72, stair.ts:49, roof.ts:44, beam.ts:81, column.ts:46, stair/well.ts:11. app.ts:393 uses 2.8 as a minimum. Switching a wall type's top to "fixed" sets 2.8 whatever the levels' heights (type-fields.ts:27), and so does wall/fields.ts:278 (F-0086).
Proof: the grep of `\b2\.8\b` over src lists these lines; document.ts:177 is the single source the others should read.
Fix: src/app/document.ts:54-57 (LEVEL_HEIGHT 2.8 and NO_LEVEL { elevation 0, height LEVEL_HEIGHT }, the one place), 182, 297, 321; src/elements/kinds/stair.ts:17, 50; roof.ts:14, 44; curtain.ts:13, 73; column.ts:11, 47; beam.ts:11, 82; src/elements/stair/well.ts:4, 11 (each `levelOf(doc, id) ?? NO_LEVEL`); src/app/frame.ts:25, 270-275 and src/app/view-ui.ts:9, 211-213 (the level or NO_LEVEL, so elevation and height both come from it); src/app/next-element.ts:9, 88, src/app/room-ui.ts:5, 100, src/app/app.ts:65, 395, src/elements/wall/fields.ts:5, 278, src/elements/wall/type-fields.ts:9, 28 (LEVEL_HEIGHT). The 16 literals of the proof all read the constant now; the other 2.8 in src are object-library parameter ranges and a units sample (other meanings). The elevation fallback `?.elevation ?? 0` (app.ts, input.ts, geometry.ts, kinds floor/note/railing/room, section-drawing) is the same value as NO_LEVEL.elevation and was left as written.
Fix source: https://en.wikipedia.org/wiki/Magic_number_(programming) (a named constant: one place to change, the reason written once)
Verified by: re-read src/app/document.ts:50-58, re-read src/app/document.ts:180-183, re-read src/app/document.ts:294-323, re-read src/app/document.ts:74-75, re-read src/app/document.ts:177-180, re-read src/elements/kinds/stair.ts:15-17, re-read src/elements/kinds/stair.ts:48-51, re-read src/elements/kinds/roof.ts:14, re-read src/elements/kinds/roof.ts:42-45, re-read src/elements/kinds/curtain.ts:11-13, re-read src/elements/kinds/curtain.ts:71-74, re-read src/elements/kinds/column.ts:9-11, re-read src/elements/kinds/column.ts:45-48, re-read src/elements/kinds/beam.ts:9-11, re-read src/elements/kinds/beam.ts:80-83, re-read src/elements/stair/well.ts:1-13, re-read src/app/frame.ts:25, re-read src/app/frame.ts:268-276, re-read src/app/view-ui.ts:8-9, re-read src/app/view-ui.ts:210-213, re-read src/app/next-element.ts:6-9, re-read src/app/next-element.ts:86-89, re-read src/app/room-ui.ts:3-5, re-read src/app/room-ui.ts:99-100, re-read src/app/app.ts:65, re-read src/app/app.ts:394-396, re-read src/elements/wall/fields.ts:5, re-read src/elements/wall/fields.ts:276-282, re-read src/elements/wall/type-fields.ts:1-30; npx tsc --noEmit passes
Effect: in a project whose storeys are 3.00 m, a type or wall switched to "fixed" becomes 2.80 m. An element left on a deleted level (F-0057) is drawn at elevation 0 with 2.80 m, silently. A change to the default storey height must be made in 14 places (RC1).
Fix plan: one exported DEFAULT_LEVEL (or levelOrDefault(doc, id)) in document.ts used by every fallback; "fixed" starts from the current level height (or the wall's current height, as F-0086 asks).
Check: src/app/document.ts (levelOf), every file listed above

### F-0140 · fixed · S4 · src/render/plan-view.ts — a selected short wall is hidden under its own number tag
What: the tag "Parede N" is drawn at the middle of a selected wall with an opaque background; at the usual plan zoom a wall shorter than the tag (1,5 m at 1:50 fit) disappears under it, and a 3 m wall shows only its end.
Proof: seen in the app on 2026-10-29 (headless, 1920x1080): walls 6 (1,50 m) and 7 (3,00 m) selected; the zoomed capture shows the tags over them and no wall body under "Parede 6".
Effect: the user selects a wall and loses sight of it.
Fix plan: place the tag beside the wall (off its face, as dimensions stand off) instead of over its middle.
