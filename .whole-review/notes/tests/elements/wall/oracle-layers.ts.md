# tests/elements/wall/oracle-layers.ts
Lines: 228
Summary: The oracle's checks of layer invariants. It follows the same independence rule as the other oracles and uses no engine geometry code.
- I8 (layerContainmentViolations): every vertex of every layer piece lies inside that layer's band.
- I9 (layerContinuity): across a miter between walls whose layer sequences match, read from the corner's outer face, layer k meets layer k (checked at 199 points along the miter).
- sameSequence: the spec's corner choice; same functions with thicknesses within 1 mm are mitred, anything else butts.
- coreLayersOf: the core is the first to the last structure layer, or the whole wall if it has none.
- SPEC_PRIORITY: Revit's priority by layer function, written again on purpose.
- tFaces: where each abutting layer stops in a T. A core layer stops on the host's core face. Any other layer passes host layers of strictly lower priority and stops on the first of equal or higher priority.
- I6 by layer (abutmentPenetration): the deepest penetration past those stops.
- I10 (notchFill): random points between the host's near face and its core face, inside the abutting strip, must belong to abutting layer k where k has passed, and to the host everywhere else. A seeded LCG drives the points.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: I8 and I9, no engine geometry code
- 3-14 imports (WallEnd, fixtures geometry, oracle cornerSpec/frameOf/inside/P) and small vector helpers; far() gives the other end
- 16-21 layerOffsetsOf: cumulative offsets from the exterior face o0
- 23-40 I8: count vertices outside their layer's band by more than 1e-12
- 42-90 I9: only for a miter or bevel with both corner points; both sequences read from the outer face; null unless equal to 1e-12; 199 samples along outer → inner (skipping the layer marks), each side nudged 1e-7 into its wall; count rank mismatches
- 92-106 SPEC_POINT_TOL 1 mm; sameSequence: equal length, functions, thicknesses within 1 mm
- 108-115 coreLayersOf; SPEC_PRIORITY (structure 1 … finish2 5)
- 117-142 tFaces: host side from the abutting direction; the core face on that side; the walk over the host's non-core layers from the near face inward; each abutting layer's stop (core → core face; else the first host layer of equal or higher priority, at the latest the core face)
- 144-166 abutmentPenetration: the worst signed distance of abutting piece vertices past their layer's stop (optionally only kept pieces)
- 168-227 notchFill: none when near = core face; 400 LCG samples (a 1664525, c 1013904223, mod 2^32) between the faces within the reach along the host; samples near any boundary, past the host's ends, or outside the strip skipped; passed = before the free end and between near and stop; checks the owner is abutting layer k when passed, otherwise a host wall; counts layers passing outside the core (line 228 blank)

## Contracts, state and data flow
- Pure, apart from local generator state. The priorities are written again here, not imported, so a mistake in the engine's table (wall/schema LAYER_PRIORITY) is caught rather than copied. These are the invariants that joins.property.test.ts counts to prove the checks are not vacuous.

## Depends on / used by
- uses: src/elements/wall/schema (type), tests/elements/wall/fixtures, oracle
- used by: joins.property.test.ts, oracle-x.ts (sameSequence, coreLayersOf, tFaces as needed), arcs tests through them

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Linear_congruential_generator : a = 1664525, c = 1013904223, m = 2^32 is the Numerical Recipes generator (line 197)
- https://rvtdocs.com/2026/Autodesk.Revit.DB.MaterialFunctionAssignment : the default priorities by function (line 115)
