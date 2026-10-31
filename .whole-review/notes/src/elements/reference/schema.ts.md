# src/elements/reference/schema.ts
Lines: 88
Summary: Reference drawings under the plan: a picture (data URL and pixel size) or a DXF's lines, on a level. Each is placed by its lower-left corner, scaled and turned, with an opacity. The file also has the transform of a point, the corners, calibration by two points and a real distance, and the file guard.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: phase 11 references (picture, PDF page as picture, DXF lines) drawn faint, calibrated by two points, saved with the project
- 7 import: the Point2 type from core/vector
- 9 REFERENCE_PREFIX: the id prefix 'ref'
- 11-15 ReferenceSource: image (data URL, w, h px) or dxf (flat x1,y1,x2,y2 list in metres from its lowest corner, w, h)
- 17-31 Reference: id, level, file name, source, corner at, scale (m per unit), angle (rad CCW), opacity ("0.1 to 1")
- 33-35 IMAGE_SCALE 1 px = 1 cm until calibrated; DEFAULT_OPACITY 0.5
- 37-42 referencePoint: rotate (u, v) by the angle (the 2D rotation matrix), scale, then translate to the corner
- 44-45 referenceCorners: the four corners, counter-clockwise
- 47-56 calibrated: k = real / current distance; scale × k about point a; null for coincident points or a non-positive or non-finite distance
- 58-59 local finite and isPoint (copies of core/guards)
- 61-87 isReference: ids and name strings; the source's w, h > 0; an image's data starts with "data:image/"; a DXF's lines in fours, all finite; the corner a point; scale > 0; angle finite; opacity 0.05-1

## Contracts, state and data flow
- Pure. Pictures live inside the Doc (and the file) as data URLs; DXF lines as one flat number array.
- isReference validates the whole source each time it runs, which the update command does on every change (F-0079 Also).

## Depends on / used by
- uses: core/vector (type)
- used by: reference/commands.ts, app/reference-ui.ts, the plan renderer (corners, points), io/project-file.ts (guard), the DXF import

## Problems found (finding IDs)
- F-0079 (Also): full validation on every update; opacity comment 0.1 vs check 0.05

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Rotation_matrix : 2D counter-clockwise rotation x' = x cosθ − y sinθ, y' = x sinθ + y cosθ (line 41)
