# src/app/keep-in-view.ts
Lines: 51
Summary: Pure helpers that keep the selection seen in the plan: the free part of the view (not covered by panel, sheet or drawer, less margins and room above for the float bar), a zoom-out factor to fit a box in it, and the smallest pan that brings a box into it.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: the selection's screen box kept inside the free part with room above; the smallest move; a box too large keeps its top left in view
- 5 import of the Insets type (render/plan-view.ts)
- 7-12 ScreenBox: left, top, right, bottom (screen px)
- 14-22 freeOf: left = covered.left + margin, right = width − covered.right − margin, top = margin + room above, bottom = height − covered.bottom − margin (can be inverted when the cover is larger than the view)
- 24-34 fitFactor: the smaller of free width / box width and free height / box height; ≥ 1 → 1, else 95 % of it. A free part of zero or negative size gives 0, a negative factor, or NaN (0/0 for a zero-size box): F-0025
- 36-50 keepInView: per axis, a box before the near edge moves to it; past the far edge moves back by what sticks out but never its near edge past its limit; `|| 0` turns -0 and NaN into 0

## Contracts, state and data flow
- Callers must make sure the free part has a positive size (or handle factors ≤ 0).

## Depends on / used by
- uses: render/plan-view.ts (Insets type)
- used by: app/view-ui.ts (keepSelectionInView, frame/zoom: to check), tests/app/keep-in-view.test.ts

## Problems found (finding IDs)
- F-0025 fitFactor can return 0, a negative factor or NaN

## To check in other files
- app/view-ui.ts: what it does with fitFactor's result (a zoom by a negative factor flips the plan)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/min : NaN if any argument is NaN (line 32)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_OR : x || 0 gives 0 for NaN, 0 and -0 (line 49)
