# src/elements/kinds/note.ts
Lines: 181
Summary: Text notes, callouts (a note with a leader) and level marks in the registry: validation, derivation (a level mark's text is the height it says), selection by box or leader, moving/mapping (letters stay upright), plan drawing (lines centred, leader with arrowhead, level symbol), fields; plus a dead DXF writer (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: notes and level marks; a level mark's text is its height
- 4-10 imports: guards, num/t, contract types, note commands/fields/schema, nearSegment
- 12-13 boxAt: the box at the letters' shown height for a scale
- 15-33 the kind: key, prefix, no category, layer over, icon, titles (level marks named so), dropped, exportName/exportColour (F-0047)
- 34-44 valid: id, level, point, text, height > 0, a note's text not blank (updateNotes refuses an empty text, note/commands.ts:32), a level mark's finite offset, leader point
- 45-50 derive: a level mark's text from its level's elevation + offset
- 51-62 element; outlines: the box at the scale
- 63-67 hit: inside the box (+ near) or near the leader
- 68-74 extent (box at nominal height + leader); picked before walls
- 75-78 moved (with the leader), mapped (point and leader; letters upright), similar (same height)
- 79-108 plan: letters at the shown size; leader; level symbol and height, or lines split on \n (fillText draws one line) centred 1.3 apart; a dashed box when selected
- 109-129 dxf: texts, level symbol and leader on a DXF layer (F-0047)
- 130-132 fields: noteFields with updateNotes and dropLeaders
- 134-157 drawLeader: line to 6 px short of the point, filled arrowhead
- 159-180 levelMark: a crossed circle with two opposite quarters filled, the height to the right

## Contracts, state and data flow
- Notes stay readable upright under Modify tools (only their points move).

## Depends on / used by
- uses: core/guards.ts, ui/i18n.ts, elements/note/*, elements/kinds/paint.ts
- used by: elements/registry.ts; drawLeader by render/plan-view.ts (callout draft: to confirm)

## Problems found (finding IDs)
- F-0047 (exportName/exportColour, dxf)

## To check in other files
- elements/note/schema.ts shownHeight/noteBox

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillText : one line per call (split on \n by hand); textAlign/textBaseline place it about (x, y) (lines 89-96, 178-179)
