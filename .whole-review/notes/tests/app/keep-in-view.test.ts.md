# tests/app/keep-in-view.test.ts
Lines: 52
Summary: Tests of keeping the selection in view: a box inside the free part does not move; boxes past the bottom, right, under the panel and sheet, behind the browser drawer or too near the top (room for the floating bar) move by just what they need; a box larger than the free part keeps its top-left in view; and fitFactor zooms out a too-large box to fit with 5 % to spare.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: how far the plan moves so the selection's box lies where nothing covers it
- 4-5 imports: vitest, fitFactor/keepInView
- 7-10 a 1000×600 view, nothing covering, 16 px margin and 48 px room above, box helper
- 12-36 keepInView cases (inside, shrunk window, right edge, panel and sheet, drawer, top room, larger than free)
- 38-51 fitFactor: 1 when it fits; 0.475 for a box twice the free height or width (the tester's P07)

## Contracts, state and data flow
- Pure arithmetic; the app pans (and zooms) the plan by these on a new selection (view-ui.ts:179-190), which is where any "the view jumps when selecting" behaviour comes from at narrow widths (the owner's 880 px complaint): to be watched in the app test.

## Depends on / used by
- uses: src/app/keep-in-view
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none new (F-0025 covers fitFactor's edge values)

## To check in other files
- apptest at ~880 px: selecting a door or window must not move the drawing unless it was under the drawer

## Sources
- https://vitest.dev/api/expect.html#tobecloseto : toBeCloseTo with 12 digits for the factors (lines 46-49)
