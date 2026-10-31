# src/elements/stair/well.ts
Lines: 47
Summary: Stair wells, as in Revit's shaft opening made by the stair. It has the stair's solid on its level, the arrival edge at the top step, the level a stair reaches (nearest floor within 0.3 m of its top), and the wells of the stairs reaching a height, which cut the floors there.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: a stair leaves the floor it reaches open over its steps; floors within WELL_REACH of its top are cut
- 4-7 imports: Doc and Point2 types, stair geometry, Stair and WELL_REACH
- 9-13 solidOfStair: stairSolid with its level's height and elevation (NO_LEVEL from app/document when the level is gone, F-0139; imports at 4 now runtime: levelOf, NO_LEVEL)
- 15-27 arrivalOf: the two ends of the top step's far edge, square to the last walking segment (null without two walk points: at(-2) is undefined)
- 29-35 levelReached: the level whose elevation is nearest the stair's top, if another level and within 0.3 m
- 37-46 wellsReaching: for each stair with a well, its solid; when its top is within 0.3 m of z, its united footprint

## Contracts, state and data flow
- Pure. Floors are not memoised (kinds/floor.ts calls wellsReaching for each floor on every derivation), so every floor rebuilds every stair's solid and its polygon union each time.
- The well follows the stair's footprint, one tread too long (F-0083).

## Depends on / used by
- uses: app/document (type), core/vector (type), stair/geometry, stair/schema
- used by: elements/kinds/floor.ts:63 (wells cut in floors), elements/kinds/stair.ts:121-122 (well railing), elements/kinds/railing.ts:87 (railing path at the arrival)

## Problems found (finding IDs)
- none new (cost noted: floors × stairs solids and unions per derivation)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/at : at(-2) on a one-element array is undefined (lines 17-19)
