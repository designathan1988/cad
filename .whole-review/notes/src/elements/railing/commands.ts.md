# src/elements/railing/commands.ts
Lines: 36
Summary: Commands on guardrails: add one, add several in one step (a stair's sides), and update height, base offset or infill on several.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: each returns a new document, one undo step
- 3-5 imports: Doc, Command, Railing and RailingInfill types
- 7-10 addRailing: appends one railing to the document
- 12-16 addRailings: appends several in one step; nothing to add returns the same doc
- 18 RailingPatch: height, baseOffset, infill
- 20-35 updateRailings: refuses a non-finite or non-positive height and a non-finite offset (Number.isFinite, no coercion); merges the patch; JSON comparison for "no change"

## Contracts, state and data flow
- Pure. A height of any positive size is accepted (no MIN_ELEMENT_SIZE floor, unlike openings).
- Hosted railings (on stairs) are moved by other code (F-0053).

## Depends on / used by
- uses: app/document (type), core/store (type), railing/schema (types)
- used by: the railing tool and stair tool (adding sides), railing fields/panel (updateRailings)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite : no coercion; false for NaN, ±Infinity and non-numbers (lines 23-24)
