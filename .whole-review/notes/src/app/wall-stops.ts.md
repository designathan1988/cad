# src/app/wall-stops.ts
Lines: 82
Summary: The stops of a wall: the stations along its reference line where the faces of the other straight walls of its level that touch or cross it meet that line; the nearest stop before/after a station. Doors and windows are measured from these (the face of the wall beside them), which is what ties an opening to a neighbouring wall (root cause 2).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: a door measured from the face of the wall beside it, as on site (the tester's run of 2026-10-25)
- 6-10 imports: vector, referenceLength, wall offset helpers, shapeOf, Doc
- 12-15 MIN_SINE 0.1 (parallel below it); TOUCH 1 cm past the host's face still touching
- 17-22 Stop: station, the meeting wall's id, which of its faces
- 24-27 wallStops: the stations only
- 29-40 wallStopsOf: a straight host's shape, reference length, direction, normal, faces
- 41-47 per other straight wall of the level, not near-parallel
- 48-61 helpers: the station where a line along the other wall crosses the host's reference line; the run along the other wall where its reference line meets the host at an offset
- 62-65 the other wall reaches the host's body (its run between the host's two faces, ± TOUCH): else skipped
- 66-73 its two faces' stations on the host's reference line, strictly inside the host, sorted
- 75-77 stopBefore: the largest stop at or before the station, else 0
- 79-81 stopAfter: the smallest stop at or after the station, else the length

## Contracts, state and data flow
- Stops are derived from OTHER walls' positions: any rule measured from a stop changes meaning when those walls move (keep-openings.ts then rewrites the opening's stored distance to keep the gap): the hidden link of root cause 2 (F-0008).

## Depends on / used by
- uses: core/vector.ts, elements/opening/derive.ts (referenceLength), elements/wall/geometry (offset, shape)
- used by: app/keep-openings.ts (wallStopsOf), app/opening-ui.ts (wallStops, wallStopsOf), app/temp-dims.ts (stopBefore/After), tools/opening-tool.ts (via Aim.stops)

## Problems found (finding IDs)
- F-0008 (the link's source)

## To check in other files
- tools/opening-tool.ts ruleBase: how a stop becomes a rule's distance

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce : with an initial value the callback runs from index 0; empty gives the initial value (lines 76-81)
