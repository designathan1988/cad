# src/elements/level/commands.ts
Lines: 69
Summary: Level commands: add one on top of the highest (its height and cut height), update name/elevation/height/cut height, why a level cannot be deleted, levels overlapping the next one up, and delete (walls that reached it get a fixed height).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: wall heights come from their level, so a level change moves its walls without touching them
- 4-5 imports: Doc/Level/LevelId/wallHeights, Command
- 7-15 addLevel: on the top of the highest level (sorted by its top), the same height and cut height
- 17-35 updateLevel: a blank name, a height or cut height ≤ 0 or non-finite elevation refused; trimmed name; unchanged (JSON) → no step. Only the levels list changes: roofs are not replaced, so roof covers cached per roof (document.ts, F-0013) keep the old level's height (F-0013's proof completed)
- 37-44 deleteBlocker: missing, the last level, or walls on it; canDeleteLevel
- 46-54 levelOverlaps: a level whose floor-to-floor height passes the next level's floor, and by how much
- 56-68 deleteLevel: refused only for those three reasons; walls topped "to this level" turned to a fixed height. Every OTHER element on the level (floors, ceilings, rooms, zones, columns, beams, roofs, stairs, railings, curtains, separators, objects, notes, dimensions, guides, measures, references, interior elevations) keeps the deleted level's id: none of them is shown on any level again, yet they stay in the file; columns topped at it fall back silently (F-0057)

## Contracts, state and data flow
- Elements carry levelId; the level list is the only place a level lives.

## Depends on / used by
- uses: app/document.ts, core/store.ts
- used by: ui levels dialog, app actions (add/delete level), app/frame.ts warnings (levelOverlaps): to confirm

## Problems found (finding IDs)
- F-0057 deleting a level leaves its other elements orphaned and invisible
- F-0013 (proof: 18-34 change only the levels)

## To check in other files
- the levels dialog: what it says before deleting

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find : the first match or undefined (deleteBlocker/levels lookups; line 11 sorts a copy)
