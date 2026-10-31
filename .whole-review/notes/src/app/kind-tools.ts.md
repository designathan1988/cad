# src/app/kind-tools.ts
Lines: 452
Summary: The click handlers of the tools that place the registry's kinds (guardrail, stair, roof, beam, separator, curtain wall, object, column, grid axis, section, callout, dimension, measure marks) and the level mark/note, plus their drafts shown in plan and the elevations (around the model and inside rooms). Functions over the App (app.ts delegates to them).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: the tools that place the registry's kinds, functions over the app
- 3-54 imports: registry (kindOfKey, withList; solidsOf imported again on line 16 from the same module), collision, sections, geometry, objects, units, vector, tolerance, plan-view type, i18n, every kind's add command and prefix, dimension anchor/tool, id, signedArea, App type, next-element made/nextOf, measure commands
- 56-70 addLevelMarkHere: a note of LEVEL_MARK_HEIGHT with empty text at the point (or the plan's centre), plan view, select tool, selected, the panel's FIRST input focused and selected
- 72-86 addNoteHere: a note with the default text (and a leader when given), selected, the panel's first text input focused and selected
- 88-95 railingClick: a click within 10 px of the last point ends; points closer than MIN_WALL_LENGTH ignored; else appended
- 97-106 railingFinish: fewer than 2 points dropped; else a railing made from the next guardrail (made) with these points
- 108-125 stairClick: first click is the first step's middle, the second gives the climb direction (atan2); straight stair from the next stair; selected
- 127-136 roofClick: corners appended; within 10 px of the first corner (3+ corners) finishes
- 138-158 roofFinish: outline made counter-clockwise (signedArea); kind = the chosen next roof form (hip by default) on a convex outline, flat otherwise; edges from the next roof's grade/overhang; a flat roof gets the next parapet; selected
- 160-173 beamClick: two clicks make a beam from the next beam; chained from its end
- 175-187 separatorClick: as beamClick but a room separator on the current level; shares ui.beamFrom as its start point
- 189-201 curtainClick: as beamClick for a curtain wall from the next curtain; shares ui.beamFrom
- 203-204 OBJECT_PREVIEW: the id of the object tool's preview instance
- 206-227 objectClick: the chosen definition's object from the next object, turned as the tool; with collisions on, elevation ≥ 0 and moved to the nearest free place (freePlace against obstacleShapes of the level)
- 229-235 columnClick: a column from the next column at the click
- 237-251 gridClick: two clicks make an axis named on from the last (nextGridName); not chained
- 253-260 gridEscape: drops the begun axis, else leaves the tool
- 262-270 depthFrom: a section's depth = the farthest model bounding-box corner along its look direction + 1 m, clamped to [1, DEPTH_MAX]; 10 m with no model
- 272-286 sectionClick: two clicks make a section looking to the line's left, named on (nextSectionName)
- 288-298 calloutClick: first click the arrow's point, second the note there with a leader to it (addNoteHere)
- 300-307 sectionEscape: drops the begun line, else leaves the tool
- 309-314 sectionDraft: the section being drawn (plan, section tool) to the snap or cursor
- 316-334 addElevations: four elevations 3 m around the model's box; skipped when an elevation of that translated side name already exists (matched by NAME in the current language)
- 336-363 addInteriorElevations: four elevations inside each enclosed room's bounding box (1 cm off, 30 cm deep into the wall), named "number-side", skipped when the same level+name exists
- 365-370 gridDraft: the axis being drawn and its future name
- 372-375 shownGrids: the axes as currently shown (plan only), what snapping sees
- 377-396 dimensionEvent: the dimension tool's state machine step; on make, anchors resolved at both points and the offset through the third point
- 398-408 dimensionDraft: the dimension being made, placed, with its length text
- 410-450 markClick: measure tool. radius: an arc wall hit within 8 px makes a radius mark; coord: point then label; angle: vertex, arm a, arm b (radius = half the shorter arm, ≥ 0.3 m); too-close points ignored

## Contracts, state and data flow
- Every new element is made through made()/nextOf() (next-element.ts): the "next" element is the template, as the goal asks.
- ui.beamFrom is shared by beam, separator and curtain tools: switching tool must clear it (setTool: to check).
- Elevations around the model are recognised by their translated name: after a language change or a rename, the same side is added again (F-0028).
- addLevelMarkHere focuses the panel's first input of any type; select() does nothing on non-text inputs (MDN).

## Depends on / used by
- uses: elements/* commands and schemas, app/collision.ts, app/geometry.ts, app/next-element.ts, tools/dimension-tool.ts, elements/dimension/anchor.ts, elements/measure/place.ts, ui/i18n.ts, ui/units.ts
- used by: app/app.ts (delegating methods), app/input.ts (tool clicks), app/frame.ts (drafts), app/context-actions.ts (add here): to confirm when read

## Problems found (finding IDs)
- F-0028 elevations around the model matched by translated name

## To check in other files
- app/app.ts setTool: clears beamFrom, gridFrom, sectionFrom, calloutFrom, markDraft, roofDraft, railingDraft
- the level mark's panel: is its first input the offset field

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/atan2 : atan2(y, x), y first, range −π..π, atan2(0,0) = 0 (line 120; the 5 cm guard on 118 avoids it)
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/select : select() selects a text field's text and does not focus by itself, hence focus() first (lines 67-69, 83-85)
