# src/app/context-menu.ts
Lines: 107
Summary: Turns the context ids chosen by context-actions.ts into runnable entries (label, icon, key, run) for the right-click menu, the floating bar and the ribbon's contextual tab. Its LOOK table holds each id's icon and the action of actions.ts it is; the key shown is that action's current key (the user's, from the keymap), so a key changed in the keys dialog shows here too (F-0003 fixed). Its run table wires each id to an App method or a command.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: the same action has the same name, icon and key in the menu and the float bar; the key is the action list's
- 6-13 imports: newId, distributeOpenings/updateOpening, GROUP_PREFIX, flipWalls, t/MessageKey, IconName, App, ContextId/contextIds
- 15-21 interface ContextEntry: id, label, icon, keys?, run
- 23-55 LOOK: per ContextId its icon and, where one exists, the action id (edit.move … help.commands); ids with no action (flipWall, toggleOpen, flipSwing, centerOpening, addFloor, addCeiling, distribute, properties) show no key
- 57-60 contextEntries(app, openCommands): the selection's ids, the one selected, the opening it is
- 61-98 run per id: Modify tools via startModify; merge; flipWalls command; open the wall types dialog on the wall's type; toggleOpen (switches to 3D first in plan); flip hinge/swing and centre via updateOpening (centre sets the rule 'centered'); add floor/ceiling to the room; distribute the selected openings with equal gaps (new group id); frame selection; properties; clear; delete; draw wall; frame all; clear guides; section at the guide; select similar; add a note / level mark at the point where the menu was opened (captured when the entries are built: contextPoint is set by input.ts only while the menu is built, so the float bar's entries capture null and place at the view's centre)
- 99-106 the action list's current keys by id (app.actionList(), built once per call); the entries for contextIds(doc, ids, level): label ctx.<id>, LOOK's icon, the mapped action's key when it has one, run

## Contracts, state and data flow
- Keys: one source, actions.ts make() → keyOf(id, own, app.keymap). Labels still come from ctx.* message keys, apart from the action list's pal.* labels; run functions still duplicate the actions' wiring (move → startModify('move') in both places, etc.).
- The run functions close over the selection ids at build time; chrome.ts's float bar re-looks the entry up at click time (chrome.ts:448), the menu runs entries built at open time.
- app.actionList() is [] until input.ts wires it: before that, entries carry no keys.

## Depends on / used by
- uses: elements/opening/commands.ts, elements/wall/flip.ts, ui/i18n.ts, app/context-actions.ts, App (actionList)
- used by: app/input.ts (right-click menu), app/chrome.ts (float bar, its cache key now includes the keys; ribbon ctx.*), app/ribbon-tabs.ts (contextTab), tests

## Problems found (finding IDs)
- F-0003 fixed: keys from the action list (the two missing ones, edit.flipHinge H and help.commands Ctrl+K, added to actions.ts)

## To check in other files
- ui/i18n.ts: ctx.* vs pal.* labels for the same command (tests/ui/consistency.test.ts checks some)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures : the IIFEs capture contextPoint's value at build time into a const
- https://www.typescriptlang.org/docs/handbook/utility-types.html : Record<ContextId, …> requires every id (LOOK and run must cover all 27)
- https://en.wikipedia.org/wiki/Single_source_of_truth : other places refer to the master record instead of copying it (the fix)
