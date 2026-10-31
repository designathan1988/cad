# src/elements/guide/fields.ts
Lines: 13
Summary: The panel for selected guides: a note saying what a guide is, and an action clearing the level's guides.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: the panel for selected guides as fields
- 3-5 imports: Field, t, Guide
- 7-12 guideFields: the hint note and the clear action (labelled with the context menu's key ctx.clearGuides: a label shared with context-menu.ts's own table, root cause 1)

## Contracts, state and data flow
- The panel action and the context-menu entry are two definitions of one option (only the label key is shared).

## Depends on / used by
- uses: ui/fields.ts (type), ui/i18n.ts, elements/guide/schema.ts (type)
- used by: elements/kinds/guide.ts (fields)

## Problems found (finding IDs)
- F-0003 (one more option defined outside actions.ts)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions : an expression body returns the expression (line 9's text: () => t(...))
