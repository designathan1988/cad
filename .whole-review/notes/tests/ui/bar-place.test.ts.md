# tests/ui/bar-place.test.ts
Lines: 46
Summary: Tests of where the floating bar goes vertically. It sits just above the selection and moves only past the boxes it would actually cover in its own columns, repeating until it is free. When there is no room above, it goes below the selection. When there is room neither above nor below (the tester's R04/T04, a phone after F), it takes the nearest free place, never on a box in its columns and within the view.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: above the selection, past what it covers in its columns, below when no room
- 5-9 imports; a bar 120 × 36 at x 100; a view 800 high
- 11-14 nothing in the way: 10 px above the selection (454)
- 16-20 a dimension in its columns: 8 px above it; a far label ignored
- 22-26 a dimension and a tag stacked in the same columns: above both
- 28-32 near the top: below the selection, past a dimension there, or 10 px below
- 34-45 R04/T04: handles at the top and bottom edges; y meets neither, stays inside 8 px of both view edges; suite closes (line 46 blank)

## Contracts, state and data flow
- placeBarY is pure: from the bar's size and columns, the selection's span, the boxes to avoid and the view height, it returns a y. This is the same kind of decision a floating-UI flip makes, done by hand for columns.

## Depends on / used by
- uses: src/ui/bar-place
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://floating-ui.com/docs/flip : a floating element flips to the opposite side when its preferred side overflows, falling back to the best fit (lines 28-44)
