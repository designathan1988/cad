# tests/app/view-3d.test.ts
Lines: 57
Summary: Tests of the 3D view's levels: which are shown (all, below, current; a missing level shows all), the exploded lift per level, the cut at the current level's own cut height (lifted when exploded, none when off), and reading stored view settings with defaults for anything invalid (style, quality, brightness, sun, x-ray).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: three levels at 0, 2.8, 5.6; says the cut is 1.2 for all (the first has 1.5: F-0135 Also)
- 4-6 imports: vitest, Level type, view-3d functions
- 8-12 three levels listed out of order, the first with cutHeight 1.5
- 14-22 shownLevels for the three modes and a missing level
- 24-31 liftOf: once per level below, none when not exploded
- 33-40 cutAt: 1.2 on the ground, 4.3 on the first, plus the gap exploded, null when off
- 42-56 readView3D: defaults filled, valid values kept, invalid ones defaulted, undefined → default

## Contracts, state and data flow
- Pure functions of the levels and the view settings.

## Depends on / used by
- uses: src/app/document (type), src/app/view-3d
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0135 (Also): the header's cut height

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#tomatchobject : subset matching of the read settings (lines 47-51)
