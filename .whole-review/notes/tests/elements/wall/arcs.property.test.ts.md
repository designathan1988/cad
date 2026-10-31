# tests/elements/wall/arcs.property.test.ts
Lines: 342
Summary: Property tests (fast-check, fixed seed 20261024 or FUZZ_SEED, 100 runs each) of arc walls against the independent arc oracle:
- A lone random arc covers its body exactly, with the spec's segment count, and gives no warning.
- An arc with a straight wall at one end makes the spec's L exactly, or warns when the spec warns. A wall that would touch the arc again elsewhere is shortened, or the case is skipped as a second junction. A counter test requires enough clean joins (>40), more than 20 joins reaching past the end segment, and at most 5 skipped.
- A straight wall abutting an arc anywhere in its band makes an exact T (point samples on a golden-angle spiral), or warns. A counter requires more than 80 clean and at most 5 skipped.
- A straight wall crossing an arc at a slant makes an exact X with no warning. Positions too near the ends, too short or without room are skipped. A counter requires more than 80 clean and at most 5 skipped.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: random arcs against oracle-arc, alone and with a straight wall
- 5-10 imports: fast-check, vitest (vi), wall types, fixtures, arc oracle helpers, inside/rectOf/shoelace
- 12-20 the seed from FUZZ_SEED or a fixed date; vi.setConfig testTimeout 10 min for the file; SPEC_POINT_TOL 1 mm; arbitraries: doubles without NaN/∞, layer functions, 1–3 layers of 1–15 cm, reference lines
- 22-40 arcArb: a start, heading, chord 1–10 m, sweep ±10–300° (bulge = tan(sweep/4)), layers, ref; filtered to inner face radius > 5 cm
- 42-59 lone arcs: no warnings; pieces = segments × layers; total area equals the oracle's body to 1e-9; coverage exact
- 61-74 counters and the L property's arbitraries (end, angle 30–150°, side, length 1–5, layers, ref, seed)
- 75-113 the wall built from the node; binary search (14 halvings) for where it first touches the arc elsewhere; within the corner's reach it is the L spilling past the end segment (with a second shortening of its tail), else shortened to 95 %
- 114-134 skip when the far end or the wall's path comes near the arc's other end or lands on the arc; skip when it touches the arc again (not spilling); counted
- 135-160 the spec's arcCorner decides: 'overlap' must warn; otherwise no warnings and exact coverage near the node (tBeyond for what passes the arc)
- 162-173 the counter test (logs the counts; >40 clean, >20 spill, ≤5 skipped), reading counters filled by the previous `it`
- 175-226 T property: an end inside the arc's band at a fraction and depth, from outside or inside, at ±50°; skipped if its start is within 20 cm of the arc; warnings counted; else 800 spiral samples around the end compare piece counts with the oracle (bodies, the wall less what is beyond, the T fill), skipping samples within 1e-7 of a side
- 228-233 the T counter test (>80 clean, ≤5 skipped)
- 235-243 nearSide: a point within 1e-7 of any side of a polygon
- 245-299 X property: skip arcs too short for a crossing clear of both ends; move the crossing toward the middle until it is clear; a radial point at a depth, a slant up to ±60°; each half stops halfway between leaving the band and meeting it again (5 mm steps, up to 3 m); skip when there is no room
- 300-334 build the wall; skip near the arc's ends or with its own ends on the arc; no warnings; 800 spiral samples: exactly one piece inside a body, none outside
- 336-341 the X counter test (>80 clean, ≤5 skipped); suite closes (line 342 blank)

## Contracts, state and data flow
- Each property compares the engine's geometry() with the oracle's construction of the spec. Runs are reproducible from the seed. The counter tests depend on the property test before them in the same describe having run first; this holds while Vitest runs a file's tests in order. A shuffled or concurrent run would make them fail with zero counts.

## Depends on / used by
- uses: fast-check, vitest, src/elements/wall/schema, tests/elements/wall/fixtures, oracle-arc, oracle
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://fast-check.dev/docs/api/interfaces/Parameters/ : seed sets the generator's initial seed so a run is replayable; numRuns is the number of runs required for success (default 100) (lines 56, 158, 224, 332)
- https://vitest.dev/api/vi.html#vi-setconfig : vi.setConfig changes options such as testTimeout for the current test file only (line 15)
