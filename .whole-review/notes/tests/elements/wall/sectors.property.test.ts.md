# tests/elements/wall/sectors.property.test.ts
Lines: 169
Summary: Property tests of junctions solved by sectors (spec §7.6) on random scenes, with checks that share nothing with the engine:
- 3–4 walls crossing at one point, at least 20° apart and 8–35 cm thick: the pieces cover exactly the union of the bands.
- 3–6 ends meeting at one point: no two pieces overlap; every band point away from the junction is covered once; the union is star-shaped from the point (no hole, no pocket).
Scenes the engine cannot split warn complexJoin and are skipped. A final test requires more than 90 % of each kind to be split, so up to 10 % may stay unjoined (F-0138). FUZZ_SEED and FUZZ_SCALE apply as in the other suites.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-9 header: §7.6, the checks, no polygon library (polyclip overflowed), complexJoin allowed for some scenes
- 11-16 imports: fast-check, vitest, vec, overlapArea, fixtures, oracle (checkAgainst, inside, P, rectOf, Region)
- 18-22 seed 20261026 (or FUZZ_SEED), scale, runs, a 10-minute timeout, MIN_GAP 20°
- 24-37 spread(k, span): k angles, each at least 20° from the next, spread by random weights from a random turn; the thickness arbitrary; dirOf
- 39-55 crossings (3–4 walls through the origin over 180°) and stars (3–6 ends from the origin over 360°, 2–4 m long)
- 57-70 edgesOf; bands (the union of rectangles, area NaN, not checked); onOrInside for a counter-clockwise convex polygon with its sides
- 72-98 hiddenFrom: random points in each piece (a fan triangle chosen by area, uniform within it); walk back to the point in 1 mm steps; return the first uncovered step
- 100-109 mulberry32, a third copy written another way (|0 forms)
- 111 the tally of scenes and split scenes
- 113-128 crossings, 200 runs: complexJoin → skip; otherwise no warnings and exact coverage of the bands
- 130-160 stars, 300 runs: complexJoin → skip; no warnings; pairwise overlap < 1e-9; 40 samples per arm beyond 10 × the thickest + 5 cm are covered once; star-shaped from the origin
- 162-168 split ratio > 0.9 for each kind; suite closes (line 169 blank)

## Contracts, state and data flow
- The engine either splits a junction exactly or warns and leaves the walls square. The suite proves the first for the scenes it accepts and bounds the second at 10 %. mulberry32 now exists in three test files (oracle.ts, oracle-arc.ts, here).

## Depends on / used by
- uses: fast-check, vitest, src/core/vector, src/elements/wall/geometry/convex, tests/elements/wall/fixtures, oracle
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0138 (lines 119, 135, 162-167: unjoined junctions skipped and only bounded)

## To check in other files
- src/elements/wall/join/sectors.ts: which exactness checks refuse (for F-0138)

## Sources
- https://en.wikipedia.org/wiki/Star_domain : a set is star-shaped at a point when the segment from it to any point stays inside (hiddenFrom, lines 72-98)
- https://fast-check.dev/docs/api/interfaces/Parameters/ : seed and numRuns (runs, line 20)
