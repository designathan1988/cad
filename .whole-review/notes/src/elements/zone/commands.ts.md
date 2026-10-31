# src/elements/zone/commands.ts
Lines: 34
Summary: Commands on zones (rooms taken together): add a zone (its rooms leave any other zone, zones left empty go), and update name, category or colour on several.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: each returns a new document, one undo step
- 3-5 imports: Doc, Command and Zone types
- 7-15 addZone: none without rooms; its rooms removed from other zones (filter, new arrays), zones emptied by that dropped; the new zone appended
- 17 ZonePatch: name, category, colour
- 19-33 updateZones: refuses a blank name (stores it untrimmed); merge; JSON comparison; one step

## Contracts, state and data flow
- Pure. Nothing here removes rooms deleted elsewhere from zones (F-0056 Also).

## Depends on / used by
- uses: app/document (type), core/store (type), zone/schema (type)
- used by: the zone tool/actions and the zone panel (elements/kinds/zone.ts)

## Problems found (finding IDs)
- F-0056 (Also): no cleanup of deleted rooms; untrimmed names

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter : filter returns a new shallow copy and leaves the original unchanged (line 12)
