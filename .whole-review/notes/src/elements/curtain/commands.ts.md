# src/elements/curtain/commands.ts
Lines: 39
Summary: Curtain wall commands: add one; update base offset, height, vertical/horizontal grid rules, mullion size, depth and panel kind of several (refusing non-positive or non-finite values and invalid grid rules; no step when nothing changes).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: commands on curtain walls, each one undo step
- 3-5 imports: Doc, Command, Curtain/GridRule/isGridRule
- 7-10 addCurtain: appended
- 12-20 CurtainPatch: base offset, height, vertical and horizontal grid rules, mullion, depth, panel glass/opaque
- 22-27 updateCurtains: height/mullion/depth must be finite and > 0; base offset finite; grid rules valid; else unchanged
- 28-38 each listed curtain merged; unchanged by JSON kept; a new document only when one changed

## Contracts, state and data flow
- The same validate-merge-compare pattern as beams and columns (each kind writes its own copy of it).

## Depends on / used by
- uses: app/document.ts, core/store.ts (types), elements/curtain/schema.ts (isGridRule)
- used by: app/kind-tools.ts (addCurtain), elements/curtain/fields.ts or kinds/curtain.ts (updateCurtains)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some : stops at the first truthy result; false for an empty list (lines 25, 27)
