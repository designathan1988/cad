# src/elements/wall/flip.ts
Lines: 81
Summary: Flipping walls (Revit's flip arrows): start and end swap so the layers go to the other side of the reference line. Hosted openings keep their world place and orientation (rules counted from the other end, hinge and swing swapped), groups keep their members in place, and what is named by an end (chosen corner joins, dimensions held by the wall or its openings' jambs, an arc's measures) keeps its physical place under the other name (F-0087).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: layers to the other side of the reference line; hosted things, joins, dimensions and measures stay in the world
- 7-11 imports: Doc, Command, opening types, Wall/WallId, DimAnchor
- 13 other: start ↔ end
- 15-29 flipRule: fromStart ↔ fromEnd (same distance), fromOpening's side swapped, aligned edge swapped (centre stays), centred and group unchanged
- 31-36 flipOpening: rule flipped, hinge to the other jamb name, swing to the other side name (the same physical jamb and side)
- 38-40 flipSpacing: a fixed group's anchor swapped
- 42-50 withSwappedJoins (exported: flip and mirror): joins.start ↔ joins.end, nothing when the wall has none
- 52-65 flipWalls: known ids; the openings they host; a dimension's end held by a flipped wall gets the other end name with its offset negated (the wall's left turns over), one on a hosted opening's jamb the other jamb, offset negated
- 66-80 the walls swapped (bulge negated, joins swapped), openings and groups remapped, dimensions re-held, an arc's measures at 1 − t

## Contracts, state and data flow
- Pure. Everything that names a wall's or an opening's start/end is remapped here (F-0087 fixed). An arc measure's face (exterior/interior) keeps its name: the face it names is now on the other side, as the layers are.

## Depends on / used by
- uses: app/document (type), core/store (type), opening/schema (types), wall/schema (types), dimension/schema (type)
- used by: the flip action (actions.ts / wall handles' flip control); tools/transform.ts (withSwappedJoins for mirrors)

## Problems found (finding IDs)
- F-0087 fixed

## To check in other files
- none

## Sources
- https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-FDBDB1AF-6750-4C00-A87A-C9DF191F04BC.htm : the wall flips about its location line; nothing else changes on its own (cutouts keep their orientation) (F-0087)
