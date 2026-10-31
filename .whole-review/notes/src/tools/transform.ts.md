# src/tools/transform.ts
Lines: 285
Summary: Moving, copying, rotating, scaling and mirroring the selection: the Transform values (map, mirror flag, factor), the remapping of openings' rules, hinges and groups, placing an opening selected without its wall onto the wall its middle lands on, the transform in place (walls through edit.ts transformWalls keeping joins, or disjoined) or as copies under new ids (mirrored: the walls' chosen end joins swapped with their ends), the registry kinds by their own mapping, whether a selection can be transformed, copying onto another level, and copies in series.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-7 header: what goes along; joins kept in place unless disjoined; scale never changes thicknesses or opening sizes; mirror swaps ends
- 9-18 imports: registry helpers, rooms carried, Doc and geometry types, vector, opening schema, aimAt, transformWalls, ruleAt, withSwappedJoins (wall/flip.ts)
- 20-27 Transform: map, mirror, factor
- 29-59 translation, rotation (about a pivot, CCW), scaling (from a base by k), reflection (across a line: 2(v·u)u − v)
- 62 otherEnd: start ↔ end
- 64-81 mapRule: distances scaled; mirrored, fromStart ↔ fromEnd and fromOpening's toward flipped; aligned's edge flipped; ids remapped for copies
- 83-93 mapOpening: id, wall, rule; the hinge to the other end when mirrored
- 95-96 LONE_MPP 1 cm per pixel: the reach used to find a wall for a lone opening
- 98-113 placeLone: the opening's middle mapped, a wall found there (aimAt), a rule read with ruleAt, swing from the side when on another wall
- 115-119 mapSpacing: fixed gaps scaled, anchor flipped when mirrored
- 121-131 mapGroup: ids, members, spacing; `between` kept only when its bounding walls come along, swapped when mirrored
- 133-137 TransformResult: doc and selection
- 139-170 transformSelection setup: the selection as it is (an axis goes alone: F-0051), lone openings placed, rooms going (wholly surrounded or selected), `going` for registry kinds
- 172-191 in place: walls disjoined (mapped alone; a mirror swaps ends and joins) or transformWalls (rigid for a move/turn, swap for a mirror) with the moved walls' joins swapped when mirrored (F-0087); openings on moved walls remapped, lone ones re-hosted; groups remapped; registry kinds by mapKinds (a dimension's end/jamb swapped there, kinds/dimension.ts)
- 193-207 copies: fresh ids for walls, openings, groups; lone copies
- 209-221 the copied walls (ends and chosen joins swapped when mirrored: F-0087), openings and groups appended
- 222-230 the selection after: the copies; registry kinds copied by copyKinds
- 232-242 canTransform: a wall, an opening, or a kind element whose `moved` changes it
- 244-264 copyToLevel: a zero-translation copy (lone openings and every-level kinds left out), the new walls and kinds set to the level, rooms renumbered from that level's last
- 266-284 copiesInSeries: n copies at k·step (or step/n when dividing) from the originals

## Contracts, state and data flow
- Pure; one Doc out for one dispatch. In place, the selection stays; copied, the copies are selected.
- No length check on the step: a zero copy duplicates (F-0104; copyToLevel relies on zero).

## Depends on / used by
- uses: elements/registry, app/carry, app/document, app/geometry, core/vector, elements/opening/schema, app/opening-ui (aimAt), tools/edit (transformWalls), tools/opening-tool (ruleAt), elements/wall/flip (withSwappedJoins)
- used by: app/modify-ui.ts, app/app.ts (preview while moving), app/selection-ui.ts, app/context-actions.ts, app/actions.ts

## Problems found (finding IDs)
- F-0087 fixed (mirrored walls' joins swapped with their ends)
- F-0104 (Also): the zero step is not refused here by design (copyToLevel)
- F-0051 fixed (no walls carried along a selected axis)

## To check in other files
- src/elements/registry.ts: mapKinds/copyKinds for dimensions on mirrored walls

## Sources
- https://en.wikipedia.org/wiki/Reflection_(mathematics) : reflection across a line with unit direction u is 2(v·u)u − v, determinant −1 (orientation reversed, hence the swapped ends) (lines 48-59, 177, 214)
- https://help.autodesk.com/cloudhelp/2015/ENU/Revit-Model/files/GUID-E8F03F7F-8886-4F92-B821-D2C500CEB64F.htm : "Moves With Grids", a property the user sees and sets: no hidden carry (F-0051)
