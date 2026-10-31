# src/elements/column/fields.ts
Lines: 49
Summary: The column's panel fields: section shape, width, depth, angle in degrees, plate (profiles only), the level its top reaches (its own top or a level above) and the top offset.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: the column's panel fields
- 3-7 imports: Field, ColumnPatch, Column/COLUMN_PLATE/COLUMN_SHAPES, Doc, name/t
- 9-11 ColumnFieldActions: updateColumns
- 13 DEG: degrees per radian
- 15-20 columnFields: ids; profile = all I, H or L; the levels above the FIRST selected column's level, by elevation
- 21-30 shape: select of the shapes
- 31-32 width and depth: min 5 cm
- 33-34 angle: degrees rounded to 0.01, stored in radians
- 35 plate: profiles only, min 2 mm
- 36-45 topLevel: shown when there is a level above; "" = its own top, else a level above the first column's level; set to null for ""
- 46-48 the top offset field and the list's end

## Contracts, state and data flow
- With columns of several levels selected, the top-level choices come from the first one's level: a column on a higher level can be given a top level below its own floor (F-0046). A column whose stored topLevelId is no longer among the choices shows a select with nothing chosen (the select's value matches no option).

## Depends on / used by
- uses: ui/fields.ts (type), elements/column/commands.ts (type), elements/column/schema.ts, app/document.ts (type), ui/i18n.ts
- used by: elements/kinds/column.ts (fields), next-element.ts (via the kind)

## Problems found (finding IDs)
- F-0046 the column's top-level choices come from the first selected column only

## To check in other files
- elements/kinds/column.ts: how a top level below the column's own floor derives

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/value : value is the first selected option's, "" when none (line 43: a stored id not in the options)
