# tests/elements/stair-well.test.ts
Lines: 116
Summary: Tests of a stair's well and its guardrails.
- The well is the stair's steps and landing united, counter-clockwise; for a U, the two flights side by side.
- The well cuts only the floor the stair reaches; that floor's area loses the well. The stair's `well: false` closes it.
- An L's or U's first flight takes its own split, clamped to at least one step on each side of the landing.
- Winders: an L turns its corner in three steps and a U in six. The result is 16 risers and no landing; the L's three winders fill its 1 m² corner.
- The guardrail round the well goes all the way round except where the stair arrives. It follows the stair when the stair moves, reads back from a file with no fixes, and is held by the stair.
- A guardrail along a floor's edge goes all round the outline, closed, at the floor's top, and moves up when the floor is raised.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: the well through the floor reached, and its guardrail
- 3-15 imports: vitest, document, geometry, railing kind/solid, wellPath, Floor, stair geometry (firstFlight, stairSolid, stairWell), Stair, well helpers, signedArea, project file, FloorSolid
- 17-30 an upper level at 2.8, a stair builder, an 8 × 7 slab on the upper level, docOf
- 32-39 U well: positive signed area; |area| = 2 × (8 × 0.28 + 1) − 0.28
- 41-52 straight stair reaches lvl_up; one well at elevation 2.8, none at 2.0; the slab has one hole, area 56 − 16 × 0.28; well false: no hole
- 54-59 firstFlight: 8 by default, 5 when the split is 5, 14 when the split is 40 (clamped)
- 61-74 winders: 16 parts each, no landing, each part's top one riser above the previous; three L fans sum to 1 m² (reduce with an initial 0)
- 76-84 wellPath round a 2 × 2 square, open from (2, 2) to (1, 2): starts at (1, 2), ends at (2, 2), 5 points
- 86-101 the well railing: moving the stair 1 m moves its first point 1 m; file round trip equal with no fixes; holders [stair id]; suite closes
- 103-115 an edge railing hosted by floor_f: 5 points, closed, bottom 2.8; offset 0.2 raises it to 3; holders [floor_f]; suite closes (line 116 blank)

## Contracts, state and data flow
- Wells and hosted railings are derived from their stair or floor each time. The stair and floor links are explicit, user-made hosts. When the file is read, a railing whose holder is missing is dropped (project-file.ts:401).

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/kinds/railing, src/elements/railing/schema, src/elements/room (schema, derive), src/elements/stair (geometry, schema, well), src/elements/wall/geometry/convex, src/io/project-file
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce : with an initial value the callback runs for every element from index 0 (line 72)
