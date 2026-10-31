# tests/elements/wall/types.test.ts
Lines: 84
Summary: Tests of wall type commands (ref/chat.txt:12, the tester's D5).
- A new type is added as given. A type with no layers, a zero layer or a repeated id is refused.
- Duplicating copies the layers, top and base under a new id and name. The name "(2)" is supplied by the caller (F-0122).
- Editing a type's layers changes every wall of that type at once (20 → 30 cm) and is undone in one step.
- A blank name, no layers or a negative thickness changes nothing; the same name makes no undo step.
- The name is trimmed. Top and base can be set on the type and removed again.
- A type in use, or the last type, is not deleted, and the reason is reported.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: thickness and layers always derived from the type; one undo step per edit
- 5-9 imports: vitest, document, deriveGeometry, createStore, wall type commands
- 11-24 a wall helper, a document with one concrete wall, a layer helper, widthOf (the y extent of the derived pieces)
- 26-37 add as given (the last in the list); refused: empty, 0 thickness, duplicate id (same doc)
- 39-43 duplicate equals the source with the new id and name
- 45-52 updateWallType to 0.3: the derived width follows; undo returns to 0.2
- 54-61 refused patches return the same doc; the same name too
- 63-71 ' Concrete 22 ' stored trimmed, fixed top 1.1 and base 0.1; both set to undefined are removed (no baseOffset key)
- 73-83 typeDeleteBlocker 'inUse' and the delete refused; an unused type has no blocker and is removed; a single type is 'last'; suite closes (line 83; 84 blank)

## Contracts, state and data flow
- Wall types are document data. Walls hold only the type id, and geometry derives thickness from the type. Commands refuse invalid input by returning the same document.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/core/store, src/elements/wall/types
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none new (the "(2)" naming: F-0122)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trim : trim removes white space and line terminators from both ends (lines 56, 64-66)
