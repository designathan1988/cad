# src/core/collisions.ts
Lines: 10
Summary: A module-level flag mirroring the app's "collisions on" setting, so field definitions (an object's elevation minimum) can read it without the App.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: read by the panels that set heights; the app sets it from its preferences
- 4 on: the flag (true by default), one instance shared by every importer (a module runs once)
- 6-9 collisionsOn (read) and setCollisions (write)

## Contracts, state and data flow
- A second copy of app.ui.collisions: kept in step by hand at app.ts:291 (start) and app.ts:1261-1263 (toggle). Any other change of ui.collisions would leave this behind (none today: grep shows those two writes only).

## Depends on / used by
- uses: nothing
- used by: app/app.ts (setCollisions), elements/object/fields.ts:133 (collisionsOn as the elevation's minimum)

## Problems found (finding IDs)
- none (two copies of one setting, kept in step at its only two writes)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules : a module is executed once; its top-level state is shared by all importers (line 4)
