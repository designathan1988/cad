# src/app/temp-dims.ts
Lines: 238
Summary: Revit-like temporary dimensions of the one selected element: a straight wall's length (on its quieter side) and the clear gaps to the nearest parallel facing walls; an arc wall's chord and radius; a door/window's distances to the nearest wall stop on each side (or to the opening it is measured from). Each carries the command a typed value makes.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: what is measured; a typed value becomes one command
- 6-18 imports: MIN_WALL_LENGTH, vector, Command, updateOpening, setWalls, bulgeKeepingSide, moveWalls/stretchEnd, wall offset/shape/arc, Doc, DerivedGeometry, wall-stops
- 20-31 TempDim: id, two points, side and clearance to draw, value, apply(value) → command or null
- 33-37 tempDims: one selected; a wall
- 38-54 an arc → arcDims; a straight wall: its length (typed: the end stretched along, at least MIN_WALL_LENGTH) and its gaps
- 55-66 an opening on a straight host: the host's line, half thickness, the stops before its start jamb and after its end jamb (faces of walls meeting it, or the ends)
- 67-87 fromStart: the gap from the stop before; typed → rule fromStart with distance stop + v; fromEnd likewise from the stop after. Typing stores a rule whose distance is measured from a NEIGHBOURING WALL's face, which keep-openings.ts then preserves when that wall moves (root cause 2, F-0008)
- 88-104 measured from another opening on that side: the gap to it, typed keeps the fromOpening rule; negative gaps dropped
- 106-108 doc of arcDims: chord away from the bulge; radius from the centre; typed chord keeps the sweep, typed radius the ends
- 109-119 the arc, chord, the radius line at 30 % of the sweep (not over the chord's label)
- 120-144 chord (typed: end moved along the chord) and radius (typed: bulge for that radius on the same side, null when impossible)
- 146-147 thicknessOf: the type's layers summed (the same as document.ts wallThickness, written again)
- 149-174 quieterSide: the side with fewer walls standing on the flank (their ends on its body), left on a tie
- 176-180 doc of gapDims: nearest parallel facing walls each side, across the gap at the middle of the overlap; typed moves the wall with its joins
- 181-199 the wall's shape, faces; per other straight parallel wall on the level, the overlap of their runs
- 200-209 the other's faces across this one's normal (sign by its normal's way); the nearest above f1 and below f0
- 210-237 the gap dimensions; typed → moveWalls across by the difference, as one cmd.move

## Contracts, state and data flow
- The opening dims show the gap to a wall face (a stop); typing writes a fromStart/fromEnd distance that includes that stop: the opening's position then depends on the other wall (keep-openings.ts). Explicit position (goal's fix) means storing the distance from the host's own end.

## Depends on / used by
- uses: app/wall-stops.ts, tools/edit.ts, tools/arc-edit.ts, elements/wall (commands, geometry), elements/opening/commands.ts, core/vector.ts
- used by: app/frame.ts (temporary dimension fields and their apply)

## Problems found (finding IDs)
- F-0008 (also here: lines 76 and 85 store face-measured distances)

## To check in other files
- app/wall-stops.ts stopBefore/stopAfter

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce : with an initial value an empty array gives it back (line 147: a type without layers → 0 m)
