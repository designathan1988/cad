# src/elements/opening/schema.ts
Lines: 137
Summary: Door and window data. An opening is hosted by a wall, placed by a PositionRule (from start or end, centred, from another opening, aligned across, in a group) and never has a stored station. The file also defines groups with equal or fixed spacing over a stretch, the style (operation, leaves, frame, casing, transom, threshold, screen, splits, design, open amount, handle, materials, glazing, muntins), the defaults, newOpening and the id prefixes.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: hosted by a wall, placed by a rule, the position always derived, never stored (the RC2 design: F-0068)
- 4 import: the WallId type of the host wall
- 6-7 OpeningId and OpeningKind (door or window)
- 9-22 PositionRule doc and union: fromStart, fromEnd, centered, fromOpening (openingId, gap, toward), aligned (openingId, edge), inGroup (groupId)
- 24-28 AlignEdge; DistanceRule (the kinds with a distance); hasDistance by `'distance' in r`; OpeningGroupId
- 30-36 GroupSpacing: equal, or fixed (gap, anchor start/centred/end, distance)
- 38-49 OpeningGroup: id, wall, members in wall order, spacing, optional `between` (bounding walls, null for the host's end)
- 51 RuleKind: the kind names of PositionRule
- 53-68 Opening: id, wall, kind, width, height, sill above the wall's base, rule, hinge (start/end), swing (left/right of the drawing direction), optional style
- 70-74 DOOR_OPERATIONS and WINDOW_OPERATIONS (after IFC's enums), Operation
- 76-107 OpeningStyle: operation, leaves, frame, casing, transom, threshold, screen, mullions, transoms, design, open (0-1, kept in the style: F-0071), handle, leaf/frame material, glazing, muntins
- 109-115 LEAF_DESIGNS, DOOR_HANDLES, WINDOW_SCREENS lists
- 117-120 OPENING_DEFAULTS: door 0.90 × 2.10, window 1.20 × 1.20 at 1.00
- 122-131 newOpening: defaults, hinge start, swing left, size overrides, style only when given, the rule
- 133-136 OPENING_PREFIX, isOpeningId, GROUP_PREFIX

## Contracts, state and data flow
- The stored position is the rule. derive.ts computes stations from rules each time (F-0068). Changing to explicit stations means changing this type plus a file migration.
- hasDistance narrows by the `in` operator to the members declaring `distance` (fromStart, fromEnd, fromOpening).
- `open` lives in the style, so it counts in the make (marks.ts: F-0071).

## Depends on / used by
- uses: elements/wall/schema (WallId)
- used by: every opening module (derive, commands, fields, panel, marks, parts, style, symbol, void, valid), app/geometry, app/keep-openings, app/select-drag, tools/opening-tool, io/project-file, render

## Problems found (finding IDs)
- F-0068 (Also): the rule kinds that make positions depend on other openings are defined here

## To check in other files
- src/app/keep-openings.ts and io/project-file.ts for the rule rewriting and migrations (F-0008, F-0068)

## Sources
- https://www.typescriptlang.org/docs/handbook/2/narrowing.html : `in` narrows a union to members declaring the property; a `r is T` predicate narrows the caller (line 27)
