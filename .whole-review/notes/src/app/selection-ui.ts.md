# src/app/selection-ui.ts
Lines: 199
Summary: Selection actions over the App: all walls of the level, stepping to the next element (N), nudging by the arrows, clearing, temporary hide/isolate/reset, copy and paste to another level (rooms renumbered on), delete, select similar (only what is shown), and walls of a type.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: selection actions; app.ts delegates
- 3-19 imports: collision, vector, deleteElements, id guards (guide, dimension, grid, note), i18n, registry, keyboard-select, nudge, levelOf, geometry (boundsOf, shownFor, Category), similarTo, transform (canTransform, copyToLevel), newId, App
- 21-28 selectAllWalls: select tool; hidden walls → hint; else every wall of the level ADDED to the selection (not replacing it)
- 30-52 stepSelectionHere: the registry's order of shown elements; the next/previous; in plan, panned to centre it when off screen
- 54-66 nudgeSelection: with collisions and no walls selected, clamped (nothing when blocked); nudge as one command
- 68-71 clearSelection: the Set cleared in place, refresh
- 73-93 hideTemporarily: guides, notes, dimensions and axes left out; none → reset or hint; hide adds to a previous hide, isolate replaces; hidden ones leave the selection; toast with the hide/isolate key as the user has it (app.keyName)
- 95-101 resetTemporary: all shown again, toast
- 103-112 copySelection: what can be transformed, kept with the doc, geometry and level; toast with the paste key as the user has it
- 114-133 paste: nothing copied or the same level → hint (with the copy-to-clipboard or the Copy tool's key as the user has it); copyToLevel; only axes → hint
- 134-143 the walls/openings/groups/rooms the copy added (slices past the copied doc's lengths); rooms renumbered from the highest number on the level now (parseInt, non-numbers as 0)
- 144-158 one command appending them and the registry's kinds (appendKinds) to the current doc; selected; toast with the level
- 160-167 deleteSelection: deleteElements as one command; a hint with the count and the undo key as the user has it
- 169 a stray doc comment ("Every wall of a type…") left above the select-similar comment: it belongs to selectWallsOfType at 192
- 170-190 selectSimilar: similar ids filtered to shown categories and not temporarily hidden; select tool; added to the selection; toast with the count
- 192-198 selectWallsOfType: the level's walls of the type added (none when walls are hidden)

## Contracts, state and data flow
- paste numbers rooms as max + 1 (correct), unlike the room tool (count + 1, F-0035): the same rule written twice, differently.
- The selection Set is mutated in place in several places (26, 69, 90, 187, 195).

## Depends on / used by
- uses: app/collision.ts, tools/nudge.ts, tools/transform.ts, app/select-similar.ts, app/keyboard-select.ts, elements/registry.ts, elements/opening/commands.ts (deleteElements), app/geometry.ts, app/document.ts
- used by: app/app.ts (delegates), app/actions.ts, app/input-keys.ts (arrows, N, Delete, Ctrl+C/V)

## Problems found (finding IDs)
- F-0039 a misplaced doc comment (line 169)
- F-0035 (contrast: paste renumbers correctly at 142)

## To check in other files
- app.ts setTool('select'): whether it clears the selection (selectAllWalls adds to it)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/parseInt : leading digits parsed, NaN when none ("A1", "") (line 142, || 0)
