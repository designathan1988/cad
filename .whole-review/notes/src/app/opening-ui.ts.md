# src/app/opening-ui.ts
Lines: 163
Summary: What the door and window tool reads from the screen: the wall under the cursor as an Aim (station, side, other openings, the stops of walls meeting it), the same along a given wall for the keyboard, the rule in words, the temporary dimension of the opening being placed, and the straight wall under a 3D ray (aimed at the wall's middle plane, not its cut mesh).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the wall under the cursor as an Aim and the placing dimension; read-only
- 4-15 imports: units, vector, opening schema/derive, wall arc/offset/shape, opening-tool (Aim, ruleBase), i18n, document (Doc, wallHeights), geometry type, wall-stops
- 17-18 OPENING_PREVIEW_ID: the preview opening's id in the derived geometry
- 20-21 REACH_PX 6: reach past a wall's faces
- 23-37 aimAt: per wall of the level, its shape (skipped when invalid), reference length, arc or line
- 38-48 station and offset: along the line and across it; on an arc, the angle from its start in the sweep's direction wrapped to [0, 2π) times the radius, the offset from the radius (sign by turn)
- 49-53 between the ends only; the miss outside the faces; within REACH_PX px and nearer than the best
- 54-60 the Aim: wall, length, station, side by offset vs centre, the other openings (preview excluded), mpp, stops, occupied spans; the nearest wall's
- 61-75 aimAlong: the Aim at a station clamped to the wall, side left (keyboard placing)
- 77-82 occupiedOf: per meeting wall, the span between its two stops across this one
- 84-91 ruleText: "d from the wall face" when measured from a meeting wall's face (base > 0), else the rule kind's short text with its distance
- 93-111 ruleGuide: the preview opening on a straight host; the rule's base (the stop it is measured from)
- 112-119 the dimension's span: base → start jamb (fromStart), end jamb → length − base (fromEnd), the referenced opening's jamb → this one's (fromOpening); none for others
- 120-130 the side: away from a door's swing, a window's exterior face; the points along the wall; the text; the dimension and the measure field's place
- 132-138 doc of wallUnderRay: aim at the wall's middle plane so the preview's own hole does not make the aim flicker; straight walls only
- 139-162 wallUnderRay: per straight wall of the levels, the ray meets the middle plane (skipped parallel or behind); the nearest; between the ends; between wallHeights bottom and top (absolute elevations, unlifted)

## Contracts, state and data flow
- The ray's z is the scene's: when the 3D view lifts levels (app.lift ≠ 0, e.g. an exploded view), comparing it to unlifted wallHeights would miss; input.ts:480 passes only the current level. To check in scene-3d/app.lift.
- An arc's station uses Math.sign(sweep); a zero sweep is a straight wall, so arcOf would be null (no 0 sign reached).

## Depends on / used by
- uses: elements/opening (schema, derive), elements/wall/geometry (arc, offset, shape), tools/opening-tool.ts, app/wall-stops.ts, app/document.ts, ui/units.ts, ui/i18n.ts
- used by: app/input.ts (aimAt, wallUnderRay, OPENING_PREVIEW_ID), app/app.ts / frame.ts (ruleGuide, ruleText, aimAlong: to confirm)

## Problems found (finding IDs)
- none

## To check in other files
- app.lift and scene-3d rayAt: is the ray in lifted coordinates while wallHeights is not
- tools/opening-tool.ts: how the Aim's stops/others make the rule (root cause 2: an opening placed next to another gets a fromOpening link)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sign : 1, −1, ±0, NaN (line 43)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/atan2 : range −π..π, y first (line 44; wrapped to [0, 2π) on 45)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder : % keeps the dividend's sign, hence (a % m + m) % m (line 45)
