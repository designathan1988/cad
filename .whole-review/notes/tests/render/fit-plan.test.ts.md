# tests/render/fit-plan.test.ts
Lines: 50
Summary: Tests that framing the plan fits the part of the canvas no panel covers. Four cases:
- With nothing covered, the box fills 70 % of the limiting side and is centred.
- With a 290 px drawer on the right of a tablet, the whole box stays left of the drawer, centred in what remains.
- With a sheet over the bottom 45 % of a phone, the box stays above the sheet.
- With the browser over the left 260 px and the panel over the right 290 px, the box sits between them.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: fit the canvas part no panel covers
- 3-4 imports: vitest and fitPlan
- 6-11 a 10 × 5 box and toScreen() (centre plus offset × scale, y down)
- 13-19 1000 × 800: scale 70 px/m (the width limits: 0.7 × 1000 / 10 m); centre at (500, 400)
- 21-29 720 × 900 with right 290: both x within [0, 430], centred at 215
- 31-38 330 × 700 with bottom 315: both y ≤ 385, centred at 192.5
- 40-49 1230 × 640 with left 260 and right 290: x within [260, 940], centred at 600; suite closes (line 50 blank)

## Contracts, state and data flow
- fitPlan(box, size, covered?) returns a centre and a scale. The caller measures what covers the canvas (drawer, sheet, browser). The test covers framing only, not selection; the jump on selecting (keep-in-view) is in the app tests (tests/app/keep-in-view.test.ts) and is to be watched at 880 px in apptest.

## Depends on / used by
- uses: src/render/plan-view (fitPlan)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect : panel rectangles relative to the viewport, which the caller uses to measure the covered insets (lines 21-48)
