# tests/elements/opening/mullions.test.ts
Lines: 91
Summary: Tests of a window's mullions and transoms placed where they are wanted (phase 5), on a 1.20 × 1.20 window centred on a 4 m wall:
- A mullion 0.30 from the jamb gives a narrow and a wide pane, each glass set 4 cm in from its pane's edges.
- A transom 0.40 up splits each pane into two rows.
- In plan, the mullion is a line across the wall at x 1.75.
- A two-leaf casement opens each pane by its own width.
- With no mullions the panes are equal. A mullion past the frame, or within 5 cm of another, is left out.
- fitStyle drops mullions from sliding windows and doors, sorts them, sets the leaf count, and caps them at 5.
- isOpeningStyle refuses non-numeric or negative positions.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: the phase-5 requirement and the window worked by hand (clear opening x 1.45 to 2.55, height 1.05 to 2.15)
- 6-12 imports: vitest, document, deriveGeometry, openingParts, newOpening/OpeningStyle, fitStyle/isOpeningStyle/paneRows/paneSpans, symbolLines
- 14-26 a 4 m wall, a fixed one-leaf style with a 5 cm frame, `placed` (derived through the document), `glass` (each glass part's x and z extent, sorted by x then z)
- 28-37 mullion 0.3: two panes, glass x [1.49, 1.71] and [1.79, 2.51]
- 39-51 plus transom 0.4: four panes; row glass z [1.09, 1.41] and [1.49, 2.11]; paneRows [1.05, 1.45] and [1.45, 2.15]
- 53-57 the plan line across the wall at x 1.75
- 59-67 casement with two leaves: leaf lines square to the wall, lengths 0.3 and 0.8 (sorted with the default string sort, correct for these values)
- 69-79 paneSpans: two equal panes; mullions 0.32 and 1.08 dropped (within 5 cm)
- 81-90 fitStyle: sliding window and swing door lose mullions and transoms; [0.9, 0.3, 0.6] is sorted and gives 4 leaves; 7 mullions capped at 5; isOpeningStyle true, then false for 'a' and for −1; suite closes (line 91 blank)

## Contracts, state and data flow
- Mullion and transom positions are measured from the clear opening's start and bottom. fitStyle normalises them (sorted, capped, removed where they do not apply), silently.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/opening (parts, schema, style, symbol)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#tomatchobject : toMatchObject checks a subset of properties; toHaveProperty checks a key exists (lines 83-84)
