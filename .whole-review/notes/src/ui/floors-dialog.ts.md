# src/ui/floors-dialog.ts
Lines: 151
Summary: The floor build-ups store: a searchable grid of cards (a 3D sample of each build-up's layers stepped at a corner, its total thickness and layer count), pictures made lazily one per task, and a side panel with the chosen one's large picture, layers and main action: give it to the selected floors, or start the floor tool with it as the next floor.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: build-ups as cards with a 3D sample; apply or draw; laid out like the objects' store
- 6-18 imports: three, App, nextOf, materials, setFloorLayers, FLOOR_BUILDUPS, previewMesh, controls, dialog, i18n, icons, meshSnapshot, lengthText
- 20-22 SIDE 1 m and STEP 10 cm per layer below
- 24-39 floorSnapshot: a box per layer from the top down, each larger by a step, in its material; one snapshot (null without WebGL)
- 41-46 pictures: a session cache keyed by build-up and size only (F-0115)
- 48-54 showFloors state: keys, chosen, query, grid scroll, pending pictures, working flag
- 55-74 work: one picture per task for pending cards while the store is open, set into its img
- 75-83 render setup: names, accent-insensitive search (NFD, combining marks removed), chosen kept in the shown list, selected floors, total thickness
- 84-96 head: search (redraw on input, scroll reset), close button, count
- 98-120 grid: scroll kept across redraws; a card per build-up (aria-pressed chosen) with picture or pending placeholder, name, total and layer count; empty message
- 122-144 side: large picture, name, total, layer list (material and thickness), the main button (apply to one or n selected floors, or draw: next floor's layers and thickness, floor tool) and its note
- 145-147 pictures started; the dialog element (role dialog, aria-modal)
- 148-150 opened through openProjectDialog, focus on the chosen card

## Contracts, state and data flow
- Applying dispatches setFloorLayers for the selected floors; drawing sets app.next.floors (the next-element template) and the tool.

## Depends on / used by
- uses: three, app/next-element, elements/material/schema, elements/room (commands, schema), render/pattern-texture, ui/controls, ui/dialog, ui/i18n, ui/icons, ui/object-snapshot, ui/units
- used by: app (the floors store action: showFloors), floorSnapshot possibly by other pickers

## Problems found (finding IDs)
- F-0115 (S4): pictures cached without the materials

## To check in other files
- src/ui/object-snapshot.ts: whether meshSnapshot disposes the meshes it is given

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize : NFD splits é into e + U+0301, so removing U+0300–U+036F folds accents for the search (line 78)
