# src/app/view-keys.ts
Lines: 24
Summary: Pure mapping of view keys: + or = zoom in, − zoom out (not while a measure is being typed), Shift+arrows pan 80 px; Ctrl/Alt combinations are left to other shortcuts.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: zoom about the middle, Shift+arrows pan (or turn 3D), plain arrows nudge, − is a sign while typing
- 5 ViewKey: a zoom factor or a pan in px
- 7-8 PAN_PX 80, ZOOM 1.25
- 10-14 viewKey: Ctrl/Alt → none; + or = → zoom in; − (not typing) → zoom out; without Shift nothing else
- 15-23 Shift+arrow → a pan opposite the arrow (the content follows as a drag would)

## Contracts, state and data flow
- These keys are literal here, not actions in actions.ts with keymap entries: a user cannot remap them and the keys dialog/help do not list them from one place (root cause 1, F-0021).

## Depends on / used by
- uses: nothing
- used by: app/input-keys.ts (viewKey), tests/app/view-keys.test.ts

## Problems found (finding IDs)
- F-0021 (another literal key table)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key : key is the character produced (layout and Shift applied); arrows are "ArrowLeft" etc. (lines 12-22)
