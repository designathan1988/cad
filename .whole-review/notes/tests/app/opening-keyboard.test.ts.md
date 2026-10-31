# tests/app/opening-keyboard.test.ts
Lines: 32
Summary: Tests placing a door or window without the pointer: with a wall selected the tool aims at its middle (centred); a typed 1 places it 1 m from the start, Enter places it centred; a missing wall gives no aim.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: the tester's K2; aim at the selected wall's middle; typed distance from the nearer end; Enter centred
- 5-9 imports: vitest, document, deriveGeometry, aimAlong/OPENING_PREVIEW_ID, openingTransition/ruleAt
- 11-12 a lone 5 m wall
- 14-20 the aim: the wall, its length, its middle; centred rule
- 22-26 typed 1 → fromStart 1 (no stop base: the case F-0042 Also names); click → centred
- 28-30 an unknown wall: null
- 31 the suite closes

## Contracts, state and data flow
- Pure tool transitions over an aim built from the geometry.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/app/opening-ui, src/tools/opening-tool
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0042 (Also): this test asserts the centred-preview meaning on a lone wall

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#tomatchobject : a subset of properties is enough (line 18)
