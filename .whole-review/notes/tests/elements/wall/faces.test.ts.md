# tests/elements/wall/faces.test.ts
Lines: 61
Summary: Tests of which faces of the walls' 3D blocks are drawn (spec §8). Only the outside of the solid is drawn. Faces between touching blocks, side to side or stacked, are inside the solid; drawing them made coplanar faces z-fight and showed light specks. Cases:
- a lone block shows every face whole;
- two blocks side by side hide their shared ends;
- a lower neighbour hides only the part of the end it stands against;
- a stacked block hides the lower top and the upper bottom;
- a shorter block beside a long face hides only the stretch where they overlap.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: spec §8 and the z-fighting specks it fixed
- 5-6 imports: vitest, visibleFaces/Prism
- 8-17 box(): an axis-aligned prism
- 19-26 lone block: each side one rectangle, side 0 {t0 0, t1 1, z0 0, z1 2.8}; one top and one bottom
- 28-35 side by side: a's side 1 and b's side 3 are empty; other sides whole
- 37-40 a lower neighbour (1.5 m) leaves a's end visible from 1.5 to 2.8 only
- 42-48 stacked: low's top and high's bottom empty
- 50-60 a block covering x 0.25–0.75 along a's long side: visible t [0, 0.25] and [0.75, 1] (t from x = 1); suite closes (line 61 blank)

## Contracts, state and data flow
- visibleFaces returns, for each prism, the visible rectangles of each side in (t along the edge, z), plus the top and bottom regions. The renderer draws only these.

## Depends on / used by
- uses: src/elements/wall/geometry/faces
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Z-fighting : coplanar surfaces fight for pixels in the depth buffer; separating or removing them avoids it (lines 1-3)
