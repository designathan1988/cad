# tests/elements/opening/position-fields.test.ts
Lines: 130
Summary: Tests of an opening's position and leaf fields in the panel.
- Position reads as the plan's dimensions do. Past a partition, the fromStart option is named for the wall beside it ("Wall on the left") and the distance is measured from that wall's face (0.50). A typed 0.80 is stored as fromStart 3.90. With no wall between the opening and the start, the field falls back to the wall's start ("Wall end on the left", 3.60).
- A door's swing sides are named by the room on each side: "Kitchen" and "Outside", or "Left"/"Right" with no rooms.
- The hinge is left or right as seen from the room the door opens to, with a note saying from where; opening outward flips it.
- "Centre between walls" puts the door in the middle of its stretch between the partition's face and the wall's end.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: the panel reads like the plan's dimensions (tester's 2026-10-25 report)
- 5-10 imports: vitest, document, deriveGeometry, leafFields/positionFields, newOpening, fieldStates
- 12-21 wall helper (20 cm concrete on its centreline)
- 23-28 a 6 m wall h, partition p at x 3 (faces 2.90 and 3.10), door o fromStart 3.6
- 30-35 fieldsOf: positionFields with a stub actions object whose update reports the patch; fieldStates for the one opening
- 37-44 the rule option label 'Wall on the left'; distance 0.5 from the face
- 46-54 setting the distance field to 0.8 dispatches fromStart 3.9
- 56-64 without the partition: 'Wall end on the left', 3.6; suite closes
- 66-84 a 4 × 3 box with a kitchen: swing labels ['Kitchen', 'Outside']; with no rooms ['Left', 'Right']
- 86-114 hinge options as seen from the kitchen (end = Left, start = Right) and the note 'As seen from Kitchen, facing the door'; swing right flips them
- 116-129 centerBetween is enabled; running it gives fromStart (3.1 + 6)/2 − 0.45; suite closes (line 130 blank)

## Contracts, state and data flow
- The panel's fields are built from the derived geometry (stops, rooms), and its actions dispatch rule patches. Field kinds are narrowed with Extract on the field union.
- These fields are the panel side of RC1 (one option, several homes): the ribbon and the float bar build their own (F-0003, F-0030).

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/opening (fields, schema), src/ui/fields
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://www.typescriptlang.org/docs/handbook/utility-types.html : Extract<Type, Union> keeps the union members assignable to Union (lines 41, 49, 79, 100, 105, 122)
