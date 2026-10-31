# src/tools/guide-tool.ts
Lines: 97
Summary: Placing a line guide parallel to a straight wall's face or to another line guide, at the distance the pointer sets (rounded to the grid step when snaps are on) or a typed one, measured from the face on the pointer's side so the value is the clear space. Gives the base under the pointer, the draft, its line, the dimension shown while placing, and the new guide.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: offset from the face on the pointer's side (clear space); the Alt gesture lives in input.ts
- 7-12 imports: Doc type, vector helpers, Guide type, wall offset helpers, shapeOf, GRID_STEP
- 14-23 GuideBase: point, unit dir, the faces' offsets across (smaller first, [0,0] for a guide), the wall or guide id
- 25-33 GuideDraft: the base, the side (+1 along perp(dir)), the offset from that face, where along the base the pointer is
- 35-36 GUIDE_PX 6: pick reach in pixels
- 38-68 guideBaseAt: nearest straight wall of the level within reach of its body (beyond its faces, along its length ± reach), skipping invalid shapes; else the nearest line guide (points and circles skipped); hidden kinds skipped
- 70-78 draftAt: across offset of the pointer; side by the band's middle; distance past that face (≥ 0), rounded to GRID_STEP when snapping
- 80 faceOf: the face offset on the draft's side
- 82-85 guideLine: the base point moved across to face + side·offset, the base's direction
- 87-92 guideMeasure: the dimension from the face to the guide at the pointer's position along
- 94-96 newGuide: the guide record from the draft's line

## Contracts, state and data flow
- Pure. wallNormal is the left perpendicular, the same as perp(dir), so the faces' offsets and the draft's across value share a frame.
- The base point of a wall is its start; the guide is an infinite line through it.

## Depends on / used by
- uses: app/document (Doc type), core/vector, elements/guide/schema (Guide), wall/geometry/offset and shape, tools/snap (GRID_STEP)
- used by: app/guide-ui.ts, app/frame.ts, app/input-keys.ts, app/actions.ts, app/ribbon-tabs.ts

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round : rounding to the nearest integer, halves toward +∞, the stored double rounded (line 77, offsets are ≥ 0 so only the half rule matters)
