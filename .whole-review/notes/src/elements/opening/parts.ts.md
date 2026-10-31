# src/elements/opening/parts.ts
Lines: 369
Summary: The 3D solids of a door or window as upright prisms over counter-clockwise plan polygons, each with a role (leaf, glass, frame) and an optional tilt. A plain opening is one slab (a door's turned square to the wall when open). A styled one gets frame, sill stone, stop, casing, threshold, transom, and leaves or panes by operation (sliding, overhead/roller, folding, swinging, double-hung, casement, awning/hopper/pivot tilt), screens, muntins, leaf designs and handles.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-7 header: phase 5 solids "for the 3D view and the GLB alike" (GLB export left: F-0047); plain vs styled; drawn open
- 9-13 imports: vector ops, schema types, paneRows/paneSpans, symbolLines, OpeningFrame
- 15-23 OpeningPart: polygon (ccw), bottom, top, role, optional turn about a level axis
- 25 Placed: the opening with its stations and heights
- 27-30 ccw: shoelace sign, reversed (in place) when clockwise
- 32-38 slabAlong: a slab of 2·half thickness along p→q
- 40-56 leafParts doc and signature: hinge point, direction, length, half thickness, heights, design, handle, hinges
- 57-70 setup: too small skips; R(s, w) box on the leaf; stile and rail sizes; both faces
- 71-86 framed: stiles and rails round glass (with beads both faces) or slats every 4.5 cm
- 87-100 panels: raised panels in rows, both faces, with margin and moulding
- 101-126 design switch: glazed, slats, half-glazed (panel below 45%), panels (3 rows over 1.6 m), grooves every 15 cm, flush
- 127-144 handle at min(1 m, middle), 6.5 cm from the free edge, both faces: lever, knob or pull bar
- 145-147 three hinges on the hinge edge unless told not to
- 149-157 openingParts: faces and middle; open amount (forced to 1 when opened in the view)
- 158-166 plain opening: one slab in the middle, or a door's along its plan symbol's leaf when open
- 167-182 styled setup: along, width, P(t, off), box, lo/hi faces, parts with push (keeps the current turn), frame size and clear width
- 183-197 frame: jambs, head, window sill frame and sill stone sloped past the outside face, a door's stop mouldings
- 198-208 casing on both faces; threshold for a door
- 209-217 transom glass and bar (only when it leaves 30 cm); bottom of the leaves
- 218-231 sliding: n leaves on two tracks with 5 cm lap; open, slid toward the hinge side (a single leaf cannot move: F-0072)
- 232-252 swung: hinge and open direction from the plan symbol's leaf lines; turned by amount of 90°; closed in the middle of the wall
- 253-255 default design and handle by operation
- 256-285 doors: sliding, overhead/roller raised by amount, folding (folded against the hinge jamb when ≥ half open, else closed), swinging (single, double, pivot without hinges)
- 286-303 windows: outside side; grille bars every 12 cm with two cross bars; shutter slats only when closed (F-0072)
- 304-322 pane: sash bars, glass, muntins m × m
- 323-326 panes at mullions/transoms or equal (paneSpans × paneRows)
- 327-329 tilt: sets the turn for the panes pushed next
- 330-368 window operations: sliding, double-hung (lower sash raised), casement swung out with sashes, awning/hopper/pivot tilted, then panes; turn cleared

## Contracts, state and data flow
- Pure; polygons always ccw (shoelace sign) for the extruder.
- Plain openings keep their pre-style look; swinging leaves follow symbol.ts so plan and 3D agree.
- `turning` is module-local state within one call: set by tilt, read by push, cleared after the panes.

## Depends on / used by
- uses: core/vector, opening/schema (types), style (paneRows, paneSpans), symbol (symbolLines), void (OpeningFrame)
- used by: the 3D scene's opening meshes (render/scene-3d.ts through app/geometry)

## Problems found (finding IDs)
- F-0072 (S4): single sliding leaf never opens; shutter vanishes when open
- F-0075 (S3, found reading symbol.ts): swung() takes the pivot leaf's back point as a hinge, so a closed pivot door is shifted by a sixth of its width

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Shoelace_formula : a positive signed area means counter-clockwise vertices (lines 27-30)
