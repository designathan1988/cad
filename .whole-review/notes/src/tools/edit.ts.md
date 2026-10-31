# src/tools/edit.ts
Lines: 318
Summary: Pure wall edits that keep joins: transforming selected walls (move, turn, scale, mirror) with unselected neighbours following (ends at a moved end follow it or slide along their own line to the moved line; ends on a moved body slide to the new line; every slide guarded against near-parallel lines and bounded by the move: F-0101), moved walls' ends kept on their hosts' bodies, stretching an end (only the corner at it follows), rotating about a pivot, changing the reference line or the wall type with a chosen face kept in place, finding which face a room is against, and stretching along the wall's own line.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: ends at moved ends follow; ends on a moved body slide; only reference lines change, the join engine does the rest
- 6-12 imports: Doc types, tolerances, vector helpers, wall schema types, exteriorOffset, arcOf, wallThickness
- 14 Ends type: a wall's start and end points
- 16-23 onBody: p on segment a–b, away from both ends by POINT_TOLERANCE, within POINT_TOLERANCE across
- 25-32 NEAR_PARALLEL 0.05 and meet() (exported, also split.ts's corner): line intersection, null below that sine
- 34-46 SLIDE_LIMIT 4 and slideOnto(p, other, next, moveBy): meet, and the meeting kept only within 4 × the wall's own move of p (else null): the one test for every slide (F-0101)
- 48-49 movedBy: the larger of a wall's two ends' moves
- 51-52 onLine: q on the line through a and b
- 54-64 keptDirection: same direction (cross ≤ 1e-9, dot > 0), i.e. a move, not a turn
- 66-106 follow: moved walls take their targets; for others each end: at a moved end → slideOnto the new line (only when the direction was kept and both straight) or the mapped end; else on a moved body → slideOnto the new line, else it stays (F-0101); linear find per moved wall (F-0102)
- 108-147 transformWalls: map every selected end (swap for mirrors); non-rigid → follow; rigid → a moved straight wall's end at a corner with a left-behind wall goes where its new line meets that wall's line (slideOnto, bounded); then follow with lines and keepOnHosts
- 149-182 keepOnHosts: a moved wall's end that was on a host's body (within the host's thickness) slides along the moved wall's line to the host's line (meet: none when about parallel), kept only if the hit lies along the host
- 184-186 moveWalls: transformWalls with a translation, rigid
- 188-204 stretchEnd: the dragged end moves (refused under MIN_WALL_LENGTH); ends of same-level walls at the old end go to `to`; Ts on the body stay
- 206-216 rotateWalls: turn about a pivot, rigid
- 218-235 changeReferenceLine: the line moved across by the difference of exterior offsets so the faces stay; then the field changed
- 237-251 shiftWall: across by a shift along the left normal (an arc's radius scaled about its centre), neighbours follow (non-rigid)
- 253-254 KeptFace: exterior, interior, middle or null
- 256-279 changeWallType: new total thickness; the line shifted so the kept face (or middle) stays; the type id set
- 281-309 roomFace: probes 5 cm past each face at ¼, ½, ¾ of the length; room on one side → that face, both → middle, none → null
- 311-317 stretchAlong: the end moved to the cursor's foot on the wall's own line

## Contracts, state and data flow
- Pure; returns the whole walls list in doc order. Openings are not touched here (they follow their walls by stations elsewhere).
- Joins are by coincident ends within POINT_TOLERANCE and same level only.
- Mirror swaps ends, which keeps an arc's bulge sign right (orientation reversed twice).
- A slide refused (near parallel, or further than 4 × the move) leaves the corner end on the mapped point (it moves with the wall) and the T end where it was: no end flies off.

## Depends on / used by
- uses: app/document (types, wallThickness), core/tolerance, core/vector, elements/wall/schema (types), wall/geometry/shape (exteriorOffset), wall/geometry/arc (arcOf)
- used by: app/frame.ts, app/select-drag.ts, app/temp-dims.ts, app/wall-ui.ts, elements/dimension/constraints.ts, tools/transform.ts, tools/split.ts (stretchEnd, meet), tools/nudge.ts, tools/arrange-walls.ts

## Problems found (finding IDs)
- F-0101 fixed: every slide through slideOnto/meet
- F-0102 (S3): linear lookups inside the per-end loops

## To check in other files
- src/app/select-drag.ts: how often moveWalls runs per drag

## Sources
- https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection : the intersection formula; the denominator is zero for parallel lines, and the formula, for infinite lines, can give a point outside both segments (lines 25-46; F-0101)
