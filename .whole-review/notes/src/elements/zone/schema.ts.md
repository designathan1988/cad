# src/elements/zone/schema.ts
Lines: 26
Summary: Zones: rooms of a level taken together under a name, a category (social, private, service, circulation, other) and a colour; the plan tints their rooms. Each category's default colour.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: phase 6 zones as Revit's areas and ArchiCAD's zone categories; held by room id; "a room deleted leaves it" (not implemented: F-0056 Also)
- 5-7 ZONE_PREFIX, ZONE_CATEGORIES (`as const`) and ZoneCategory
- 9-16 ZONE_COLOURS: a six-digit hex colour per category
- 18-25 Zone: id, level, name, category, colour, room ids

## Contracts, state and data flow
- Types and constants only. Colours are CSS hex strings (#RRGGBB).

## Depends on / used by
- uses: nothing
- used by: zone/commands, elements/kinds/zone.ts, the plan renderer (tints), io/project-file

## Problems found (finding IDs)
- F-0056 (Also): the header's promise is not kept

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/CSS/hex-color : hex colour forms, #RRGGBB used here (lines 10-16)
