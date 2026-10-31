# src/elements/opening/panel.ts
Lines: 78
Summary: Builds the side panel's sections for the selected doors and windows (general, position, group, arrange, make, leaf, warnings), the selection's title, and the next-opening panel. The fields come from fields.ts.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: reads state, sends changes, one command per change
- 5-28 imports: materialLabel, units, Doc and OpeningSolid types, el, fieldsSection, i18n, icon, warning type, RoomSolid type, the field builders, opening types, openingMarks
- 30 re-exports the action and size types
- 32-40 openingPanel signature: doc, placed, selected, warnings, actions, the level's rooms
- 41-46 general section with marks of every opening (recomputed per build); position when one is selected (F-0067 cost)
- 47-51 group section when the selection is in exactly one group; arrange section for two or more
- 52-55 make section when every one has a style and one kind; leaf section for one door or casement window
- 56-64 warnings for the selected openings, deduplicated by kind, an icon set by innerHTML (a static SVG string)
- 66-71 openingTitle: kind and size of one, or the count
- 73-77 nextOpeningPanel: a hint and the next opening's general section, from nextOpening (the template opening with the placed one's fields; the side fields are in ui/panel.ts's leaf section: F-0030 fixed)

## Contracts, state and data flow
- Pure DOM builder; changes go through `act` (app/frame.ts).
- The ribbon and this panel both take the next opening's fields from nextOpening (fields.ts); the ribbon puts the place-side fields first, the panel in its leaf section (F-0030 fixed).
- innerHTML only takes icon()'s own SVG text, no user data.

## Depends on / used by
- uses: ui/i18n, ui/units, ui/controls, ui/fields, ui/icons, app/document and app/geometry (types), opening/fields, marks, derive (type), schema (types), room/derive (type)
- used by: the opening kind's panel (elements/kinds/opening.ts) and the app's panel for the next opening

## Problems found (finding IDs)
- none new (F-0030 fixed: one field list for the next opening; F-0067 through positionFields)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML : innerHTML parses HTML and replaces the children; an injection sink for untrusted strings (line 59 gives it only a static icon)
