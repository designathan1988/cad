# tests/elements/wall/arc-fields.test.ts
Lines: 33
Summary: Tests of an arc wall's radius in the panel (the tester found radius, chord and length read-only): for a half circle on a 2 m chord the radius is a number field showing 1 m, its least value is half the chord (1), and setting it calls updateRadius; a straight wall has no radius field.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the radius editable, at least half the chord, keeping the ends
- 4-7 imports: vitest, DocWall/newDocument, wallFields, fieldStates
- 9-10 a half-circle arc (bulge 1) on a 2 m chord
- 12-24 a stub action set (ten callbacks written out in full); the radius field is a number, value 1, min 1 (a function or a value), set(2) passes 2 to updateRadius
- 26-32 bulge 0: no radius field; suite closes (line 33 blank)

## Contracts, state and data flow
- wallFields(doc, actions).more holds the extra fields; the radius is converted to a bulge by the action, keeping the ends. The stub action object is written out twice (lines 15, 28): every new action in wallFields forces edits here, one sign of the field/action duplication (RC1).

## Depends on / used by
- uses: src/app/document, src/elements/wall/fields, src/ui/fields
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Circular_segment : R² = (c/2)² + (R − h)², so a radius below half the chord has no arc; equality is the half circle (lines 19-21)
