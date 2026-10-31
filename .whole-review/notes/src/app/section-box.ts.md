# src/app/section-box.ts
Lines: 202
Summary: Pure geometry of the 3D section box (six faces dragged by handles) and of the vertical section line: faces, normals, moving a face (never thinner than 10 cm), the first box around the model, its edges, a screen drag turned into metres, stored-value readers, and the caps (the filled cut surfaces) where the box's faces or the section's plane go through upright prisms (wall blocks, floors), following a sloped top.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: Revit's Section Box; plan coordinates and heights; interface state kept with the 3D view's choices; pure
- 5-6 imports: Point2, clipHalfPlane (wall geometry's convex clipper)
- 8-18 Point3 (z the height) and SectionBox (min, max)
- 20-22 BoxFace and BOX_FACES: x−, x+, y−, y+, z−, z+
- 24-27 MIN_BOX 0.1 m; BOX_MARGIN 0.5 m around the model
- 29 axisOf: the face's axis letter
- 31-36 faceCenter: the box's middle with the face's coordinate
- 38-43 faceNormal: ±1 on the face's axis
- 45-50 moveFace: a + face out by d, never below min + MIN_BOX; a − face out (down) by d, never above max − MIN_BOX
- 52-59 boxAround: the plan bounds (or a 10×8 m default) and heights plus the margin
- 61-67 boxEdges: corner i by its bits; an edge from each corner along each unset bit (12)
- 69-77 dragDistance: the screen motion projected on the face's screen axis per metre; 0 when the axis is seen end-on
- 79-87 readBox: min and max with finite numbers (Number.isFinite does not coerce), min below max on each axis
- 89-96 UprightPrism: plan polygon between bottom and top, an optional sloped top plane
- 98-99 topAt: the plane's height clamped to [bottom, top], else top
- 101-112 boxCaps: per prism, the part of its height inside the box
- 113-126 on each side face, a rectangle per stretch of the outline the face's line crosses, its top following the slope
- 127-135 on the top and bottom faces inside the prism's height, the outline (under a slope only where the slope is above: clipHalfPlane keeps normal·p ≤ offset, i.e. a·x + b·y + c ≥ z; clipHalfPlane assumes a CONVEX counter-clockwise polygon: wall blocks are convex pieces; a floor has no plane)
- 137-151 crossings: the line's crossings with the polygon edges (half-open so a vertex counts once), sorted and paired into stretches
- 153-161 SectionLine: a point and a unit direction; the kept side on its left
- 163-164 sectionLooks: the left normal
- 166-190 sectionCaps: per prism, the plane's crossings with the outline, along the line, paired; a rectangle from the bottom to the (sloped) top per stretch
- 192-201 readSection: finite point and direction, normalised; a zero direction refused

## Contracts, state and data flow
- Caps are not clipped to the box's other faces here (the renderer's clipping planes take what lies outside).

## Depends on / used by
- uses: elements/wall/geometry/convex.ts (clipHalfPlane), core/vector.ts (type)
- used by: app/view-3d.ts (readBox, readSection), app/view-ui.ts (moveFace, boxAround, dragDistance), render/scene-3d.ts (caps, edges), app/input.ts (box drag)

## Problems found (finding IDs)
- none

## To check in other files
- render/scene-3d.ts: which prisms are passed to boxCaps with a plane (must be convex)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite : no coercion; non-numbers false (lines 82, 196)
