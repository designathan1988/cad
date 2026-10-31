# tests/app/stacked.test.ts
Lines: 59
Summary: Tests of walls standing off the face of the wall below: a 15 cm wall over a 20 cm one on the same axis steps 2.5 cm, and its shift (2.5 cm out) aligns it; the same when drawn the other way; flush after the move; flush when drawn on the exterior face; not "stacked" when across, beside or on the same level.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the step on the façade and the aligning move; exterior face on the right of the direction
- 4-7 imports: vitest, document, stackedSteps, moveWalls
- 9-19 wall helper (level, type, reference line), two levels, doc builder
- 21-33 below 20 cm and above 15 cm: step 0.025, shift (0, −0.025)
- 35-39 the upper wall reversed: the same step
- 41-46 moved by the shift through moveWalls: no step
- 48-51 drawn on its exterior face at −0.1: flush
- 53-58 across, beside, same level: none; the suite closes

## Contracts, state and data flow
- Pure; exercises tools/edit moveWalls (F-0101/F-0102 apply to the move, not to these single-wall cases).

## Depends on / used by
- uses: src/app/document, src/app/stacked, src/tools/edit
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#tomatchobject : a subset of properties of the computed step (line 29)
