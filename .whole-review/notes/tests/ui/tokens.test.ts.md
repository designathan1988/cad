# tests/ui/tokens.test.ts
Lines: 41
Summary: Tests the design-token rules of styles.css (ref/chat.txt:227 and :244):
- No size in px outside the token definitions.
- Target sizes (control heights, field height, wide buttons, tool width) are at least 32 px, and at least 44 px under `pointer: coarse`. The tool width is not checked for touch.
- Every token used with var() is defined. The reverse is not checked, so unused tokens such as the removed areas' pass (F-0131).
- No colour outside the tokens.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: tokens defined once, no px or colour of its own elsewhere
- 4-12 imports (node:fs, vitest); the stylesheet as text; declaration lines that are not token definitions, comments or @media lines
- 14-17 no 'NNpx' in those lines
- 19-29 targets read from the first :root block and from the first `@media (pointer: coarse)` block up to its first closing brace: five ≥ 32; four ≥ 44 on touch
- 31-35 every var(--x) has a --x: definition somewhere (unused definitions not checked)
- 37-40 no #hex, rgb(a) or hsl(a) in the declaration lines; suite closes (line 41 blank)

## Contracts, state and data flow
- Text checks on the stylesheet, line by line. They rely on token lines starting with `--` and on one declaration per line. The touch block is cut at its first `}`, so only tokens declared before the first nested rule's end are read. 32 px is above WCAG 2.2's 24 px minimum (2.5.8).

## Depends on / used by
- uses: node:fs, src/ui/styles.css (as text)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none new (dead tokens pass this test: F-0131)

## To check in other files
- none

## Sources
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html : WCAG 2.2 SC 2.5.8 asks for 24 × 24 CSS px targets, 2.5.5 is stricter (lines 19-29)
