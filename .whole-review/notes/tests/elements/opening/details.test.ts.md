# tests/elements/opening/details.test.ts
Lines: 80
Summary: Tests of door and window details.
- Every catalog model has a valid style. Drawn closed, half open and fully open, it gives more than three parts, each with a positive height and finite corners, inside a box a leaf's width plus 0.4 around the opening.
- Panels and a handle add parts. A glazed leaf adds glass. Glazing bars add 2 × 2 parts per leaf.
- A swinging leaf turns further out of the wall the more it opens.
- A sliding leaf slides along the wall and stays inside it.
- Forced open in the view, a door is drawn fully open.
- A style with the opening amount out of range, an unknown design or one muntin is refused.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: every model at three openings; details add parts; opening moves the leaves
- 5-8 imports: vitest, openingParts, newOpening/OpeningStyle, isOpeningStyle/OPENING_MODELS/OpeningModel
- 10-15 helpers: frame (a straight host of 15 cm, normal +y), partsOf (a centred opening of the model with a style patch, optionally forced open), ys (the y of every corner of the parts with one role, via flatMap)
- 17-37 for each model at open 0, 0.5 and 1: valid style; more than 3 parts; top above bottom; finite corners within −0.4 … width + 0.4 and |y| below width + 0.4
- 39-41 the swing door, the sliding door and the casement window picked from the catalogue
- 43-49 panels and a lever add parts to a flush leaf; a glazed design adds glass
- 51-54 muntins 3 add 2 × 2 × leaves parts
- 56-61 the swing leaf's reach: below 0.1 closed, above 0.3 half open, further when fully open
- 63-67 the slider's leaf x shrinks when open; its y stays within 0.1
- 69-71 forced open equals open 1
- 73-79 isOpeningStyle refuses open 1.5, design 'carved', muntins 1; accepts a full valid style; suite closes (line 80 blank)

## Contracts, state and data flow
- openingParts is pure plan geometry from the opening, its station and the host frame. The 3D placement of a pivot door (F-0075) is not covered here.

## Depends on / used by
- uses: src/elements/opening (parts, schema, style)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flatMap : maps and flattens exactly one level (lines 15, 64)
