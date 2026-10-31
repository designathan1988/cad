# src/app/context-actions.ts
Lines: 72
Summary: Which context actions (ids) the right-click menu and the floating bar offer for a selection: by what is selected (nothing, several, a guide, a wall, a door, a window, a room, anything else), Move first when the Modify tools can take it, six at most.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the actions that fit the kind of element, most used first, 3 to 6
- 4-6 imports: Doc type, canTransform (tools/transform.ts), canMerge (tools/split.ts)
- 8-35 ContextId: the 27 ids the context menu knows (a set of its own, separate from the action ids of actions.ts: 'move' here is 'edit.move' there, 'delete' is 'edit.delete', 'frameSelection' is 'view.frameSelection'…)
- 37-44 contextIds(doc, selection, levelId?): walls among the selection; merge when exactly two mergeable walls; clear guides when the level shown has guides; nothing selected → draw wall, add a note, frame all, then clear guides or commands
- 45-52 Move when canTransform; several selected → move, merge, distribute (all openings of one wall), frame, clear, delete
- 53-56 one selected: a guide → move, section, properties, clear guides, delete; `common` = frame, properties, delete
- 57-63 a wall → move, flip, edit type, select similar, properties, delete; a door → move, open/close, flip hinge, flip swing, properties, delete; a window → move, open/close, centre, select similar, properties, delete
- 64-69 a room → move, add floor and/or ceiling when missing, properties, delete
- 70-71 anything else → move, select similar, frame, properties, delete

## Contracts, state and data flow
- Pure. The ids are a second vocabulary for the same commands the action list names (goal's root cause 1, with context-menu.ts holding their look and keys): F-0003.

## Depends on / used by
- uses: tools/transform.ts (canTransform), tools/split.ts (canMerge)
- used by: app/context-menu.ts (contextEntries), tests/app/context-actions.test.ts

## Problems found (finding IDs)
- F-0003 (the separate id vocabulary is part of it)

## To check in other files
- app/context-menu.ts: how each id maps to a command and its key

## Sources
- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html : ['merge'] as const is readonly ['merge'] with the literal type (lines 40-44, 51, 67)
