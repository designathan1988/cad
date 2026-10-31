# src/ui/cursors.ts
Lines: 39
Summary: The CSS cursor over the drawing per tool: a 32 px SVG data-URL cursor with an aiming cross (hotspot at its centre, 10,10) and the tool's icon at its lower right, white-outlined dark strokes for both themes, falling back to crosshair; `grabbing` while panning; the plain arrow for tools without a glyph. Cached per tool.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: the pointer tells the tool; a cross to aim and the tool's icon; readable on both themes
- 5-6 imports: icon paths and the ToolId type
- 8-15 GLYPH: icons for only six of the 27 tools (F-0110)
- 17-26 aim: the SVG (cross drawn twice: white 3.2 wide, dark 1.2 wide; the icon scaled 0.55 at 17,17, white and dark) as a url() cursor with hotspot 10 10 and crosshair fallback
- 28 cache: one string per tool
- 30-38 toolCursor: grabbing while panning; default for tools without a glyph; else the cached aim cursor

## Contracts, state and data flow
- Pure but for the cache; the caller sets the canvas's style.cursor.

## Depends on / used by
- uses: ui/icons (iconPath, IconName), ui/shell (ToolId)
- used by: app/frame.ts (the drawing's cursor per tool on each frame)

## Problems found (finding IDs)
- F-0110 (S4): most tools get the arrow

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/CSS/cursor : url() with hotspot x y and a mandatory keyword fallback; 32×32 recommended, 128 px cap in Firefox/Chromium; static SVG supported (lines 17-26)
