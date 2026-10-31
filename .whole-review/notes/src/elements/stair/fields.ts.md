# src/elements/stair/fields.ts
Lines: 153
Summary: The stair and ramp panel fields: kind, ramp grade in the project's slope unit, width, tread, height, readouts (risers and riser height, the Blondel sum, ramp runs), turn side, corner landing or winders, steps before the landing, well, well and side guardrail actions, and handrails yes/no.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: stair fields for ui/fields.ts
- 3-9 imports: slope unit helpers, lengthText, Field, num and t, StairPatch, firstFlight and StairSolid, RAMP_GRADE and StairKind
- 11-17 StairFieldActions: updateStairs; well and side railing makers (null when not possible)
- 19-21 stairFields setup: ids; `same` shows a value when all agree, else "—"
- 22-31 kind select: straight, L, U, spiral, ramp
- 32-44 ramp grade in the project's unit (min 1 in 1:n, 0.5 % otherwise; no max), ramps only
- 45-56 width (min 0.40), tread (min 0.15, stairs only), height (min 0.20)
- 57-59 risers × riser height and Blondel 2h + p (63 cm comfortable), written in hand-made cm (F-0077 Also)
- 60-67 ramp runs: count, rise each (cm by hand), whole length (lengthText)
- 68-81 turn left/right for L, U and spiral
- 82-95 corner: landing or winders (L, U)
- 96-108 split: steps before the landing (rounded), L and U
- 109-120 well through the floor above: yes or no
- 121-138 actions for one stair: guardrail round the well, guardrails on the open sides
- 139-152 the stair's own handrails yes/no

## Contracts, state and data flow
- Data for ui/fields.ts; sets dispatch updateStairs. Slopes stored in percent and converted (ui/units.ts), unlike floors (F-0082).

## Depends on / used by
- uses: ui/units, ui/fields (type), ui/i18n, stair/commands (type), stair/geometry (firstFlight, StairSolid), stair/schema
- used by: the stair kind's panel (elements/kinds/stair.ts) and next-element.ts for the next stair

## Problems found (finding IDs)
- F-0077 (Also): riser, Blondel and ramp rise in fixed cm

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Stairs : Blondel's relation 2 × riser + tread = step length (line 59)
