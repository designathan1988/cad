# src/ui/presets-dialog.ts
Lines: 164
Summary: The structure and access store: ready-made columns, beams, stairs, railings, roofs and curtain walls (elements/presets.ts) as cards pictured with the kind's own derived 3D solid (the tool's next element with the preset's patch, shortened for sections), folders by kind with counts, search, and Place: the next element of that slot set to the preset and its tool started.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: presets as cards with the element's own 3D geometry; folders; placing via the tool's next element
- 6-18 imports: App, nextOf, KindSolid, SEE_THROUGH, Words, presets, registry helpers, previewMesh, controls, dialog, i18n, icons, meshSnapshot
- 20 words: a local copy of the bilingual picker (F-0126 Also)
- 21-26 SCENE: the 3D view's own material looks for side, floor, roof
- 28-29 templateOf: the slot's current next element with the preset's patch
- 31-50 snapshot: the kind; columns shortened and beams cut short so the section reads; the doc with only that element; derive and solid; meshes in scene or project materials raised by part.y; viewing pitch by kind
- 52-57 pictures: Map by preset id and size (not by the template or materials: F-0115 Also)
- 59-62 FOLDERS and presetSlotOf (the slot a tool's presets live in)
- 64-89 showPresets state and the lazy picture queue (F-0126)
- 90-96 render: local fold, found and shown, chosen kept
- 98-110 head: search, close, count
- 112-122 folders with counts
- 124-128 place: closes, sets app.next[slot], starts the tool
- 129-146 cards (no scroll kept: F-0126 Also), click chooses, double click places (F-0127 applies), empty message
- 148-157 side: picture, name, folder, Place and its note
- 158-160 pictures started; the dialog element; render ends
- 161-163 opened; focus on the chosen card

## Contracts, state and data flow
- No document commands; placing sets the next-element template (app.next) and the tool.

## Depends on / used by
- uses: app/next-element, elements (contract, material schema, object schema, presets, registry), render/pattern-texture, ui/controls, ui/dialog, ui/i18n, ui/icons, ui/object-snapshot
- used by: app (structure store action; presetSlotOf by the ribbon's tool tabs)

## Problems found (finding IDs)
- F-0115 (Also): pictures cached without the template and materials
- F-0126 (Also): a copy of the store skeleton without scroll keeping; local words
- F-0127 applies (double click to place after a redraw)

## To check in other files
- none

## Sources
- https://threejs.org/docs/pages/BufferGeometry.html : geometry clone gives a separate instance to dispose with the snapshot's meshes (line 44: part.geometry.clone())
