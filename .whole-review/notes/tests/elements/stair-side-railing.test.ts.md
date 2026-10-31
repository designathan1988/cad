# tests/elements/stair-side-railing.test.ts
Lines: 78
Summary: Tests of a guardrail hosted on a stair's or ramp's side:
- It follows the side's handrail line. Its feet rise from 0 at the first nosing to the top less the rail height, never going down. Its top is its height above the highest foot.
- Its posts' feet rise with it, including between the points.
- A ramp's guardrail rises with the slope.
- A stair with its handrails turned off still has both sides.
- A side index that does not exist leaves the railing where it was drawn, flat.
- The kind refuses a negative or fractional side index.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: follows the handrail line and rises; sides kept with handrails off; the well's guardrail still offered (not tested here)
- 5-11 imports: vitest, document, deriveGeometry, railing kind and solid, postsOf/Railing, stairSolid, RAIL_HEIGHT/Stair
- 13-27 an upper level at 2.8, a stair builder (1 m wide, 0.28 tread, turned a quarter), side(n) (a railing hosted on side n, drawn at (9, 9)–(10, 9)), docOf, solidOf
- 29-45 straight stair: two sides; the railing's points equal side 0's line; rise from 0 to the top z less RAIL_HEIGHT (using at(-1)), never decreasing; span top = bottom + last rise + 1.1
- 47-54 postsOf: more than 2 posts, from 0 to the last rise, never decreasing
- 56-59 a ramp's last rise above 1 m
- 61-67 railing false: no rails, two sides; the hosted railing still rises
- 69-77 side 7: no rise, drawn points kept; valid refuses side −1 and 0.5, accepts 0; suite closes (line 78 blank)

## Contracts, state and data flow
- A hosted railing's points and rise are derived from the stair each time (positions from another element, like the openings in F-0068, but this link is explicit and chosen by the user).

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/kinds/railing, src/elements/railing/schema, src/elements/stair (geometry, schema)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/at : at(-1) is the last element; undefined for an empty array (lines 40, 44, 52, 58)
