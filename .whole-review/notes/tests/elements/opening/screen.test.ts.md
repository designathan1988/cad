# tests/elements/opening/screen.test.ts
Lines: 44
Summary: Tests of a window's protection (phase 5, "venezianas e grades"), on a 1.20 m two-leaf sliding window:
- A grille adds 9 bars 12 cm apart and two cross bars outside the exterior face, and stays when the window is drawn open.
- A shutter adds two stiles and 23 slats (5 cm apart). When the window is drawn open, the shutter adds nothing: it is not drawn at all, although the header says "pushed aside" (F-0039 Also).
- The style accepts 'grille' and refuses 'curtain'.
- fitStyle removes the screen from a door and keeps it on a window.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: grille bars and shutter slats outside; the shutter "pushed aside" when open; doors have neither
- 4-9 imports: vitest, document, deriveGeometry, openingParts, newOpening/OpeningStyle, fitStyle/isOpeningStyle
- 11-17 a 4 m wall, a two-leaf sliding style, `parts` (a centred 1.2 × 1.2 window on a 1.0 sill, optionally drawn open)
- 19-26 grille: 9 + 2 extra parts; the same 11 extra when open
- 28-35 shutter: 2 + 23 extra parts, 23 of them with the leaf role (the float-stepped loop in parts.ts:302); open: no extra parts
- 37-43 isOpeningStyle accepts grille and refuses curtain; fitStyle removes a door's screen and keeps a window's shutter; suite closes (line 44 blank)

## Contracts, state and data flow
- Plan and 3D parts come from openingParts; the screen is part of the style and is checked when files are read. The slat count depends on a loop that adds 0.05 each pass (z += 0.05). The comparison z + 0.03 ≤ top is evaluated before each pass, so the count is exact only while the accumulated rounding error stays below the 3 cm margin, which it does for these sizes.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/opening (parts, schema, style)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0039 (Also: "pushed aside" in parts.ts:290 and this header, but an open shutter is not drawn)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for : the condition is checked before each pass and the afterthought runs after it (the slat loop behind lines 32-33)
