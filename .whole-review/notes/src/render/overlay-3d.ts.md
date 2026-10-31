# src/render/overlay-3d.ts
Lines: 187
Summary: A 2D canvas laid over the 3D view that draws what the plan draws while a tool works: the snap mark standing on the level's floor with a line up the level's height, the line being drawn and its length, its start, a draft outline, the section box with face handles, object handles and wall handles. Screen space; takes no pointer.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: tool feedback over the 3D view, in screen space, no pointer
- 6-11 imports: snapMark and drawHandles from plan-view, object handles, Point2, section box helpers, Handles type
- 13-33 Overlay3DState: projection, floor and height, snap, axis, measure, anchor, draft, box and its hot face, object handles, wall handles (its own copy of the plan's draft state: F-0014 Also)
- 35-37 BOX_HANDLE_R 7 px and BOX_HANDLE_HIT 12 px
- 39-49 Overlay3D: its 2D context; clear (fit then clearRect)
- 51-71 draw setup: device pixel ratio transform, theme colours read from CSS variables (getComputedStyle on every draw), a dashed line helper
- 72-92 the section box; the draft polyline; the axis; the anchor circle; the measure tag
- 93-95 object and wall handles (before the snap, which returns early behind the camera)
- 96-112 the snap: a dashed line up the level's height, the mark twice (halo and colour), its label
- 114-145 drawBox: dashed edges and a disc at each face's middle, the hot one larger and filled
- 147-153 mark: the plan's snap mark at a point
- 155-174 tag: text on a pad kept inside the canvas (reads computed style again)
- 176-186 fit: the backing store at CSS size × devicePixelRatio

## Contracts, state and data flow
- Redrawn by frame.ts from its own copy of the drafts (F-0014). Reads CSS custom properties each draw.
- The backing store follows devicePixelRatio on every clear (zoom and moving screens are handled because fit runs each draw).

## Depends on / used by
- uses: render/plan-view (snapMark, drawHandles), app/object-handles, app/section-box, app/handles (type), core/vector (type)
- used by: app/frame.ts (draw), app/view-3d and input (BOX_HANDLE_HIT)

## Problems found (finding IDs)
- F-0014 (Also): third copy of the draft/measure state

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio : backing store at CSS size × dpr, the context scaled; dpr changes with page zoom and display (lines 54-55, 176-185)
