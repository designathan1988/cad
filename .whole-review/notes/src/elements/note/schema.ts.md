# src/elements/note/schema.ts
Lines: 67
Summary: The note element (text at a point with a letter height; a level mark says its level's elevation plus an offset; a callout has a leader), defaults, where a leader leaves the text's box, a level mark's signed text, id check, the shown letter height at a scale, and the text's box estimated from character counts.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-7 header: notes print at the plan's scale; "drawn in plan and in the DXF" (export taken out: F-0047); level marks held by their level
- 9 imports: Point2
- 11-15 NOTE_PREFIX; NOTE_HEIGHT 25 cm; LEVEL_MARK_HEIGHT 20 cm
- 17-29 Note: id, level, point (middle), text, height, elevation offset (mark), leader (callout)
- 31-39 leaderStart: the box edge on the line from its middle to the arrow
- 41-45 elevationText: rounded to cm; ±0 (also for −0, since −0 === 0), + or the true minus sign
- 47 isNoteId: the prefix and an underscore
- 49-53 NOTE_MIN_PX 10 and shownHeight: never under 10 px on screen
- 55-66 noteBox: width from the longest line's length (UTF-16 code units: an emoji counts 2) × 0.6 of the height, lines × 1.3; a mark's box from its symbol to its text

## Contracts, state and data flow
- The box is an estimate (no font metrics): hits and framing are approximate for wide or narrow letters.

## Depends on / used by
- uses: core/vector.ts (type)
- used by: elements/kinds/note.ts, elements/note/commands.ts, fields.ts, app/kind-tools.ts, app/selection-ui.ts (isNoteId)

## Problems found (finding IDs)
- F-0047 (header DXF mention)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length : UTF-16 code units (emoji 2) (line 63)
