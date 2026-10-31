# src/ui/panel.ts
Lines: 216
Summary: The properties panel, rebuilt from the selection on every render: walls (general, constraints, more, arrange for 2+, join warnings naming the overlapping walls, the stacked-step warning with "align with the wall below"), else doors/windows (opening/panel.ts), else a registry kind (its fields, hint and warning), else the next door/window while its tool is on, the next wall while drawing (a template wall with wallFields' fields), a placing tool's next element, or the empty state. A mixed selection shows one kind and says how many of the total. Focus restored after a rebuild by a control signature.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: sections from each element's fields; reads state, sends changes
- 4-21 imports: wall schema, document, geometry, opening panel and types, room types, wall fields (nextWall, wallFields), join warnings, stacked steps, controls, fields, i18n, icons, kind contract, Command
- 23-47 PanelInput: doc, selected walls, drawing, wall defaults, the level shown (the next wall's), warnings, openings, level rooms, placed openings, opening warnings, the opening tool's next size and sides, a tool's next element, total selected, the first registry kind and its items, stacked steps
- 49-79 PanelActions: twenty-odd callbacks (walls, reference line, type, keep clear, reset to type, edit type, radius, end joins, arrange, defaults, close, section, interior elevations, calibrate, geometry, opening, room, opening defaults, dispatch, align below)
- 81-87 common: a value shared by every selected wall (JSON compare) or null
- 89-105 renderPanel: the head (icon, title, close), the "editing n of m" hint
- 107-120 walls: title (number and type, or count), general/constraints/more and arrange sections from wallFields
- 121-134 join warnings of the selected walls, one line per kind, overlaps naming the other walls by number
- 135-145 the stacked-step warning with its button
- 146-150 openings: head and openingPanel
- 151-166 a registry kind: title, its fields with the context callbacks, hint, warning
- 167-172 the door/window tool: next opening from nextOpeningPanel (the template opening, opening/fields.ts nextOpening) plus its sides
- 173-177 drawing walls: the next wall from nextWall (a template wall on the level shown, wallFields' fields: F-0030)
- 178-181 another placing tool: its next element's fields
- 182-188 nothing selected: the empty state
- 189-198 rebuild keeping focus: the focused control's signature and rank, restored after replaceChildren
- 200 focusables: inputs, selects, textareas, buttons
- 202-209 signature: tag, type, aria-label and its first label's text
- 211-215 focusMark: signature and rank among equals

## Contracts, state and data flow
- Pure view of PanelInput; every change goes through PanelActions. The three "next element" branches (opening tool, wall drawing, next-element template) now all show a template element with its kind's own fields (F-0030 fixed); the walls' and openings' templates are built from the tool's settings.

## Depends on / used by
- uses: app/document, app/geometry, elements/opening (derive types, panel, schema), elements/room types, elements/wall (fields, schema, join types), app/stacked, ui/controls, ui/fields, ui/i18n, ui/icons, elements/contract, core/store
- used by: app/frame.ts building the side panel each render

## Problems found (finding IDs)
- F-0030 fixed (the next wall and next opening from their kinds' own fields)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/labels : a NodeList of the input's labels (null for type=hidden) (lines 206-209)
- https://en.wikipedia.org/wiki/Prototype_pattern : the next element as a copy of a prototypical instance (173-177, F-0030)
