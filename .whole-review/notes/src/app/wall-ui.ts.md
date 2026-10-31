# src/app/wall-ui.ts
Lines: 314
Summary: The wall tool over the App (preview of the wall, rectangle or arc being drawn; wall number tags; measures shown while stretching, bending or turning; the typed end, rectangle corner; orientation and Space flip; making a wall from the defaults; the tool's events; the clockwise-loop warning) and the footer field's typed values for every tool (series of copies, Modify values, guides, arc radius, rectangle sides, points, lengths and angles, an opening's distance as its temporary dimension takes it, a selected wall's length).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: the wall tool, tags, typed measures, a chain closing a loop
- 3-20 imports: units, measure parsers, vector, tolerance, arc helpers, wall commands, opening commands, i18n, arc edit, wall-tool, document, stretchEnd, referenceLength, newId, App, PREVIEW_ID, tempDims (temp-dims.ts, F-0042)
- 22-37 previewWall: the rectangle's four sides, the arc being bent, or the segment to the typed/cursor end (none under MIN_WALL_LENGTH)
- 39-57 wallTags: the numbers of up to 12 selected walls, the hovered and the snapped one, on the level shown, a third along (an arc's at 70 % of its sweep)
- 59-77 turnMeasure: a stretched wall's length; a bent arc's radius and length; a turn's angle
- 79-91 bendMeasure: the arc being bent: radius and length at its middle, set off outward
- 93-102 rectCorner: typed "w;d" toward the cursor, else the cursor
- 104-112 drawingEnd: a typed point (absolute or @relative), else a typed length/angle, else the cursor
- 114-126 oriented: Space flips the direction (the exterior is the right side); toggleWallFlip
- 128-145 makeWall: the defaults' type, reference line, base and top; values equal to the type's not stored on the wall
- 147-163 wallEvent: the tool's transition; the typed field cleared per step; one segment added, or the rectangle's four as one step; a chain closed on its start checked for orientation
- 165-177 checkLoop: the last n walls' signed area; clockwise → hint that the exterior faces are inside
- 179-187 submitMeasure: "3x", "x3", "3*" or "/3" with Select → a series of the last copy
- 188-199 a Modify tool: a length (move/copy) or a number (rotate, scale…)
- 200-210 a guide being placed: its offset
- 211-221 an arc being bent: its radius
- 222-233 a rectangle: "width;depth"
- 234-253 a point "x;y" or "@dx;dy": a click for wall, guide, measure, dimension, floor, room tools; else a hint
- 254-261 a circle guide's radius
- 262-268 otherwise a length (and angle), at least MIN_WALL_LENGTH
- 269-282 the wall being drawn: typed length/angle; an opening being aimed: its distance (opening-tool adds the stop's base); an opening tool without a wall: hint naming the next-element, door and window keys as the user has them
- 283-301 one selected opening: the typed value goes through the temporary dimension on the side its rule measures from (fromEnd, fromOpening, else fromStart: the gap from the neighbouring wall's face or from the opening), its apply(value) dispatched, so the footer and the dimension mean the same (F-0042); on an arc host (no temporary dimension) the rule's distance along it from its reference end, as before
- 302-313 one selected wall: its end moved along so its length is the typed one (joined walls follow)

## Contracts, state and data flow
- The wall's exterior is the right of its direction; a clockwise loop puts exteriors inside (warned, not fixed).
- The footer field is one more dispatcher of typed values by tool (root cause 3's if-chains, F-0023).

## Depends on / used by
- uses: core/measure.ts, tools/wall-tool.ts, tools/arc-edit.ts, tools/edit.ts, elements/wall (commands, geometry/arc), elements/opening (commands, schema, derive), app/document.ts, app/temp-dims.ts, ui/units.ts, ui/i18n.ts
- used by: app/app.ts (delegates), app/input.ts / input-buttons.ts (the footer field), app/frame.ts (previews, tags, measures)

## Problems found (finding IDs)
- F-0042 fixed (283-301 use the temporary dimension's own command)
- F-0023 (another if-chain over tools at 179-313)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec : null or the match with one entry per group, undefined for groups that did not take part (lines 183-186)
- https://www.nngroup.com/articles/consistency-and-standards/ : internal consistency, the same thing meaning the same throughout a product (the footer and the temporary dimension, F-0042)
