# src/ui/layer-editor.ts
Lines: 139
Summary: The layer stack editor (wall types now, generic over the layer): a stretched band preview with Exterior/Interior ends, one labelled row per layer with function, thickness (mm precision), material, a core mark, and move toward exterior/interior and remove buttons; an Add layer button and the total thickness. It reports the next list; the stack operations live in elements/layers/stack.ts.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: a stack from exterior to interior; generic; reads layers and reports the next list
- 6-14 imports: lengthText, stack operations, coreLayersOf, LAYER_PRIORITY, controls, materials, i18n, icons, layerBands
- 16-20 EditableLayer: thickness, function, materialId
- 22 FUNCTIONS: the layer functions in LAYER_PRIORITY's key order
- 24-27 layerEditor: the box, the core's first and last layer, the total
- 29-37 preview: the bands as SVG rects stretched across (preserveAspectRatio none), exterior and interior captions
- 39-53 grid and its column heads (hidden from readers)
- 54-55 cell: a grid area with an optional caption (for phones)
- 56-67 button: an icon button with label, title (with the reason when disabled), focus key, enabled flag; on click the focus key moves to where the layer goes
- 68-82 per layer: function select and thickness field (≥ 1 mm, 3 decimals), each labelled with its layer and given a focus key
- 83-91 material select (a missing material added as an option so it shows), labelled and keyed
- 92-95 core mark ● with screen-reader words
- 96-110 move up (toward exterior), move down, remove (not the last layer, with the reason)
- 111-123 the row (role group, named "Layer n") of cells
- 125-129 Add layer (after the last)
- 131-138 the editor: title, preview, grid, add and the total (role status)

## Contracts, state and data flow
- Pure view: every change calls onChange with a new list; the dialog (types-dialog) dispatches and redraws, keeping focus by data-focus keys.
- No check of the functions' order against the priority rule (F-0091 stands).

## Depends on / used by
- uses: ui/units, elements/layers/stack, wall/geometry/shape (coreLayersOf), wall/schema (LAYER_PRIORITY), ui/controls, elements/material/schema, ui/i18n, ui/icons, ui/swatch (layerBands)
- used by: ui/types-dialog.ts

## Problems found (finding IDs)
- none new

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/preserveAspectRatio : "none" scales each axis independently so the viewBox fills the viewport (line 36: bands only, so stretching distorts nothing)
