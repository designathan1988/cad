# src/render/plan-view.ts
Lines: 1250
Summary: The plan view on a 2D canvas. It covers the view's transform (scale, centre, fit, zoom about the cursor, pan, kept top-left on resize) and the grid. Walls are drawn as cut or seen, joined by stroking then filling, by layer with materials, hatches and seams when wide enough, with phase and override colours. It also draws arcs as true circles, the registry's kinds in layers, openings with warnings, drafts, tags (room, wall, opening) kept off dimension values, temporary dimensions, smart guides, snaps and handles. It still holds the print path of the removed area.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: reads derived geometry and draws; joined outline by stroking every piece then filling over the strokes
- 5-22 imports: kinds' drawers (note leader, section mark, axis, dimension), drawing settings, object handles, registry eachSolid, arc helpers, geometry, room tags, handles type, opening symbol, cut fills, hatch, label separation
- 24-39 crisp: axis-aligned 1 px lines moved onto pixel centres
- 41-52 LAYER_DETAIL_PX 6, MIN_TAGGED_PX 18, byLayers (one decision for the whole view from the thinnest wall)
- 54-62 DimMark: a temporary dimension
- 64-65 GRID_BUBBLE_PX re-exported from the grid kind
- 67-146 PlanOverlay: selection, hover, room space, preview walls, drafts (dimension, grid, section, callout, calibrate, guide), reference lines, mirror axis, ray, snap, measure, axis, handles, object handles, anchor, wall tags, opening tags, room labels, draft polyline, acquired points, circle draft, smart guides, draft corners, opening preview, temporary dims, underlay (two doc comments left without fields at 74, 77: F-0039 Also)
- 148-155 Insets: what panels cover; NO_INSETS
- 157-171 fitPlan: 70 % of the visible part, scale 2-4000 px/m, centre at the visible part's centre
- 173-191 PlanView fields: label boxes, scale, centre, drawing settings, overrides, phases, room overrides, `printing` for paper (the removed print: F-0095 Also)
- 192-202 constructor with an optional context (the vector page: F-0095 Also)
- 204-221 size: canvas size; on a change the top-left stays put (the centre moves by half the change)
- 223-254 toScreen, dimLine, toWorld, zoomAt (point under the cursor fixed), panBy
- 256-265 frame: fit a box or 10 m around the origin in the visible part (two stacked doc comments)
- 267-275 pen width in plan units; detail from the scale
- 277-290 draw start: backing store at dpr, colours from CSS variables (or paper's), background and grid
- 292-336 solids; trace; edgeOf and piecePath: arc wall chords drawn as the face circle when both ends lie on it
- 337-350 the level below, faint, filled only
- 351-367 paint context for the kinds; kinds under the walls (floors, rooms) drawn first
- 368-393 room overrides tinted; the room the room tool would make, dashed
- 394-410 miter join limit 2; outline(): every piece stroked
- 411-425 by layers only at fine detail and when the thinnest wall is wide enough; phase colours; overridden or phased walls not layered
- 426-463 fill(): pieces grouped by colour and by cut pattern (arrays copied on every add: quadratic per frame), one path per colour filled and stroked 1 px, hatches over them
- 464-487 seams(): lines between layers (along the circle on arcs, crisp otherwise)
- 488-513 seen walls (not cut): outline only, clipped to outside their pieces, dashed above the cut; cut walls outlined, filled, seamed
- 514-533 hover and selection outlines and fills; walls being drawn as a preview
- 534-559 kinds over the walls; openings; drafts (axis, grid, section, callout, calibrate with its label); kinds 'over'; guide and mirror axis lines; reference lines; ray; opening tags; room tags kept off values and lines; kinds 'top'; the dimension draft (a stale comment about norms at 558: F-0039 Also)
- 560-583 the draft polyline dashed and its corners as small squares
- 584-601 wall tags moved off dimension values and room tags
- 602-613 handles, object handles, the anchor circle
- 614-645 temporary dimensions; smart guides (dashed lines, equal gaps with ticks and lengths)
- 646-674 circle draft, acquired points as plus signs, the snap and the live measure kept off it
- 676-679 drawHandles: the shared handle drawing
- 681-691 dimValueBoxes: value boxes placed apart (dim-labels.ts), shared with the app's buttons and tags
- 693-739 drawRoomTags: room-tags.ts layout avoiding values and dimension lines; padded name and area lines, warnings coloured
- 741-768 drawOpeningTags: rounded outlined tags, skipped when the opening is under 18 px
- 770-777 font(): a misplaced doc comment (grid axis) above it; size from CSS variables (or millimetres on paper); getComputedStyle on every call
- 779-794 drawMeasure: set off along the segment's normal past the wall face, moved further while it covers the snap label
- 796-800 textWidth: sets the font and measures the text
- 801-819 boxAt and tag: a padded text kept inside the canvas
- 821-856 drawOpenings: the selected or previewed opening's outline filled, its plan symbol stroked (selection colour, warning colour when invalid), a warning sign for invalid ones
- 858-876 clearOfHandles: the sign moved across the wall away from the selection's handles
- 878-897 warnSign: a triangle with "!" readable without colour
- 899-936 drawGrid: a step from 5 cm to 100 m keeping ~24 px between minor lines, major lines every metre (or 5 steps), x and y axes at the origin
- 938-972 drawRefLine: the reference line (an arc in 32 steps), a dot at the start, an arrow short of the end
- 974-1001 drawLine: an endless line across the canvas, crisp when level or upright, dashes fixed to the plan
- 1003-1016 dashed: a dashed segment
- 1018-1033 drawSnap: the guide's dashed line, the mark by kind, its label beyond the segment's end
- 1035-1070 drawDim: extension lines, the dimension line and 45° ticks (the value is a DOM field)
- 1072-1091 label (the class closes at 1091): a padded tag at a world point plus an offset, kept inside, its box returned
- 1093-1100 Box and overlaps
- 1102-1176 snapMark: the mark's shape by snap kind (square, triangle, diamond, circle, circle with dot, ⊥, hourglass, plus, grid dot, cross)
- 1178-1210 drawHandles: squares at ends, arrows along walls, the arc's diamond
- 1211-1230 flip controls: a disc with a double arrow (as Revit's)
- 1231-1249 the rotate handle: a disc with a three-quarter arc and an arrowhead; restore

## Contracts, state and data flow
- Reads derived geometry and an overlay; never changes the project. Colours come from CSS variables read through getComputedStyle at every draw and in every font() call.
- Each frame rebuilds colour/pattern groups by copying arrays per piece (quadratic in pieces of one colour).
- The print path (`printing`, vector context) belongs to the removed print and PDF (F-0095 Also); nothing sets it now.
- The 3D overlay keeps its own copy of the drafts (F-0014).

## Depends on / used by
- uses: elements/kinds (note, section, grid, dimension drawers), drawing schema, object handles, registry, arc helpers, app/geometry, room-tags, handles, opening symbol, material schema, hatch, dim-labels
- used by: app.ts (the plan renderer), frame.ts (draw each frame), render/overlay-3d.ts (snapMark, drawHandles), app/section-drawing (crisp?), view-ui (fitPlan, frame)

## Problems found (finding IDs)
- F-0095 (Also): print path and vector-page context left from the removed area
- F-0039 (Also): leftover and misplaced doc comments (74, 77, 256-260, 558, 770)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineDashOffset : the dash pattern's phase, in the same units as the dashes (lines 974-1001)
- https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio : backing store at CSS size × dpr and the context scaled (lines 277-285; opened for overlay-3d.ts)
