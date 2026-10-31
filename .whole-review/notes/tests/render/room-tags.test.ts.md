# tests/render/room-tags.test.ts
Lines: 71
Summary: Tests of room tag layout in plan.
- A tag follows its room and is never pinned to the edge of the canvas.
- It shrinks to the number and area when the room is narrower than its name, and to the number alone when narrower still.
- It is left out when its point is off the canvas, or when it would cover a tag already placed.
- It moves below a temporary dimension value it would cover, or above it when there is no room below.
- A tag moved off a value stays inside its room's outline. In a closet with no room for it, it is left out; otherwise it goes below or above the value, wherever the room has space.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: follow the room, shrink, leave out rather than overlap
- 4-5 imports: vitest, layoutRoomTags
- 7-9 a 7 px-per-letter measure, an 800 × 600 view, a tag builder (point, width on screen, name, short, area)
- 11-15 a wide room: name and area, centred at x 400
- 17-20 70 px: number and area; 30 px: number only
- 22-24 points off the canvas: no tags
- 26-30 a second tag overlapping the first is dropped; suite closes
- 32-39 with a value box: the tag goes below it; near the canvas bottom, above it
- 41-50 the closet case worked out (a 57 × 32 tag in a 60 × 50 room); the value and rect helper
- 52-55 the closet with an outline: no tag
- 57-62 a deep room: below the value and within the outline's bottom 400
- 64-70 a room only above the value: the tag above it and within its top 240; suite closes (line 71 blank)

## Contracts, state and data flow
- Pure layout. Text widths come from a measure function (the canvas measureText with the current font in the app). It returns lines and boxes on screen, in placing order, never overlapping.

## Depends on / used by
- uses: src/render/room-tags
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText : returns TextMetrics with width, measured in the context's current font (the measure stub, line 7)
