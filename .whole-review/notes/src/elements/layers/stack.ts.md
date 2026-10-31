# src/elements/layers/stack.ts
Lines: 47
Summary: Pure operations on a stack of layers (wall types, floor build-ups) and the one rule of a usable stack: a layer's buildable thickness (layerThicknessOk), what makes a stack unusable, adding a copy of a layer, removing one (never the last), moving one, changing one.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: layers listed face to face, for wall types and floors' build-ups; pure, new list or the same when nothing changes; the one rule of a usable stack
- 5-9 StackLayer (a thickness) and StackProblem
- 11-12 layerThicknessOk(t): a number, finite and above zero (Infinity, NaN, strings not) (F-0136)
- 14-18 stackProblem: no layer, or a layer failing layerThicknessOk
- 20-25 addLayer: a copy of layer `at` (or the last) inserted after it; always a new list (also when the stack is empty)
- 27-31 removeLayer: never the last; out of range → the same list
- 33-40 moveLayer: splice out of `from` and into `to` on a copy; out of range → the same list
- 42-46 setLayer: the layer merged with the patch

## Contracts, state and data flow
- Pure; splice runs on a copy. The rule of a usable stack lives only here: wall shapes (shape.ts), floors' build-up command (room/commands.ts), the floor's and wall type's checks on reading (kinds/floor.ts, io/project-file.ts) call it (F-0136).

## Depends on / used by
- uses: nothing
- used by: wall type editor (ui), elements/wall/geometry/shape.ts, elements/room/commands.ts, elements/kinds/floor.ts, io/project-file.ts, tests/elements/layers/stack.test.ts

## Problems found (finding IDs)
- F-0136 fixed: the rule written here once, the other four places call it

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice : returns the removed items, inserts before the index, mutates (lines 36-39 on a copy)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite : false for Infinity, -Infinity and NaN; no coercion, non-numbers false (line 12)
