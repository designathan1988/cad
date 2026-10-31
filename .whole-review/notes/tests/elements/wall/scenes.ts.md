# tests/elements/wall/scenes.ts
Lines: 438
Summary: Random scene generators (fast-check arbitraries) for the wall-join property tests, built with the oracle's own math and never the engine's. Generators:
- layer recipes: 1–4 random layers, or the common finish / core / finish;
- lScene: normal angles 15–165°, or degenerate ones near 0° or 180° with up to 0.9 mm jitter;
- tScene: normal 20–160°, or degenerate 8–20° / 160–172° with slack at the faces; a pure T, clear of the host's ends;
- roomScene: a jittered, rotated four-wall room with a divider; it must be convex, with angles of 40–140°, all mitred, and the divider clear of the inner corners;
- crossedScene: two walls whose ends sit inside each other;
- xScene: two walls crossing well inside both;
- nodeScene: a straight passage of two walls of one type head to tail, plus one or two stems that are not in line with each other.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: built with the oracle's math, never the engine's
- 3-8 imports: fast-check, wall schema types, fixtures, oracle helpers; Mode
- 10-22 vector helpers (pt, plus, times, dir, rot, dotp); num() (doubles without NaN or ∞); ref arbitrary
- 24-44 Recipe; anyRecipe (1–4 split parts, 4 random functions); plasteredRecipe; recipe = oneof; layersOf (thickness split in proportion)
- 46-61 make; meetParam (line parameter by Cramer, no zero guard); toSegment
- 63-111 LScene and lScene: node, heading, angle by mode, side, lengths, thicknesses, recipes, same type, refs, which end meets, jitter; filter: each far end farther than both thicknesses from the other wall
- 113-177 TScene and tScene: a host; the abutting wall from a station with margins and an across position (± slack in degenerate mode) at angle φ; filter: margins fit, the free end clears the host band, all four face crossings well inside the host's length
- 179-229 RoomScene and roomScene: four corners jittered ±0.8 and rotated; same or own types; reversed walls; a divider between points 30–70 % along walls 0 and 2; filtered by validRoom
- 231-259 validRoom: convex and counter-clockwise, angles 40–140°, all corners mitred, a positive inner area, the divider clear of the inner corners and crossing walls 0 and 2
- 261-316 CrossedScene and crossedScene: ends moved past or short of the node by up to a thickness/sin + 5 cm; filter: ends apart by more than 1.5 mm, each inside the other's band, at stations inside the other's length
- 318-381 XScene and xScene: crossing at 15–85 % along each, φ by mode, optional reversal and swapped ids; filter: every end clear of the other band; all face crossings well inside both walls
- 383-399 NodeScene type and the start of nodeScene's record (node, heading, two passage lengths, thickness, recipe, reference line)
- 400-437 nodeScene stems (1–2: angle 30–150°, length, thickness, recipe, reference line, direction): the passage p0 → node → p1; the first stem left, the second right; filter: stems not within 15° of in line with each other; each stem's far end clear of the passage band (line 438 blank)

## Contracts, state and data flow
- Pure generators; fast-check drives them with the property's seed. Filters discard scenes that belong to another case: an L that is really an L plus a T, a T touching the host's end, ends on the other band. Heavy filtering can lower the effective run count, which joins.property.test.ts guards by counting checked scenes.

## Depends on / used by
- uses: fast-check, src/elements/wall/schema (types), tests/elements/wall/fixtures, oracle
- used by: joins.property.test.ts

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://fast-check.dev/docs/core-blocks/arbitraries/combiners/any/ : oneof picks one arbitrary per value; map transforms; filter keeps values matching the predicate (lines 29-40, 70-111 and every generator)
