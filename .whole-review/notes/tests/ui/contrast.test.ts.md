# tests/ui/contrast.test.ts
Lines: 87
Summary: Tests the contrast of the design tokens in both themes (ref/chat.txt:228). Tokens are read from styles.css, and the WCAG formula requires 4.5:1 for text and 3:1 for controls, outlines and large marks. 19 token pairs are checked: text, labels, units, canvas labels, the live measure, selection, the main button, warnings, errors, snaps, tooltips, selection on the drawing, the focus ring, dialog edges and the wall line on a core layer. The wall line is also checked against every built-in material as the plan paints it, darkened in the dark theme.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: tokens from styles.css, WCAG thresholds
- 4-8 imports (node:fs, vitest, BUILT_IN_MATERIALS, cutFill); the stylesheet read from disk
- 10-20 tokens(): the custom properties of the first block exactly matching a selector; light = :root; dark = light overridden by the first :root[data-theme='dark'] block (the second block at styles.css:2228 is not read: F-0131 Also)
- 22-34 luminance (rgb(r g b) or #rrggbb, sRGB linearised, WCAG weights) and ratio
- 36-60 the 19 pairs with their minimums; the wall line held to 4.5 because a 1 px antialiased line loses some (the tester measured 2.95 at a 3.1 pair)
- 62-73 per theme: every pair at or above its minimum
- 75-84 per theme: the wall line on each built-in material's cut fill (darkened by --material-shade) at 3 or more
- 85-86 suites close (line 87 blank)

## Contracts, state and data flow
- Reads the stylesheet as text; the token parsing assumes `selector {` on one line and the first closing brace. The title bar's colours are in no pair.

## Depends on / used by
- uses: node:fs, src/elements/material/schema, src/ui/styles.css (as text)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0131 (Also: two dark blocks, the title bar pair missing)

## To check in other files
- none

## Sources
- https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html : 4.5:1 for text, 3:1 for large text; relative luminance and the contrast ratio formula (lines 22-34, 37-60)
