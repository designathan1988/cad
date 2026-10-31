# src/elements/material/pattern.ts
Lines: 151
Summary: A material's procedural surface pattern (tiles, wood, brick, marble, granite, flagstone; stacked, running, herringbone or chequerboard; piece size, joint and its colour, second colour, variation, angle): defaults per kind, size limits, the guard, a repeatable tone per piece, and the pieces of one period of the pattern (painted into a texture by render/pattern-texture.ts).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: phase 8 procedural textures, no image; one period painted, laid in world metres
- 7-8 isColor: #rrggbb (a copy of schema.ts's, which imports this file)
- 10-14 PatternKind, PatternLayout and their lists
- 16-31 SurfacePattern: kind, layout, length, width, joint, joint colour, second colour, variation, angle
- 33-43 PATTERN_DEFAULTS per kind
- 45-48 PIECE_MIN 1 cm, PIECE_MAX 5 m, JOINT_MAX 5 cm
- 50 finite guard (another copy)
- 52-76 isPattern: known kind and layout, sizes and joint within limits, colours, variation 0..1, angle ±360
- 78-86 Piece: rectangle in the period, tone, alternate colour
- 88-89 REPEAT 4 pieces each way per period
- 91-95 tone: the fract(sin(x)·43758.5453) hash, deterministic, values not evenly spread (fine for colour variation)
- 97-103 patternPieces: one period's pieces
- 104-137 herringbone: n = length/width (at least 2), period 2 × n × width; runs laid diagonally, each piece wrapped into the period and laid once (keys to a micron); bounded by PIECE limits (at most about 500 per run, some thousands of pieces)
- 138-150 other layouts: 4 × 4 pieces with row shifts (half for running bond, quarters for wood), alternate colour for chequerboard

## Contracts, state and data flow
- Pure; the texture is rebuilt identically from the same pattern (deterministic tones).

## Depends on / used by
- uses: nothing
- used by: elements/material/schema.ts, commands.ts (isPattern), render/pattern-texture.ts, the materials dialog

## Problems found (finding IDs)
- none

## To check in other files
- render/pattern-texture.ts: texture size for a herringbone of small pieces

## Sources
- https://thebookofshaders.com/10/ : fract(sin(x) × large) as a deterministic pseudo-random; uneven distribution (lines 91-95)
