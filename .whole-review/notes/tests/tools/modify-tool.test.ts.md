# tests/tools/modify-tool.test.ts
Lines: 103
Summary: Tests of the Modify tools' clicks and typed values: what each step keeps and what it applies.
- Move and copy: base then target gives the translation. A typed distance goes toward the pointer. A value typed before the base is refused. Esc steps back, and at the start it leaves.
- Rotate: centre, start of the angle, end of the angle; or typed degrees after the centre.
- Scale: a reference stretched along itself gives the factor; behind the base gives none; a typed factor after the base.
- Mirror: two points of the axis, or a typed angle through the first point.
- Offset: one click, no base; as far off the line as the pointer, square to it. A typed distance goes to the pointer's side. On the line itself, or with no wall, it is refused.
- Not covered: a copy whose two clicks fall on the same point, which duplicates in place (F-0104).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: each step's state and transform, by hand
- 3-8 imports (vitest, vec, MODIFY_START/modifyTransition/previewTransform) and helpers at/click
- 10-17 move: base (1, 1) then (4, 5) maps the origin to (3, 4); back to the start
- 19-24 copy typed 2 toward (3, 4): (1.2, 1.6)
- 26-31 typed before base: rejected; Esc at 'second' → start; Esc at start → leave; suite closes
- 33-40 rotate: centre then (2, 0) → third step with ref; preview to (0, 2) maps (1, 0) to (0, 1)
- 42-48 typed 90 after the centre: (1, 0) → (0, 1); suite closes
- 50-56 scale preview: ref 2 m, pointer at (3, 0.4) → 1.5; behind the base → null
- 58-62 typed factor 2 about (1, 1): (2, 1) → (3, 1); suite closes
- 64-73 mirror about the y axis: (2, 3) → (−2, 3); typed 0° (the x axis): (2, 3) → (2, −3); suite closes
- 75-86 offset of the line (0,0)–(4,3): a click at (1, 2), 1 m to the left, maps the origin to (−0.6, 0.8); state stays at start
- 88-95 typed 2 with the pointer right → (1.2, −1.6); left → (−1.2, 1.6)
- 97-102 a click on the line or with no wall: rejected; Esc leaves; suite closes (line 103 blank)

## Contracts, state and data flow
- modifyTransition(tool, state, event, pointer, line?) returns {state, apply?, rejected?, leave?}. The apply is an affine transform the caller hands to the edit functions. previewTransform gives the transform while the pointer moves.

## Depends on / used by
- uses: src/core/vector, src/tools/modify-tool
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0104 (the zero-length copy is not covered)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Reflection_(mathematics) : reflection across a line through the origin, 2·proj − v (lines 64-73)
