# src/app/next-element.ts
Lines: 161
Summary: The "next element" a placing tool makes (the template the goal names as the model for root cause 1): one per kind slot (columns, beams, stairs, railings, roofs, floors, ceilings, curtains, objects, rooms), as the user changed it, else the last of its kind, else the kind's defaults; the element a click makes from it; and its fields, taken from the kind's own panel fields minus a list of ids that only a placed element has. Walls, doors and windows keep their tool's settings (WallDefaults, OpeningSize) and are shown the same way, as a template element with their kind's own fields (wall/fields.ts nextWall, opening/fields.ts nextOpening: F-0030).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: Revit's type/instance properties before the click; same fields as one selected; last of its kind or defaults
- 6-17 imports: Field, registry (kindOfKey, withList), KindKey, LEVEL_HEIGHT and levelOf (document: the ceiling's level height falls back to LEVEL_HEIGHT at 88, F-0139), each kind's default sizes, App type
- 19-22 NextSlot and its kind key (ceilings share the floors list)
- 24-25 NEXT_ID '__next__', never an element's id
- 27-31 slotOf's comment: walls, doors and windows are shown as template elements of their own kind elsewhere (nextWall, nextOpening)
- 32-56 slotOf: the tool's slot; floor tool → ceilings or floors (none while adding a hole); object only with a known definition; walls/doors/windows/others null
- 58 Element: id, levelId and any fields
- 60-65 square(s): an s×s outline from the origin
- 67-100 blank: each slot's defaults on the level shown (column size, beam 4 m, straight stair, 3 m balustered railing, 6 m hipped roof, 4 m floor, ceiling at level height + thickness, 3 m curtain, room seed, the object's first type)
- 102-109 last: the last element of the slot's kind in the doc (floors vs ceilings by kind; objects of the definition being placed)
- 111-118 nextOf: the user's template (an object's only for the same definition) on the level shown; else the last made with NEXT_ID; else blank
- 120-128 made: the template without its own-place fields (holes, host, rise) + level + the click's place
- 130-133 NOT_NEXT: field ids hidden for a template (measures, holes, actions, name, number, roof sides): a blacklist by id, so any new placed-only field shows on the template until added here
- 135-145 nextFields: the slot's kind; the template derived as if alone of its kind in the doc; null when it does not derive
- 146-157 the kind's own fields over it, with a dispatch that runs the field's command on that doc and keeps the changed template in app.next (not in the store: no undo, not saved)
- 158-160 readouts, notes, actions and NOT_NEXT dropped; the key is the template's JSON (stable key order)

## Contracts, state and data flow
- The template uses the kind's own field list (one list per element); walls and openings now follow the same pattern from their tool's settings (F-0030 fixed).
- app.next lives outside the document: changes to the next element are not undoable nor saved with the project (as the walls' and openings' tool settings).

## Depends on / used by
- uses: elements/registry.ts, elements/contract.ts, app/document.ts, each kind's schema defaults, ui/fields.ts (Field)
- used by: app/kind-tools.ts (made, nextOf), app/frame.ts / ui/panel (nextFields), app/ribbon-tabs.ts (nextFields), app/floor tools, app/app.ts (next)

## Problems found (finding IDs)
- F-0030 fixed: walls and openings shown as template elements with their own kinds' fields (wall/fields.ts, opening/fields.ts)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify : keys in Object.keys order, stable; undefined omitted (line 159's key changes only when a value changes)
- https://en.wikipedia.org/wiki/Prototype_pattern : new objects copied from a prototypical instance (the next element as a template of its kind, F-0030)
