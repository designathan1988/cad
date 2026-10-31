# tests/elements/wall/joins.test.ts
Lines: 204
Summary: The table of wall join cases. Every expected polygon and area is worked by hand.

L corners:
- a 90° miter, the same whether drawn head to tail or from the corner;
- a 30° bisector miter;
- exterior-face reference lines;
- ends 0.8 mm apart still join;
- at 4° the miter tip is bevelled exactly 2.0 m behind the node (10 × the thickness);
- folded back at 0.3°: no join, wallsOverlap;
- a stub shorter than half the other wall's thickness: wallsOverlap;
- in line at 179.8° with 30 and 10 cm walls: one shared cut.

Overrun corners:
- ends 5 cm past each other give the same miter as ends that touch;
- nearly in line (179°) with a 0.5 m overlap: wallsOverlap;
- a free end inside a parallel wall: wallsOverlap, not a T.

T joins:
- 15 cm into 20 cm stops on the near face, whichever way it is drawn;
- an end 0.9 mm short is extended to the face;
- an oblique cut never goes past the face.

An 8 × 6 room with a divider: exact areas for centreline, exterior-face and interior-face reference lines.

Warnings and determinism: three ends at one point (two in line pass, the third abuts); a wall under 1 mm warns wallTooShort and is still drawn; input order changes no bit of the output.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: every expected value worked by hand
- 3-7 imports: vitest, vec, ReferenceLine, fixtures, shoelace
- 9-21 XY, wall helper, piecesOf, only (exactly one piece), totalArea
- 23-30 expectPolygon: the same vertex set at any start, to 1e-12
- 32-38 90° miter vertices for a and b; area 1.4
- 40-50 drawn head to tail: area 1.4; 30°: inner corner at 0.2 + 0.1√3
- 52-61 exterior-face reference: the corner square split on its diagonal
- 63-67 0.8 mm apart: area 0.81984 + 0.58
- 69-76 4°: furthest reach behind the node is 2.0 (bevel), no warnings
- 78-87 0.3° folded back: wallsOverlap [a, b]; a 10 cm stub against a 40 cm wall: wallsOverlap
- 89-95 179.8° in line, 30 and 10 cm: area 1.2 + 0.4; suite closes
- 97-103 ends overrun by 5 cm: the same miter, no warnings
- 105-121 179° with lines crossing 5 m away: wallsOverlap; a free end inside a parallel band: wallsOverlap [b, a], b kept as its full rectangle
- 123-138 T: 15 cm into 20 cm stops at y 0.1, the host untouched; drawn toward the host the same; 0.9 mm short extended
- 140-147 oblique T at 45°: minimum y is 0.1 to 14 digits and never below 0.1 − 1e-15
- 149-162 room on the axis: area 8.2·6.2 − 7.8·5.8 + 0.15·5.8; the divider from 0.1 to 5.9; no warnings
- 164-174 exterior face (8·6 − 7.6·5.6 + 0.15·5.6, divider 0.2–5.8); interior face (8.4·6.4 − 8·6 + 0.15·6)
- 176-182 three ends: no warnings, area 1.4 + 0.58
- 184-189 a 0.5 mm wall: wallTooShort and one piece
- 191-203 reversed and shuffled input give the same dump; suite closes (line 204 blank)

## Contracts, state and data flow
- computeWallGeometry is deterministic and independent of input order. The bevel rule caps a miter tip at 10 × the thickness, like a miter limit. Overlaps the spec cannot join are warned, not fixed.

## Depends on / used by
- uses: src/core/vector, src/elements/wall/schema, tests/elements/wall/fixtures, oracle (shoelace)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-miterlimit : a miter limit caps the tip length relative to the width, and a join past it becomes a bevel (lines 69-76)
