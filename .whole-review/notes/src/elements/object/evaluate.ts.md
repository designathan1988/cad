# src/elements/object/evaluate.ts
Lines: 541
Summary: A parametric object evaluated (pure): its parameter values (instance, type, default; calculated ones in rounds; held to their ranges), its parts placed in the world (repeated, conditional, nested up to 4 levels, leaning, turned) as pieces in their materials, its handles, out-of-range and rule warnings, its lights; an object that would lose parts is held at the least size that keeps them; plus piece spans and plan outlines.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: values (instance over type over default, calculated after), parts placed, repeated, conditional, nested, in their materials; handles; rules; a failing formula is a problem said, never thrown
- 7-9 imports: Material/materialIn, formula (Env, evaluateFormula, Value), schema types
- 11-23 Piece: box (centre, size, turn, material, round, tilt/roll), cylinder, profile, revolve, sphere/ellipsoid, mesh; `cut` marks a void
- 25-32 PlacedLight: position, lumens, colour
- 34-42 PlacedHandle: parameter, axis, place, direction, shift
- 44-59 ObjectEval: env, materials, pieces, handles, problems, warnings, lights, lost parts
- 61-65 ObjectContext: definitions and materials
- 67-68 MAX_REPEAT 500 per part; MAX_DEPTH 4 nesting levels — no limit on the total: a part repeated 500 times nesting an object whose part repeats 500 times… reaches 500⁴ pieces (F-0060)
- 70-76 Frame and apply: a local point turned and moved into the world
- 78-95 values: each plain parameter's value given/default, a material kept as its name, a number held (non-finite → a problem and the default)
- 96-115 calculated parameters in rounds until none resolves more; those left are "circular" or failing, given their default
- 117-118 LENGTH_LIMITS 1 mm to 500 m
- 120-131 sizeParams: lengths named largura/profundidade/comprimento/altura (Portuguese names hard-coded) or dragged by a handle, with a min
- 133-155 held: bool 0/1; length clamped to the limits (and a size parameter to its min); a number ≥ 0 when its range starts at ≥ 0; others to min/max; the step; integers rounded
- 157-171 evaluateObject: the type (or the first); the evaluation; whole when nothing lost, no problems, nothing under the floor (Math.min over a spread of all pieces)
- 172-177 else compared with the type's own evaluation (a second full evaluation)
- 178-196 each plain length below the type's that breaks the object: a bisection to a micron (each step a full evaluation) for the least that keeps it whole, rounded up to the mm (toFixed(3) with one trailing zero cut), said in both languages
- 197-200 evaluated again with those values, the notes first
- 202-217 evaluateIn: values; a number evaluator that records problems; a part's material (its parameter's, a name, plaster by default) through materialIn
- 218-239 per part: repeat count (≤ 500, else a problem), per copy its condition, offsets and position
- 240-255 a mesh part stretched to its box (missing mesh or zero size → problem or lost)
- 256-279 a box: size; rounded edges; tilt and roll about the base's edges; turn in plan; the leaning centre
- 280-294 a cylinder: radii, height, leaning
- 295-308 a revolve: profile points from its lowest, radius ≥ 0
- 309-326 a profile: points in the world, counter-clockwise, not a sliver
- 327-341 a sphere/ellipsoid with leaning and turn
- 342-370 a nested object: its definition, depth limit, turn, values (materials passed by name), evaluated in its own frame; its pieces, lights, lost parts and problems added
- 371 handles at the top level
- 372-384 values outside their usual range said (not changed)
- 385-390 rules whose condition holds: their messages
- 391-401 its own light from formulas (lumens = 100 × watts, the colour from kelvin); the evaluation returned
- 403-411 kelvinColour: Tanner Helland's fit (constants as published), clamped 1000-12000 K (the fit holds to 40000 K)
- 413-425 placeHandle: its point by formulas; the axis (signed) turned with the object; a failing formula → a problem, no handle
- 427-428 two doc comments stacked: "A piece's outline in plan…" belongs to pieceOutline at 513 (misplaced, as F-0039), then boxCorners' own
- 429-446 boxCorners: the eight corners tilted about x, rolled about y through the base's centre, turned in plan
- 448-459 leant: a point of a piece's own axes in the world, leaning
- 461-468 cylinderRims: 16 points on each rim
- 470-482 ellipsoidPoints: three rings and the poles
- 484-498 hull: monotone chain (pops collinear points)
- 500-511 pieceSpan: by sampled points for an ellipsoid or a leaning box/cylinder (Math.min/max spreads of a few dozen), else z to z + h
- 513-540 pieceOutline: hulls for leaning shapes and ellipsoids; a profile's points; a 24-gon for round pieces; a mesh's outline stretched and turned; a box's four corners

## Contracts, state and data flow
- Pure and total: failing formulas become problems. Evaluated once per derivation, plus once more for the type and some 20-30 times per broken length when an object would come apart (bisection).
- Pieces are unbounded across nesting (F-0060).

## Depends on / used by
- uses: elements/material/schema.ts (materialIn), elements/object/formula.ts, schema.ts
- used by: elements/kinds/object.ts, app/object-handles.ts (held, evaluateObject), elements/object/commands.ts (held), the definition editor, tests

## Problems found (finding IDs)
- F-0060 nested repeated parts have no overall limit
- F-0039 (another misplaced doc comment at 427)

## To check in other files
- elements/object/formula.ts: evaluateFormula's errors; object/valid.ts limits on parts

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed : a string with exactly the digits asked, rounded on the binary value, padded with zeros (line 194)
- https://tannerhelland.com/2012/09/18/convert-temperature-rgb-algorithm-code.html : the fit's constants, the 66 and 19 thresholds, valid 1000-40000 K (lines 403-411)
