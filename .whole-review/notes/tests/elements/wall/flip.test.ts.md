# tests/elements/wall/flip.test.ts
Lines: 72
Summary: Tests of flipping walls. A flip swaps start and end (an arc's bulge is negated), so the layers turn to the other side of the reference line. Openings stay where they are in the world, with their rules counted from the other end. A door keeps its hinge jamb and opens to the same side. A distributed group keeps its members in place, its order reversed and a fixed row anchored at the other end. Flipping twice gives back the same document. Joins and dimensions are not covered (F-0087).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: swap the ends; layers to the other side; hosted things stay in the world
- 4-9 imports: vitest, the document, derive (openings, hosts), distributeOpenings, newOpening, flipWalls
- 11-21 wall helper (15 cm masonry on its centreline)
- 23-29 jambs(): the world x of an opening's jambs on a wall along x (Math.sign of the direction)
- 31-40 base: a 6 m wall, an arc (bulge 0.3); door d fromStart 1 (hinge start, swing left), window n fromEnd 0.5, window k fromOpening d 0.4 toward the end
- 42-46 flip swaps both walls' ends; the arc's bulge becomes −0.3
- 48-54 every jamb stays put; d becomes fromEnd 1, n fromStart 0.5, k fromOpening toward the start
- 56-59 d's hinge becomes end and its swing right
- 61-66 a fixed group (gap 0.5, from the start, 0.3) becomes members [n, d], anchored at the end; the jambs stay
- 68-71 flipping twice equals the base (toEqual); suite closes (line 72 blank)

## Contracts, state and data flow
- flipWalls rewrites each opening's rule kind, hinge, swing and groups for the reversed direction: another place that knows every rule kind (F-0068 Also). Joins and dimensions named by end are not remapped (F-0087), and this test does not include them.

## Depends on / used by
- uses: src/app/document, src/elements/opening (derive, commands, schema), src/elements/wall/flip
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0087 (Also: not covered here); F-0068 (another rule-kind rewriter)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sign : returns 1, −1, ±0 or NaN by the sign of its argument (line 27)
