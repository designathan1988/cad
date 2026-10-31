# src/elements/railing/schema.ts
Lines: 101
Summary: Guardrail data and helpers. A guardrail is a path on a level with height, base offset, optional host (a stair's well, one side of a stair or ramp, or a floor's edge) and infill. The file also has the constants, the widest opening of each infill, the path length, the path round a stair's well (open where the stair arrives) and the post positions.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: guardrails along a path; stairs' handrails are their own; a guardrail may follow a stair's side
- 6 import: distance and Point2 from core/vector
- 8-12 prefix, RAILING_HEIGHT 1.10 m (NBR 9077), POST_SPACING 1.2 m
- 14-31 Railing: id, level, points (two or more), height, base offset, host (stair well or side, or a floor's edge; stored points are only the last ones), infill
- 33-38 RailingInfill; baluster spacing 0.10 and size 0.02 (8 cm gap under NBR 14718's 11 cm); rail size 0.04
- 40-46 railingGap: glass 0; balusters 0.08; rails (the default when unset) height/2 − 0.04, 0.51 m at 1.10 m (F-0078)
- 48-50 isRailingId; railingLength (sum of segments)
- 52-83 wellPath: the well edge nearest the top step's middle; projections of the step edge's ends on it; the path from the open stretch's end round the well back to its start
- 85-100 postsOf: corners and evenly spaced posts per segment (ceil(length / 1.2)), foot heights interpolated by `rise`, the last point added

## Contracts, state and data flow
- Pure. A hosted railing's stored points are a cache; its path comes from its host (kinds/railing.ts; F-0053).
- The gap readout (fields.ts) and the 11 cm limit live here, but no warning uses them (F-0078).

## Depends on / used by
- uses: core/vector
- used by: railing/commands, fields, elements/kinds/railing.ts, stair code (wellPath), kind-tools (defaults), presets

## Problems found (finding IDs)
- F-0078 (S3): rails infill (the unset default) leaves 51 cm openings without a warning

## To check in other files
- src/elements/stair: infill of the railings it adds

## Sources
- https://sienge.com.br/blog/guarda-corpos-devem-atender-a-nbr-14718/ : NBR 14718: height at least 1.10 m, clear openings at most 0.11 m, a closing up to 0.45 m against climbable horizontals (lines 9-10, 33-46)
