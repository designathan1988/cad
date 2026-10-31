# src/app/ribbon-tabs.ts
Lines: 501
Summary: The ribbon's content by tab (Home, Architecture, Structure, Annotate, View, Manage), the contextual Modify | <selection> tab built from the context menu's entries, the Place <element> tab with the next element's fields (walls and openings as template elements with their kinds' own fields, nextWall / nextOpening; others from next-element.ts) and the tool's ways, the ribbon's objects, and the File menu.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: the ribbon by tab (Home, Architecture, Structure, Annotate, View, Manage, Edit, File menu), only actions the app has, pressed states from the app
- 6-20 imports: words, ObjectDefinition, ribbon types, MessageKey, App, ModifyKind, ToolId, t, kindOfId, contextEntries, Field/ribbonFieldRows, WallDefaults, nextWall, nextOpening/OpeningSize, nextFields
- 22-28 ribbonTabs: every item gets its short name rib.s.<action id> unless it has its own text or short
- 30-31 RIBBON_OBJECTS: at most 8 objects on the ribbon
- 33-45 ribbonObjects: the one being placed, then those placed in the project, then the library's first, up to 8, in the library's order
- 47-62 tabsOf helpers: tool(id, action, icon, size) pressed when that tool is on; modify(kind) pressed in that Modify kind
- 63-79 shared items: select panel, levels, grid, the objects button with its menu (ribbon objects, more, import model)
- 80-116 Home tab: select, clipboard (paste, copy), draw (wall, door, window, objects, floor, roof, stair, room, column, railing), geometry (split, corner), annotation (dimension, note, measure), views (plan, 3D, section)
- 117-152 Architecture tab: select, build (wall, door, window, objects, column, floor, roof, ceiling, curtain, rectangle wall, arc wall), circulation, rooms, reference (levels, grid, three guide modes, clear guides)
- 153-157 Structure tab: select, beam and column, levels and grid
- 158-177 Annotate tab: dimensions (dimension, angle, radius, level mark, coordinate, auto), text (note, callout), opening tags toggle
- 178-224 View tab: graphics (overrides, toggle, save layer set, reference lines, reset temporary), create (3D, plan, section, elevations, sections dialog, save view), camera (four elevations, section box, off, frame all, frame selection), panels (properties, browser)
- 225-246 Manage tab: materials, objects, opening/floor/preset stores, wall types, units, levels, drawing scale, variables; projects, reference, model import, keys
- 247-252 the contextual tabs last: Modify | selection, then Place | element
- 254-279 PLACING: the tools with a Place tab and their icon
- 281-282 TYPE_FIELDS: field ids shown in the Type panel (type, model, definition, object type, buildup)
- 284-285 lowerFirst: first letter small unless the second is a capital (acronym)
- 287-296 placeName: "Place ceiling", "Place <object>", else rib.place.<tool>
- 298-313 placeTab: only for a placing tool
- 314-335 the next element's fields: walls → nextWall (a template wall of ui.defaults on the level shown, wallFields' fields; key with the level); doors/windows → app.placeSideFields + nextOpening (a template opening of ui.openingDefaults[kind], openingFields + styleFields); others → next-element.ts nextFields. One field list per element (F-0030 fixed)
- 336-340 type fields vs own fields; the type-edit button per tool (wall types, objects, opening store, floor store, presets); properties toggle
- 341-391 the tab's name and the tool's ways: wall line/rectangle/arc; floor/ceiling; guide modes; dimensions and marks; objects; circulation; rooms
- 392-402 the Place tab: select, Type or Properties panel with the type-edit and properties buttons
- 403-410 the type fields as ribbon rows in that panel; the own fields in a "Next" panel; then the tool's ways
- 413-414 ELEMENT_ACTIONS: which context-menu entry ids show on the Modify tab (their keys from the action list since F-0003)
- 416-433 contextTab: only with Select and a selection; the kinds of the selected ids (by prefix), one kind or none
- 434-445 the tab's name: door/window/openings for openings, the kind's one/many, else "n elements"
- 446-451 the context entries (context-menu.ts) and those of ELEMENT_ACTIONS as ribbon items `ctx.<id>` with short names rib.ctx.<id>; walls, rooms and movable flags
- 452-460 the Modify | <what> tab: select, properties
- 461-471 element panel (own actions, zone from rooms); modify panel (move, duplicate, rotate, mirror, scale, offset with walls) when the entries have move; wall geometry (split, corner, merge)
- 472-481 arrange panel for two or more: six aligns and two distributes
- 482-488 clipboard, temporary visibility, selection (similar, frame, delete)
- 490-500 FILE_MENU: new, projects, open, save, separator, language, theme, shortcuts

## Contracts, state and data flow
- The ribbon builds its items from action ids (actions.ts) but its OWN order and grouping; the side panel orders fields itself (root cause 1, ribbon vs panel ordering: to compare with ui/panel and frame.ts).

## Depends on / used by
- uses: ui/ribbon.ts (types), ui/fields.ts, elements/wall/fields.ts, elements/opening/fields.ts, app/next-element.ts, app/context-menu.ts, elements/registry.ts, ui/i18n.ts
- used by: app/chrome.ts (ribbonTabs), ui/ribbon.ts (render)

## Problems found (finding IDs)
- F-0030 fixed (lines 316-333 build the next wall and opening from their kinds' own fields)
- F-0003 (proof: 411-412, 444-446: the Modify tab takes its element actions from context-menu.ts's table by a third id list)

## To check in other files
- app/context-menu.ts contextEntries ids vs actions.ts (the `ctx.<id>` actions: how actions.ts resolves them)
- ui/panel: the order of the panel's fields vs the ribbon's Type/Next split

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every : every() on an empty array is true (line 434; the selection is never empty there, line 427)
