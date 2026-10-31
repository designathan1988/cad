# src/ui/icons.ts
Lines: 111
Summary: The one stroke icon set (24×24 paths) used across the interface: a table of path data by name, the IconName type, iconPath for composing (cursors), and icon() returning an inline SVG string (currentColor stroke 1.8, round caps, aria-hidden).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: one stroke set, 24×24, "stroke 2" (icon() draws 1.8)
- 3-101 (uniform: the path table, one icon per line, a few with a comment) home, undo/redo, chevrons, play/pause and walk (removed tour/walk: unused), table, tag, pin (its comment misplaced above `table` at 11), cube, collide, map, command, keyboard, sun, moon, download, folder, panel, sidebar, pointer, wall, slab, door, doorOpen, window, room, dimension, ruler, close, trash, arrows, plus, file new/open, zoom/frame, magnet, reference line marks, warning, flip, swing, center, distribute, guide, levels, explode, cut, xray, ortho, box, column, beam, roof, stair, railing, move, width, split, corner, merge, menu and language (unused), more, height, raise, lower, radius, text, hash, copy, rotate, scale, mirror, offset, align and distribute icons
- 103 IconName: the table's keys
- 105-106 iconPath: one icon's path data (for cursors.ts)
- 108-110 icon: the SVG string at a size, class "icon", currentColor stroke 1.8, aria-hidden

## Contracts, state and data flow
- Pure strings, inserted with innerHTML; the icons are decorative (aria-hidden), so each icon-only button needs its own aria-label or title.

## Depends on / used by
- uses: nothing
- used by: ui/shell, ui/controls, ui/fields, ui/browser, ui/panel, dialogs, app/ribbon-tabs, app/context-menu, elements/*/fields and kinds (icon names), ui/cursors (iconPath)

## Problems found (finding IDs)
- F-0036 (Also): walk, play, pause, menu, language unused
- F-0039 (Also): pin's comment over table; header says stroke 2
- F-0110 (Also): glyphs exist for the tools the cursor table leaves out

## To check in other files
- src/ui/shell.ts: icon-only buttons get an aria-label

## Sources
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-hidden : decorative icons are aria-hidden; the button needs an accessible name from its text (or aria-label for icon-only buttons); never aria-hidden on focusable elements (line 109)
