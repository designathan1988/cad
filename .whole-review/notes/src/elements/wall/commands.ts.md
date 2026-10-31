# src/elements/wall/commands.ts
Lines: 71
Summary: Commands on walls: add several, delete (only the walls list; unused by the app), update fields on several (values equal to the type's dropped), replace walls by id (a move or stretch with its followers), and reset top or base offset to the type.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: each returns a new document, one undo step
- 3-5 imports: Doc, DocWall and ownValuesOnly; Command; WallId
- 7-10 addWalls: appended in one step; none gives the same doc
- 12-19 deleteWalls: filters the walls only (openings, dimensions and rooms untouched); called only by a test (F-0085)
- 21-37 updateWalls: the patch merged then reduced by ownValuesOnly (a value equal to the type's follows the type); JSON comparison; no validation of the patched values here
- 39-53 setWalls: replace walls by id from a list (a Map, last one wins for a repeated id); JSON comparison per wall
- 55-70 resetWallsToType: delete `top` and/or `baseOffset` from the given walls so the type rules again

## Contracts, state and data flow
- Pure. setWalls is how moves and stretches land: select-drag, temp-dims, modify-ui and wall-ui compute the moved walls (with keep-openings etc. through the store wrapper: F-0008).
- No range checks here: fields bound what users type; programmatic callers pass computed values.

## Depends on / used by
- uses: app/document (ownValuesOnly, types), core/store (type), wall/schema (type)
- used by: app/frame.ts:370, 394, wall/fields.ts (updateWalls), select-drag, temp-dims, modify-ui, wall-ui (setWalls), wall-ui (resetWallsToType), the wall tool (addWalls), tests/core/store.test.ts and tests/elements/wall/overrides.test.ts

## Problems found (finding IDs)
- F-0085 (S4): deleteWalls unused and unsafe

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/Map : a Map built from pairs keeps the last value for a repeated key (line 43)
