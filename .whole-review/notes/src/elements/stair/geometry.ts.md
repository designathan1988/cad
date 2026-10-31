# src/elements/stair/geometry.ts
Lines: 213
Summary: A stair's or ramp's layout as plan polygons with heights (steps, landings, ramp runs with a rising top), its walking line, handrails, side lines for guardrails, the riser count and height. Also the first flight's size and the well (the united footprint) the floor above opens.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: steps and landings laid out from kind, height and tread; equal risers nearest STAIR_RISER; pure
- 5-7 imports: polyclip-ts union, vector ops, schema constants and Stair
- 9-17 StairPart: ccw polygon, top above the stair's bottom, landing flag, ramp top function
- 19-32 StairSolid: stair, parts, walk line, rails, sides, bottom, height, risers, riser
- 34-51 rect (from the middle of the near side along u and across v, ccw) and ccw (shoelace, reversed in place)
- 53-58 cornerRisers (landing 1, winders 3 in an L, 6 in a U) and firstFlight (the split or half, at least one step after the corner)
- 60-78 stairWell: union of every part (polyclip), the largest outer ring, closing point dropped, collinear points removed, made ccw
- 80-92 stairSolid start: height (≥ 0.2 or the level's), risers nearest STAIR_RISER (≥ 2), riser, tread, width, direction, turn side
- 93-105 flight: n steps of depth t (tops up to the last riser: F-0083), walking line, two handrails rising with it
- 106-133 ramp: grade ≥ 0.5 %, runs each rising at most RAMP_RISE, run length rise/grade, landings between, rails along both sides
- 134-152 winders: three steps fanned 30° each about the inner corner of a w × w square; outer handrail
- 153-189 straight; L with winders; U with winders (two sets); L with a square landing; U with a landing as wide as both flights, back beside the first
- 190-210 spiral: wedges of `tread` depth on the walking line two thirds out from a 10 cm post, centred a radius ahead so a stair turned spiral stays in place; one outer handrail
- 211-212 the solid; rails dropped when the stair has none, sides kept

## Contracts, state and data flow
- Pure. Treads per flight equal risers (F-0083). Landing edges have no handrail (rails only along flights).
- The well (stairWell) is what the floor above loses (floors' cutOut in room/derive.ts).

## Depends on / used by
- uses: polyclip-ts, core/vector, stair/schema
- used by: elements/kinds/stair.ts (plan, 3D, sections), stair/fields.ts (StairSolid, firstFlight), app/geometry (wells through floors), railing well/side paths

## Problems found (finding IDs)
- F-0083 (S3): one tread too many per flight

## To check in other files
- src/elements/stair/schema.ts: STAIR_RISER, RAMP_RISE, RAMP_LANDING values

## Sources
- https://cznull.com/calculators/construction/stairs/ : "Treads equal risers minus 1" (lines 94-105, 154)
- https://github.com/luizbarboza/polyclip-ts : union returns a MultiPolygon, rings self-closing (lines 69-74; opened for room/derive.ts, same use)
