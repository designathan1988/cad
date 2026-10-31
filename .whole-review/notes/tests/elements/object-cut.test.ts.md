# tests/elements/object-cut.test.ts
Lines: 66
Summary: Tests of voids in objects (three-bvh-csg). A part marked cut is subtracted from the solid parts and not drawn: a 1 m cube less a 0.4 m void has volume 0.936, with one geometry out. A slab with a hole through it gets crease lines only, at least 24 and none diagonal across the top or bottom. A void that reaches no solid changes nothing. A definition with `cut: true` is valid, and a non-boolean `cut` is not.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: voids taken out of the solid parts, not drawn, not in the plan outline
- 4-9 imports: three, vitest, creaseEdges/cutGeometries, Piece, isDefinition, BUILT_IN_MATERIALS
- 11-26 volume(): de-indexes the geometry, then sums signed tetrahedra a·(b×c)/6 per triangle (divergence theorem) and takes the absolute value
- 28-29 the first built-in material and a box Piece helper with an optional cut flag
- 31-36 cube less void: one output geometry, volume 1 − 0.064 to 6 digits
- 38-53 slab with a through hole: userData.cut is set; creaseEdges at 20° gives ≥ 24 segments; no segment changes both x and z (three.js y up, so these are the horizontal faces)
- 55-58 a void far away leaves volume 1
- 60-65 isDefinition accepts cut true and refuses cut 'yes'; suite closes (line 66 blank)

## Contracts, state and data flow
- cutGeometries returns only the solid result (voids are not drawn). The library requires two-manifold brushes with the same attributes, and box pieces satisfy this.
- The volume check depends on the CSG output being closed; an open result would give a wrong but finite number.

## Depends on / used by
- uses: three, src/elements/kinds/object (cutGeometries, creaseEdges), src/elements/object (evaluate, valid), src/elements/material/schema; three-bvh-csg through the kind
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://github.com/gkjohnson/three-bvh-csg : SUBTRACTION is A − B; every brush must be two-manifold and share attributes (lines 33, 40, 56)
