# src/tools/nudge.ts
Lines: 63
Summary: Moving the selection with the arrow keys by 5 cm (1 cm with Alt), as one document: openings selected alone first detach what was measured from them; the selected walls move with their joins and carry the rooms they wholly surround (an axis moves alone: F-0051); openings on unmoved walls slide along their wall by the step's component along it (group members stay); the registry kinds move by their own move.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: walls with joins and rooms, openings slide along their wall, other kinds move; one undo step
- 5-13 imports: room carry, Doc and geometry types, vector, detachedFrom, deriveOpenings, rule helpers, moveKinds, moveWalls
- 15-20 arrowStep: the four ArrowX keys to a 5 cm / 1 cm step, up is +y; null otherwise
- 22-27 nudge: each selected opening's dependents detached (held by the wall)
- 28-36 the selected walls only (an axis takes nothing on its line along, F-0051); rooms wholly surrounded go with them; walls moved through moveWalls, rooms by moveRooms
- 37-48 openings: selected ones on unmoved straight walls slide by the step along the wall (rule rewritten by slid); group members and arc hosts left
- 49-54 the registry kinds (not rooms already carried) moved by moveKinds on the changed doc
- 56-62 slid: per rule kind (fromStart +, fromEnd −, fromOpening by toward, others → fromStart at the placed start + along) (F-0068 Also)

## Contracts, state and data flow
- Pure: one Doc out for one dispatch. Openings are placed from the doc before the move (deriveOpenings over doc.openings).
- Walls follow edit.ts moveWalls, so F-0101 (near-parallel throw) applies to arrow moves too.

## Depends on / used by
- uses: app/carry, app/geometry (hostsIn), core/vector, opening commands/derive/schema, elements/registry (moveKinds), tools/edit (moveWalls)
- used by: app/input-keys.ts (arrowStep), app/selection-ui.ts (nudge)

## Problems found (finding IDs)
- F-0068 (Also): rule kinds rewritten by hand; group members silently left
- F-0051 fixed (no carrying along a selected axis)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values : ArrowLeft/Right/Up/Down are the key values (older Edge ≤ 16 and Firefox ≤ 36 used Left/Right/Up/Down, out of the supported range) (lines 15-20)
- https://help.autodesk.com/cloudhelp/2015/ENU/Revit-Model/files/GUID-E8F03F7F-8886-4F92-B821-D2C500CEB64F.htm : Revit's "Moves With Grids" is an instance property the user sees and sets (no hidden carry, F-0051)
