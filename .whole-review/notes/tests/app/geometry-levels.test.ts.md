# tests/app/geometry-levels.test.ts
Lines: 44
Summary: Tests that walls join only within their level: a wall upstairs over the ground floor's bottom wall leaves every ground wall's pieces and the warnings unchanged, and is itself one whole piece without warnings.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: joins per level only
- 4-7 imports: vitest, document, deriveGeometry, addLevel
- 9-18 wall helper with a level
- 20-27 ground: a 4×3 rectangle crossed by a wall at x = 2
- 29-43 the upper wall: ground pieces and warnings equal before and after; the upper wall one piece, no warnings

## Contracts, state and data flow
- Pure derivation; guards the per-level join discovery.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/level/commands
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#tohavelength : asserts a .length equal to the number (line 40)
