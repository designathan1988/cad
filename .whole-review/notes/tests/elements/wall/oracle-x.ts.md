# tests/elements/wall/oracle-x.ts
Lines: 298
Summary: The oracle's expectations for crossings (X) and corners (L), built with its own math only:
- Reference geometry: where two reference lines cross (Cramer's rule), and the overlap of the two bands.
- throughOf: the spec's choice of which wall runs through. The thicker core wins; cores within 1 mm tie and the lower id goes through (compared as strings, code unit by code unit).
- expectedX: the union of both bands.
- sidesOf: each side of a crossing treated as a T. Pieces are assigned to a side by where their centroid lies against the through wall's core midline.
- buttRule: the layer-by-layer butt (§7.1). Each layer of the through wall and of the cut wall stops on a given line of the other.
- buttReached: the butt's own corners. buttPenetration: how far any layer passes its stop. buttOwnership: in the overlap, every point belongs to exactly the layer the rule gives (300 LCG samples).
- cornerJoin: the spec's resolution of an L. A miter is used when the sequences are equal. Otherwise the butt (layered) or the T-like butt used against an arc segment applies. Any corner point past a free end makes it 'overlap'; an obtuse corner whose points lie farther than 10·T away becomes 'shared'.
- expectedCorner: the region for that resolution.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: X expectations, own math only
- 3-8 imports: WallEnd, fixtures, the oracle core (CornerKind, cornerSpec, expectedL, frameOf, inside, into, rectOf, shoelace, P, Region), oracle-layers helpers; pt()
- 10-18 meet(): two lines by Cramer, no zero-determinant guard; crossingOf
- 20-35 SPEC_POINT_TOL 1 mm; coreThickness; throughOf (tie → a.id < b.id, a string comparison)
- 37-63 overlapOf (the parallelogram of face crossings); expectedX (area = A + B − overlap; contains either band; edges)
- 65-91 sidesOf: the core midline of the through wall; each side keeps the pieces whose vertex mean lies on its side
- 93-134 SPEC_MITER_LIMIT 10; buttRule: through/cut, which side each body lies on, layer kinds (inner/core/outer), the lines each kind stops on, per-layer stops
- 136-147 buttReached: each layer's two band edges meet its stop line
- 149-167 buttPenetration: the worst signed distance past the stops over both walls' pieces
- 169-223 buttOwnership: 300 seeded samples in the overlap parallelogram, short of both free ends and off every line; the rule must give exactly one owner, and the engine's piece there must be that wall and layer
- 225-283 cornerJoin: cornerSpec; equal sequences → miter or bevel, not a butt; the past() test against each far end (or a given reach); layered: any reached corner non-finite or past an end → overlap; obtuse and too far → shared; not layered (arc segment): the T corner q plus each abutting layer's deepest point, the same tests
- 285-297 expectedCorner: 'overlap' or expectedL with the resolved kind (line 298 blank)

## Contracts, state and data flow
- Pure, with local generator state. The tie-break compares ids as strings by UTF-16 code units, and it must match the engine's ordering for the ties tested in layers.test.ts:366-412. meet() divides by the determinant; for parallel lines that gives non-finite points, which cornerJoin treats as overlap (line 258).

## Depends on / used by
- uses: src/elements/wall/schema (type), tests/elements/wall/fixtures, oracle, oracle-layers
- used by: joins.property.test.ts, arc-corner.test.ts, oracle-arc.ts (expectedCorner), scenes.ts as needed

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Less_than : strings compare lexicographically by UTF-16 code units (line 33)
- https://en.wikipedia.org/wiki/Cramer%27s_rule : the 2×2 solution and its zero-determinant failure (meet, lines 10-15)
- https://en.wikipedia.org/wiki/Linear_congruential_generator : the 1664525 / 1013904223 generator (line 181)
