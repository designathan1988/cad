# tests/app/handles.test.ts
Lines: 146
Summary: Tests of the selection handles: end squares, stretch arrows 20 px beyond straight walls' ends, the turn handle 28 px under the selection (under a major arc's real extent, under an upright wall's lower arrow), the curvature handle at an arc's middle, several walls (turn only), nothing (none), hit priority (turn, arrows, squares); the turn handle pushed below temporary dimension values; a door's flip controls on the leaf's side and their priority.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: squares move ends, arrows stretch, an arc turns; reach larger than drawing
- 5-7 imports: vitest, doorFlips/handleAt/handlesFor, DocWall type
- 9-19 wall helper with optional bulge
- 21-22 toScreen: 100 px per metre, y down
- 24-95 handles: straight wall positions; an arc has no arrows; the curvature handle at the arc's middle and hit; a major arc's turn handle under its whole extent (checked: sweep 4·atan 2, radius 1.25); upright wall keeps its arrow reachable; no curvature for straight; several walls; none; hit order
- 97-115 turn handle pushed below one or two covering values; left alone otherwise
- 117-145 door flips: on the leaf's side 16 px out, swing left and hinge right of the middle; the other side; none under 36 px; hit before other handles

## Contracts, state and data flow
- Pure screen-space handle layout and hit testing.

## Depends on / used by
- uses: src/app/handles, src/app/document (type)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#tobenull : toBeNull is toBe(null) (lines 74, 93)
