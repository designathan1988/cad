# tests/app/wall-under-roof.test.ts
Lines: 90
Summary: Tests of walls whose top follows the roof or reaches another level: a gable-end wall under a 30 % gable reaches the ridge (3.7 m), its blocks follow the slope and never pass the roof; the roof drops its gable infill where such a wall closes it; with no roof the wall keeps the level's height; a wall up to a level reaches its floor plus offset, becomes fixed when that level is deleted, and both rules read back from a file.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: toLevel and roof top rules; slope-following blocks; gable infill; level deleted
- 5-11 imports: vitest, document (wallHeights), geometry, roof schema, planeAt, deleteLevel, project file
- 13-31 a 10×6 outline and its 30 % gable roof (ridge 0.9 m over 2.8), wall helper with optional top rule, doc builder
- 33-65 a gable-end wall under the roof: height, slope-following blocks, gable infill left out, no roof → level height
- 67-89 a wall up to an upper level: 3.5 m; fixed 3.5 after deleting the level; file round trip without fixes

## Contracts, state and data flow
- Pure derivations and commands; F-0013 (roof covers cached by the roof only) is about the cache, not these values.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/roof/schema, src/elements/wall/geometry/under-roof, src/elements/level/commands, src/io/project-file
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Gable : the triangular portion of a wall between the edges of two roof slopes, which the gable-end wall closes (lines 53-58)
