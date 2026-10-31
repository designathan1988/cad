# src/elements/dimension/fields.ts
Lines: 55
Summary: The permanent dimension's panel fields: its length (or "lost" when an end is gone, "varies" for several), its line's distance off what it measures, Lock/Unlock and Equal/Unequal actions, and a note when a lock or EQ holds the model.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: the dimension's panel fields
- 3-6 imports: lengthText, Field, t, Dimension
- 8-12 DimensionFieldActions: distance, lock, equal
- 14-16 dimensionFields: the ids
- 17-28 length readout: lost when any end is gone; one value or "varies"
- 29 distance: |offset|, min 0 (the side is kept by the command)
- 30-37 lock/unlock: unlock when all are locked; enabled only when every end resolves
- 38-45 equal/unequal: shown when any is in a chain
- 46-54 a note when a lock or EQ holds the model (which kind is said)

## Contracts, state and data flow
- The locks and EQ are user-made and shown in the panel (a note), as the goal wants links to be.

## Depends on / used by
- uses: ui/units.ts, ui/fields.ts (type), ui/i18n.ts, elements/dimension/schema.ts (type)
- used by: elements/kinds/dimension.ts (fields)

## Problems found (finding IDs)
- none

## To check in other files
- elements/kinds/dimension.ts: whether locks/EQ also show in plan

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/abs : abs(−0) is 0, null coerces to 0 (lines 26, 29)
