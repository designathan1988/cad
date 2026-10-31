# src/elements/curtain/schema.ts
Lines: 66
Summary: The curtain wall element (a line on a level, foot offset, optional height, vertical and horizontal grid rules, mullion size and depth, panel kind), its defaults, id check, grid-rule guard and where a rule's lines fall.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: Revit's Curtain Wall; grid by distance, number or largest spacing; mullions on every line and round the edge; panels; pure
- 6 imports: Point2
- 8 CURTAIN_PREFIX 'curtain'
- 10-15 GridRule: spacing (every value m, rest at the end), count (value equal parts), max (fewest equal parts under value m)
- 17-33 Curtain: id, level, start/end, base offset, height?, vertical/horizontal rules, mullion, depth, panel
- 35-43 CURTAIN_DEFAULTS: panels at most 1.50 m wide, horizontally 2 equal parts (the comment says "a transom at a door's height of 2.80": with 2 parts of a 2.8 m level the transom is at 1.40 m), 5 cm mullions, 15 cm deep, glass (as const satisfies the curtain's shape)
- 45 isCurtainId: prefix and underscore
- 47-51 isGridRule: a known mode and a finite value > 0 (no upper or lower bound)
- 53-65 gridLines: 0 and the total included; spacing: every value until 1 cm before the end; count: round(value) parts; max: ceil(total/value) parts

## Contracts, state and data flow
- The number of lines is unbounded: a count of 1e7 (typed: the panel-count field has min 1 and no max) or a spacing of 1e-6 (a file: isGridRule accepts any > 0) makes millions of lines, and geometry.ts builds a box per cell (rows × columns): the app freezes or runs out of memory (F-0049).

## Depends on / used by
- uses: core/vector.ts (type)
- used by: elements/curtain/geometry.ts (gridLines), commands.ts (isGridRule), fields.ts (type), kinds/curtain.ts (validator), app/next-element.ts (defaults)

## Problems found (finding IDs)
- F-0049 grid lines without a bound

## To check in other files
- elements/kinds/curtain.ts valid(): limits on mullion, depth, rules

## Sources
- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html : satisfies checks a type without widening the inferred one (line 43)
