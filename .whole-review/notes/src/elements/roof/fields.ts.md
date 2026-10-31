# src/elements/roof/fields.ts
Lines: 88
Summary: The roof panel fields: form, slope in the project's slope unit (percent, degrees or 1:n), overhang, thickness, base offset, covering material and thickness, parapet (flat roofs), a not-convex warning, and one slope field per side for a single roof.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: roof fields for ui/fields.ts
- 3-8 imports: slope unit helpers, Field, t, RoofPatch, ROOF_COVERING and RoofKind, RoofSolid
- 10-14 RoofFieldActions: updateRoofs and the project's materials
- 16-18 roofFields setup: ids; one roof when one is selected
- 19-28 form select: flat, shed, gable, hip
- 29-41 slope in the project's unit (min 0, no max: F-0080 Also), hidden on flat roofs; shown from the first sloped side
- 42-44 overhang (first side's), thickness (min 0.01), base offset
- 45-55 covering material select (comment points at the removed Simulations: F-0036 Also) and covering thickness
- 56-65 parapet, on flat roofs only
- 66 a note when a roof is not convex
- 67-87 one slope field per side for one sloped roof, 0 making a gable

## Contracts, state and data flow
- Data for ui/fields.ts; sets dispatch updateRoofs. Slopes are stored in percent and converted for display and typing (ui/units.ts:112-125; degrees clamped to 89.9°).
- The covering select lists only existing materials; a covering whose material was deleted (F-0058) shows no matching option.

## Depends on / used by
- uses: ui/units, ui/fields (type), ui/i18n, roof/commands (type), roof/schema, roof/geometry (type)
- used by: the roof kind's panel (elements/kinds/roof.ts) and next-element.ts for the next roof

## Problems found (finding IDs)
- F-0080 (Also): no max on slope fields
- F-0036 (Also): comment about the removed thermal simulation

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/tan : tan near 90° is a huge finite number, never Infinity (through slopeTyped, lines 40, 82)
