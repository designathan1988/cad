# src/elements/opening/symbol.ts
Lines: 213
Summary: The plan symbol of a door or window as world polylines. A plain door draws its leaf at 90° and the quarter arc; a plain window draws face and glass lines. A styled opening draws its jamb frames, casing, threshold, and per operation the swinging leaves and arcs, pivot, sliding tracks, folding zigzag, overhead or roller dashes, and window panes and mullions. Also the floor a door's leaves sweep, used for swing clashes.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 header: plain and styled symbols as plans draw them
- 8-11 imports: vector ops, Opening, paneSpans, OpeningFrame
- 13-19 Placed type; Sweep (leaf line and arc)
- 21-27 frameAt: along, width, P(t, off)
- 29-37 arcPoints: quarter arc of 24 steps from u toward v about c
- 39-56 sweeps for a plain door: hinge and strike at the swing face, the leaf out by the chord width, the arc back
- 57-66 styled setup: frame a, b, clear; one(t, toward, w) hinge at the face
- 67-77 swing (by hinge), double (two half leaves), casement (one, or pairs hung from jambs and mullions opening apart)
- 78-89 pivot: pivot a sixth in from the hinge jamb, leaf from short behind to long in front, a small counter-arc (3D uses this line wrongly: F-0075)
- 90-93 others sweep nothing
- 95-105 bar (closed thin rectangle) and dashes (10 cm every 20 cm)
- 107-121 symbolLines: none without a frame; plain window three lines; plain door leaf and arc
- 122-136 styled: jamb frames across the wall, casing bars on both faces past the jambs
- 137-147 tracks: sliding leaves overlapped 5 cm on two tracks
- 148-160 windows: face lines, then sliding tracks, double-hung two lines, or the glass line, mullion lines and casement sweeps
- 161-195 doors: threshold lines; sliding tracks; folding zigzag at 30° on the swing side; overhead dashes; roller line and dashes outside; else leaves and arcs
- 197-212 swingRegion: one leaf as hinge plus every third arc point; two leaves as the box over both; null for windows and non-swinging doors (the pivot's counter-swing is left out)

## Contracts, state and data flow
- Pure. "Left" swing opens toward the frame's normal; parts.ts and sides.ts follow the same convention.
- parts.ts reads the leaf lines of this symbol to place 3D leaves (lines of 2 points across the wall); that coupling misplaces pivot leaves (F-0075).

## Depends on / used by
- uses: core/vector, opening/schema (type), style (paneSpans), void (OpeningFrame)
- used by: render/plan-view (symbols), opening/parts.ts (symbolLines for 3D leaves), app/geometry (swingRegion for swing clash warnings)

## Problems found (finding IDs)
- F-0075 (S3): pivot leaf line misread by 3D (closed pivot door shifted)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Door : a pivot door turns on a bearing set in from its edge, so both sides of the pivot move (lines 78-89; F-0075)
