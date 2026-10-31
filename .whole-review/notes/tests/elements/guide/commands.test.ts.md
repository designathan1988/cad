# tests/elements/guide/commands.test.ts
Lines: 39
Summary: Tests of guides as elements: their ids are listed by elementIds and recognised by their prefix; addGuide appends one in one undo step labelled cmd.addGuide; deleting the selection takes the selected guide; clearGuides takes every guide of one level and no other, and returns the same document when there is nothing to clear (no empty undo step); the nudge arrows move a selected guide by the step and leave the others' objects identical.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: guides as elements, added, deleted, cleared, nudged
- 3-9 imports: vitest, elementIds/newDocument/Doc, deriveGeometry, deleteElements, addGuide/clearGuides, isGuideId, nudge
- 11-12 a guide helper and a doc with an upper level and three guides (two on the ground, one up)
- 14-18 ids filtered by isGuideId (passed straight to filter) in order; a wall id is not a guide
- 20-24 addGuide appends guide_d; its label is cmd.addGuide
- 26-31 deleteElements removes guide_a; clearGuides('lvl_ground') keeps only guide_c; an unknown level returns the same doc
- 33-38 nudge moves guide_b to y 1.05 (1 + 0.05 rounds to the same double as 1.05); guide_a kept by identity; suite closes (line 39 blank)

## Contracts, state and data flow
- Commands are pure `apply(doc)`; returning the same doc means "no change", which the store uses to skip the undo step.
- Unchanged elements keep their object identity after a nudge (structural sharing).

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/opening/commands (deleteElements), src/elements/guide (commands, schema), src/tools/nudge
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter : filter keeps source order and calls the callback with (element, index, array) (line 16 passes isGuideId directly)
