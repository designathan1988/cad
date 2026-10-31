# tests/tools/guide-tool.test.ts
Lines: 74
Summary: Tests of placing guides, worked by hand on a 20 cm straight wall along x and an arc wall above it.
- What a guide is set off from: the straight wall under the pointer or within 6 px of it, with its faces. An arc, another level, or walls hidden give nothing. An existing guide off any wall acts as a line without a body.
- The distance the pointer sets is measured from the face on its side. With snaps it falls on the 5 cm grid (1.2 m above the top face is y = 1.3); without snaps it is taken as pointed (1.21). Below the wall it is measured from the bottom face. Inside the wall's body it is 0.
- A typed distance takes the side the pointer is on. Its dimension runs across the wall where the pointer is. newGuide builds the guide.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the wall worked by hand, faces at ±0.1
- 4-7 imports: vitest, document, the guide-tool functions, vec
- 9-20 wall helper; a straight wall and an arc (bulge 0.3) at y 5; MPP 0.01 (6 px = 6 cm)
- 22-27 the wall under (3, 0.05) with faces [−0.1, 0.1]; within reach at 0.15; nothing at 0.2
- 29-33 the arc gives null; another level null; walls hidden (visibility flags) null
- 35-41 a guide at y 2 is found at (40, 2.03) with faces [0, 0]; with guides hidden, null; suite closes
- 43-54 base from the wall; pointer at (2, 1.31): side +1, offset 1.2 with snaps, line at y 1.3 along x; 1.21 without snaps
- 56-62 at (2, −0.9): side −1, offset 0.8, line at −0.9; at (2, 0.04) inside the body: offset 0
- 64-73 typed 1.2 from (2.5, 0.06): line at 1.3; the measure from (2.5, 0.1) to y 1.3; newGuide has id, level and direction; suite closes (line 74 blank)

## Contracts, state and data flow
- Pure. The base is found on screen-scaled reach (mpp), respecting layer visibility. The draft gives a side and an offset from the base's face, and the guide line and its temporary dimension come from it. guideBaseAt returns null when nothing qualifies, and the test reads it with optional chaining.

## Depends on / used by
- uses: src/app/document, src/tools/guide-tool, src/core/vector
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining : a?.b is undefined when a is null (line 25, guideBaseAt(...)?.wallId)
