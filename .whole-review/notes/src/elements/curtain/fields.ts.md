# src/elements/curtain/fields.ts
Lines: 87
Summary: The curtain wall's panel fields: length (readout), height, base offset, each direction's division (mode spacing/count/max with its spacing or panel count), mullion, depth, panel kind, and the cells count.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header comment: height and foot, divisions, frame and panels
- 4-9 imports: lengthText, Field, t, CurtainPatch, CurtainSolid, GridRule
- 11-13 CurtainFieldActions: updateCurtains
- 15 MODES: spacing, count, max
- 17-19 curtainFields: ids; same(): one value or "varies"
- 20-40 a direction's mode select: switching computes the new value from the FIRST selected curtain's length/height and line count (panels or spacing) and applies that rule to all selected
- 41-50 its spacing (min 10 cm) when no selected curtain counts; set with the FIRST curtain's mode for all (a selection mixing spacing and max ends with all in the first one's mode)
- 51-63 its panel count when all count, at least 1, rounded
- 64-67 length readout; height (min 10 cm); base offset
- 68-71 both directions; mullion and depth (min 1 cm, 3 decimals)
- 72-83 panel: glass or opaque
- 84-86 cells: the panels count (or "varies")

## Contracts, state and data flow
- Multi-selection values are derived from the first item (lines 33-37, 49) and applied to all: the same pattern as F-0046 (F-0048).

## Depends on / used by
- uses: ui/units.ts, ui/fields.ts (type), ui/i18n.ts, elements/curtain/commands.ts, geometry.ts, schema.ts (types)
- used by: elements/kinds/curtain.ts (fields)

## Problems found (finding IDs)
- F-0048 curtain fields apply the first selected curtain's mode and spacing to all

## To check in other files
- elements/curtain/geometry.ts: verticals/horizontals lines

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer : computed keys { [key]: v } evaluated when the object is made (lines 31-32, 49, 61)
