# src/elements/guide/commands.ts
Lines: 17
Summary: Guide commands: add a guide; clear every guide of a level (no step when there are none).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: each one undo step; guides deleted with deleteElements like the rest
- 3-5 imports: Doc, Command, Guide
- 7-10 addGuide: appended
- 12-16 clearGuides: the level's guides removed (filter makes a new list); none → unchanged

## Contracts, state and data flow
- Pure commands; a dimension anchored to nothing from a guide is unaffected (guides hold nothing).

## Depends on / used by
- uses: app/document.ts, core/store.ts, elements/guide/schema.ts (types)
- used by: app/guide-ui.ts (addGuide), actions (edit.clearGuides)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter : a new shallow array of the passing elements, the original unchanged (line 15)
