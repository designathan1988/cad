# src/elements/dimension/commands.ts
Lines: 85
Summary: Permanent dimension commands: add one; set a line's offset (drag); set several lines' distance keeping each side; add many (auto dimensions) as one step; lock at the current length or unlock; make chains equal (EQ) or not.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: commands on permanent dimensions, each one undo step
- 3-7 imports: Doc, Command, deriveGeometry, placeDimension, Dimension
- 9-12 addDimension: appended
- 14-21 setDimensionOffset: finite and different → set; else unchanged
- 23-38 setDimensionDistance: a finite distance ≥ 0 on each dimension's own side (negative offsets stay negative)
- 40-44 addDimensions: several as one step (none → unchanged)
- 46-67 lockDimensions: lock → the geometry derived and each dimension's current length stored as locked (one whose end is gone left as it is); unlock → the field removed
- 69-84 setDimensionsEqual: every dimension of the chains touched gets eq true, or loses it

## Contracts, state and data flow
- A locked or EQ dimension drives the model: settleDimensions (run on every dispatch by the store wrapper, F-0008) moves walls/openings to keep these values. These links are made by the user and should be shown (the lock/EQ marks: to check in kinds/dimension.ts).
- ids.includes per dimension is a linear search per item (small lists).

## Depends on / used by
- uses: app/geometry.ts (deriveGeometry), elements/dimension/anchor.ts, schema.ts, core/store.ts
- used by: app/kind-tools.ts (addDimension), app/select-drag.ts (setDimensionOffset), app actions (auto, lock, EQ), elements/kinds/dimension.ts fields

## Problems found (finding IDs)
- none

## To check in other files
- elements/dimension/constraints.ts: how locked/eq values move the model (F-0008)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes : SameValueZero, a linear search from the start (lines 30, 53, 73)
