# tests/app/wall-heights.test.ts
Lines: 233
Summary: Tests of joined walls of different heights (spec §7.5): each wall sliced at its neighbours' bases and tops, each slice joined only with the walls present; an L of 1 m and 2.8 m, a T with a lower host or a lower stem, a wall on a base offset, walls whose heights do not overlap or only touch (no join); a fast-check property over L, T, X and L+T scenes with random bases and tops (cross-sections equal the plan join of the walls present; volumes equal); and the plan as a section at the level's cut height (cut, below, above, at the cut, per-level cut height, upper level).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: slices joined per height; no join without overlapping heights
- 7-13 imports: fast-check, vitest, document (wallHeights), geometry, computeWallGeometry, area/overlapArea, the test oracle `inside`
- 15-31 P type, wall helper with base and top (fixed height), doc builder, wallsAt (which walls' blocks hold a point at z)
- 33-56 an L of 1 m and 2.8 m: mitre below 1 m, b alone and square above; blocks per wall; no warnings
- 58-77 a T with a lower host, and with a lower stem
- 79-92 a wall on a 1 m base offset: a square below, the mitre above
- 94-115 non-overlapping and touching heights: no join, square ends
- 117-127 the property's height arbitrary and the four scenes
- 129-166 the property: 300 random points per run match the plan join of the walls present; the blocks' volume equals the summed join areas by height band; 60 runs, fixed seed
- 168-173 plan helpers (the plan is a section at the cut height)
- 175-232 cut, below and above walls; the mitre or square ends in plan; walls ending or starting at the cut not cut; a 0.5 m cut height; the upper level's cut above its own floor

## Contracts, state and data flow
- Pure; a property test with a fixed seed (replayable) and an own LCG for sample points.

## Depends on / used by
- uses: fast-check, src/app/document, src/app/geometry, src/elements/wall/geometry (footprint, convex), tests/elements/wall/oracle
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://fast-check.dev/docs/core-blocks/runners/ : fc.assert runs a property and throws a readable error on failure; extra parameters such as numRuns go with it (lines 132-163)
- https://fast-check.dev/docs/tutorials/quick-start/read-test-reports/ : a failure reports a seed and path to replay it; a fixed seed makes runs reproducible (line 162)
