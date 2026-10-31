# tests/core/store.test.ts
Lines: 76
Summary: Tests of the document store: each command is one undo step and redo comes back; a no-op command adds no step; a new command clears redo; a fast-check property that any sequence of add/delete/update wall commands undone gives back the very original document; undo/redo labels name the steps.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 imports: fast-check, vitest, newDocument, createStore, wall commands (deleteWalls, which only tests use: F-0085)
- 7-16 wall helper by x
- 18-30 two steps undone and one redone
- 32-37 no-op commands: no undo
- 39-45 a new command clears redo
- 47-63 the property: random command arrays (oneof of three kinds), all undone, the same object back; 200 runs, fixed seed
- 64-74 undoLabel/redoLabel through dispatch, undo, redo
- 75 the suite closes

## Contracts, state and data flow
- The store's identity guarantees (undo returns the exact earlier object).

## Depends on / used by
- uses: fast-check, src/app/document, src/core/store, src/elements/wall/commands
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0085 (context): the only caller of deleteWalls

## To check in other files
- none

## Sources
- https://fast-check.dev/docs/core-blocks/arbitraries/combiners/any/ : fc.oneof picks one of the arbitraries per value, weights default 1 (lines 48-52)
