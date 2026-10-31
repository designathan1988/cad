# src/elements/stair/schema.ts
Lines: 56
Summary: Stair and ramp data: kind (straight, L, U, spiral, ramp), the first step's front-edge middle and climbing angle, width, tread, turn side, height, handrails, ramp grade, well, first-flight split and winders. Also the constants: well reach, NBR 9050 ramp values, defaults, riser target and handrail height.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: steps set by height (risers near 17.5 cm); kinds; landing at the turn; a handrail each side; placed by the first step's front edge
- 6 import: the Point2 type from core/vector
- 8-9 STAIR_PREFIX and StairKind
- 11-38 Stair: id, level, kind, at, angle, width (spiral: radius less the post), tread, turn, height, railing, grade, well, split, winders
- 40-41 WELL_REACH: 0.3 m between the stair's top and the floor it reaches
- 43-46 ramp grade 8.33 %, 0.80 m rise per run, 1.20 m landings (NBR 9050)
- 48 isStairId: whether an id has the stair prefix
- 50-55 defaults: width 1.0, tread 0.28, riser 0.175, handrail 0.90 m (F-0084)

## Contracts, state and data flow
- Pure data. The riser target sets the riser count (geometry.ts:83), and each flight then gets as many treads as risers (F-0083).

## Depends on / used by
- uses: core/vector (type)
- used by: stair/commands, fields, geometry; elements/kinds/stair.ts; railing (hosted on stairs); presets; app/geometry (wells)

## Problems found (finding IDs)
- F-0084 (S4): one handrail at 0.90 m

## To check in other files
- none

## Sources
- https://lawinsider.com/pt/clause/rampas-e-escadas : handrails at 0.70 and 0.92 m, extended 0.30 m at the ends (line 55)
- https://sienge.com.br/blog/como-projetar-e-calcular-uma-rampa/ : 8.33 % with up to 0.80 m per segment (lines 43-46; opened for presets.ts)
