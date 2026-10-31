# tests/elements/wall/edges.test.ts
Lines: 117
Summary: Tests of the thin lines drawn over walls in 3D. Lines appear only where the surface turns: never along a seam inside a plane, and never at a slight bend. Each case is worked by hand from boxes:
- a lone block has its 12 edges;
- two walls joined in line show the whole block's 12 edges, with no line at the joint;
- two layers side by side show one outline;
- a 15 cm wall above a 20 cm one: each level is drawn from its own faces, so the step shows on the lower top;
- a lower wall beside a higher one: a line where its top meets the higher face, and none down the shared face plane below;
- a 10° mitred bend (as between arc segments) gets no vertical line; a 30° bend does;
- no line runs across the top at a bend's joint.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: lines where the surface turns, not along seams or slight bends
- 4-7 imports: vitest, featureEdges/Edge3, visibleFaces/Prism, Point2
- 9-18 box(): an axis-aligned prism between two heights
- 20-27 r() rounds and turns −0 into 0; lines() makes each edge a sorted "x,y,z x,y,z" string, the list sorted; edgesOf()
- 29-43 boxLines(): the 12 edges of a box in the same form
- 45-56 a lone block, two blocks in line, two layers side by side: each equals the outer box's 12 lines
- 58-71 levels drawn apart: the lower top's face lines at ±0.1, the upper's at ±0.075, the upper exactly its box
- 73-80 a 1.5 m wall beside a 2.8 m one: the line at its top, no line down the plane below 1.5, the higher wall's end above it
- 82-95 bend(deg): two mitred 20 cm prisms, the second turned; verticalAt finds a vertical line at a corner
- 97-106 at 10° no verticals at either corner; at 30° both
- 108-116 no edge joins the outer and inner miter corners at 30°; suite closes (line 117 blank)

## Contracts, state and data flow
- featureEdges takes prisms and their visible faces and keeps an edge where adjoining faces turn more than a threshold, which lies between 10° and 30°. This is the same idea as three.js EdgesGeometry's thresholdAngle.

## Depends on / used by
- uses: src/elements/wall/geometry (edges, faces), src/core/vector
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://threejs.org/docs/pages/EdgesGeometry.html : an edge is kept only when the angle between its two faces' normals exceeds a threshold (lines 97-106)
