# src/elements/section/schema.ts
Lines: 103
Summary: Section and elevation marks: a plan line looking to its left as far as its depth, on every level or (a room's interior elevation) on one. The file also has the depth limits, the look direction, the file guard, the next section letter, and the line sets for the four elevations around a box and the four interior elevations of a room.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 header: phase 10 sections and elevations, drawn from the model each time; "put on a sheet" (sheets left the app: F-0036)
- 8 imports: Point2 and distance from core/vector
- 10-12 SECTION_PREFIX and SectionKind (section or elevation)
- 14-25 SectionMark: id, name, kind, start, end, depth, optional level (interior elevations)
- 27-29 DEPTH_MIN 0.1 m, DEPTH_MAX 500 m
- 31-35 lookOf: the unit vector to the left of start → end
- 37-38 local finite and isPoint helpers
- 40-56 isSectionMark: id, non-blank name, kind, points, non-zero length, depth in range, level optional
- 58-65 nextSectionName: A… Z then two letters; past ZZ the first letter overflows to "[" (F-0055 Also)
- 67-83 elevationsAround: north, south, east, west lines `margin` outside the box, each with the building on its left and as deep as the box plus margins
- 85-102 elevationsInside: four lines `inset` off each wall, extended `beyond` into the side walls, as deep as the room plus `beyond` into the wall looked at

## Contracts, state and data flow
- Pure. Elevation names are stored translated by the tool (kind-tools.ts:326), so they depend on the interface language (F-0055 Also).

## Depends on / used by
- uses: core/vector
- used by: section/commands, elements/kinds/section.ts, app/section-drawing.ts, app/section-view.ts, app/kind-tools.ts (elevations), ui/sections-dialog, io/project-file (guard)

## Problems found (finding IDs)
- F-0055 (Also): names past ZZ; language-dependent elevation names
- F-0036 (Also): sheet comment

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/fromCharCode : code 65 is "A", 91 is "[" (line 62)
