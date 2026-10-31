# tests/tools/nudge.test.ts
Lines: 88
Summary: Tests of moving the selection with the keyboard (ref/chat.txt:242). The arrows move it 5 cm (the snap grid), or 1 cm with Alt.
- A wall moves and its corners follow.
- A door slides along its wall by the step's component along it, whatever its rule. A step across the wall does nothing. On a reversed wall, "right" slides it backwards. A centred window becomes fromStart where it lands.
- A member of a distributed group stays where the group puts it.
- A room's point and an outline floor move by the step.
- A room selected with all its walls moves once, not twice. Moving every wall of a room moves the room along.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: steps, and what each kind does
- 5-10 imports: vitest, arrowStep/nudge, document, geometry, derive, newOpening
- 12-33 wall helper; a 4 × 3 room with a door (fromStart 1), a window (fromEnd 0.5 on the top wall), a centred window (right wall), a room and an outline floor; start(); near()
- 35-42 arrowStep: ArrowRight 0.05; ArrowUp with Alt 0.01; ArrowDown −0.05; 'a' null
- 44-49 nudging l left by 1 cm: its start and b's start follow
- 51-63 d right 5 cm → 1.05; up → same doc; w right → start − 0.05 (reversed wall); c up 1 cm → +0.01 and its rule fromStart
- 65-68 an inGroup member: same doc (no move, nothing said)
- 70-76 room and floor moved by 5 cm; walls untouched (identity)
- 78-87 room plus its four walls: the seed moves once; the four walls alone: the room moves 5 cm up; suite closes (line 87; 88 blank)

## Contracts, state and data flow
- nudge rewrites each opening's rule kind by hand (F-0068 Also: nudge.ts slid). A group member silently does not move (line 67), and the user is not told why.

## Depends on / used by
- uses: src/tools/nudge, src/app/document, src/app/geometry, src/elements/opening (derive, schema)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0068 (Also: the per-kind rewrite and the silent group member, already listed)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values : the arrow keys' key values ArrowUp, ArrowDown, ArrowLeft, ArrowRight (lines 36-41)
