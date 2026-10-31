# tests/elements/wall/joins.property.test.ts
Lines: 264
Summary: The spike gate for wall joins (spec §15): about 2000 random scenes compared with the independent oracle. FUZZ_SEED picks the seed and FUZZ_SCALE multiplies the run counts. The scenes:
- L corners (normal and degenerate): exactly the spec's region, or a wallsOverlap warning; layer continuity at mitres; butt layer rules at corners of different sequences.
- T junctions: exactly the spec's region, with no layer crossing the host's near face and the notch filled by priority.
- X crossings: both bands exact, and each side of the cut wall checked as a T.
- Corners whose ends overran each other: resolved as one L at the crossing of the reference lines.
- A room with a divider: exact, and independent of input order (bit-identical output when shuffled).
- A node with a passage in line and stems: each stem a T against the passage.
- A butt regression found by a larger run.
- A final test checks that the layer checks were really exercised: minimum counts of corners, T joints and points, and exact scene counts.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: spec §15 spike gate; FUZZ_SEED and FUZZ_SCALE
- 4-16 imports: fast-check, vitest, fixtures, the oracles (oracle, oracle-layers, oracle-x) and the scene generators
- 18-21 seed, scale, runs(n) = {numRuns n·scale, seed}, a 10-minute timeout per test
- 23-33 expectExact: overlaps, gaps and extras all 0; area error below 1e-9; no layer-containment violation
- 35-61 minimum counts for the vacuity checks; expectAbutment: I6 (no penetration ≤ 1e-12) and I10 (notch fill), counting the checked joints and points
- 63-70 expectContinuous: I9, layer continuity at a mitre, counted
- 72-92 expectCorner: for mitre or bevel corners, continuity when not a butt; otherwise butt penetration, plus layer ownership when not bevelled, counted
- 94 dump: the pieces map's entries, sorted with the default sort (as strings), then serialised as JSON
- 96-114 L for both modes, 400 runs each: 'overlap' must warn exactly wallsOverlap; otherwise no warnings, exact, corner checks
- 116-130 T for both modes, 300 runs: no warnings, exact against expectedT, abutment checks
- 132-149 X for both modes, 300 runs: exact against expectedX; each side of the cut wall checked as a T against the through wall; counted
- 151-169 overrun corners, 300 runs: one L at the crossing node, or a warning
- 171-193 room with a divider, 300 runs: exact; both divider ends as Ts; the four ring corners; a shuffled order gives the same dump (I4)
- 195-223 a node with a passage and stems, 300 runs: the passage as one host band, the region a union of Ts (area summed less repeated host areas); each stem's penetration and notch fill; counted
- 225-241 regression (FUZZ_SEED 55555 × 10): a 170° butt against a 0.5 m through wall; exact; butt penetration and ownership over 20 sample seeds
- 243-263 the vacuity test (runs after the suites above in file order): logs and minimums for I9, I10, priority, X scenes (= 600·scale), node scenes (= 300·scale), stems, butt corners and points; suite closes (line 264 blank)

## Contracts, state and data flow
- The join engine is checked against an independent geometric oracle by dense sampling, with deterministic seeds. The final test reads module-level counters filled by the earlier tests, so it depends on file order (the comment at line 245 says so). The suites cover joins between walls standing still; the edit-time defects (a moved wall thrown far, F-0101; split and merge, F-0106) are outside them.

## Depends on / used by
- uses: fast-check, vitest, tests/elements/wall (fixtures, oracle, oracle-layers, oracle-x, scenes)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/test.html : test(name, body, timeout) takes a timeout in ms as the third argument; printf placeholders such as %s fill each-names (lines 96-113, 116, 133)
- https://vitest.dev/api/describe.html#describe-each : describe.each runs the suite once per row (lines 96, 116, 133)
