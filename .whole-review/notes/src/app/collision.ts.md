# src/app/collision.ts
Lines: 167
Summary: Pure collision helpers for moving and placing loose elements: convex hulls, a separating-axis overlap test, shapes of moving kinds and of obstacles (wall blocks and solid kinds) on a level, a move clamped in 2 cm steps with sliding, and the nearest free place for a placement.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: on by default (K); moved/placed things stopped by walls (blocks: doorways clear), objects, columns, stairs, railings, curtains where heights overlap; sliding; nothing below the floor (that part is not in this file: to check)
- 6-9 imports: Point2, eachSolid (registry), App type, DerivedGeometry type
- 11-16 interface Shape: convex plan outline + bottom/top heights
- 18-25 SOLID_KINDS (obstacles), MOVED_KINDS (moved with collisions: objects, columns, stairs; not railings or curtains), FLAT 3 cm (flatter is laid on the floor: no shape), TOUCH 2 mm
- 27-43 hull: Andrew's monotone chain on a sorted copy, pop on cross ≤ 0 (collinear points dropped), lower + upper without their last points; counter-clockwise; fewer than 3 points returned as they are
- 45-72 overlaps(a, b): separating axes = every edge normal of both convex outlines (degenerate edges skipped); disjoint (or touching within TOUCH) projections on any axis → no overlap; fewer than 3 points → no overlap
- 74 hits: heights overlap by more than TOUCH and outlines overlap
- 76-80 shapesOf: none for a span thinner than FLAT; each outline of ≥3 points as its hull with the span's heights (a concave outline becomes its hull: larger than the object)
- 82-90 movingShapes: shapes of the given ids among MOVED_KINDS with a span
- 92-104 obstacleShapes: wall blocks of the level (hulls of each block with its heights) of walls not being moved, plus SOLID_KINDS solids of the level not being moved
- 106 moved: a shape translated by d
- 108-138 clampMove(shapes, obstacles, delta): obstacles already hit at the start ignored; delta clear at the end and at every 2 cm along the way → delta; else walk 2 cm steps, each step the full step, else x alone, else y alone (sliding), stop at the first blocked step
- 140-158 freePlace: clear at once → 0; else rings every 5 cm up to 3 m in 16 directions, the first clear offset; none → 0 (placed overlapping)
- 160-166 collisionFor(app, ids): the moving shapes and the obstacles on the level of the first moving registry solid (else the level shown)

## Contracts, state and data flow
- Pure but for collisionFor reading app.geometry. clampMove's cost: steps = |delta|/2 cm, each testing every shape against every obstacle with SAT; called during drags with the cumulative delta (to check in select-drag.ts), so a long drag across a big plan tests hundreds of steps × obstacles per pointer move.
- The "nothing is set below the floor" of the header is not done here.

## Depends on / used by
- uses: elements/registry.ts (eachSolid), app/geometry.ts types
- used by: app/select-drag.ts (collisionFor/clampMove: to check), app/kind-tools.ts (objectClick: shapesOf, obstacleShapes, freePlace), app/object-handles.ts? (to check), tests

## Problems found (finding IDs)
- none confirmed in this file (cost to judge in select-drag.ts)

## To check in other files
- app/select-drag.ts: how often clampMove runs and with what delta
- where "nothing below the floor" is enforced (kind-tools.ts objectClick clamps elevation ≥ 0)

## Sources
- https://en.wikibooks.org/wiki/Algorithm_Implementation/Geometry/Convex_hull/Monotone_chain : sort by x then y, pop while cross ≤ 0, drop each chain's last point, counter-clockwise result (lines 27-43)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort : sorts in place (line 29 sorts a copy), stable, a.x - b.x || a.y - b.y orders by x then y
- https://en.wikipedia.org/wiki/Hyperplane_separation_theorem : disjoint projections on an axis orthogonal to a separating line mean disjoint convex bodies; the faces' (edges') normals are the candidate axes (lines 45-72)
