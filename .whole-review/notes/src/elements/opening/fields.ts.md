# src/elements/opening/fields.ts
Lines: 546
Summary: The panel fields for doors and windows: general (mark, kind, model, size), position (rule, reference, alignment, distance from the wall face, jambs, centre between), the door leaf (swing by room, hinge left/right as seen), group spacing, arranging several, the make (operation, panes, splits, frame, casing, transom, screen, threshold, open amount, design, handle, glazing, muntins, materials). The next opening the tool places is a template opening shown with the same fields (nextOpening, F-0030).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: panel sections for doors and windows, and the next opening from the same fields
- 5-17 imports: units, wallNumber, wall stops, referenceLength, room/opening solid types, Field, i18n, candidates from commands, style catalog, parseLength, schema types and lists
- 19 OpeningSize: width, height, sill, style (the next opening's values, kept by the tool)
- 21-32 OpeningPanelActions: update (patch or per-opening), setRule, align, alignHeads, distribute, setSpacing, ungroup
- 34 kindName: the translated word for door or window
- 36-74 openingFields: mark readout (marks.ts), kind segmented (resets height, sill and style to the kind's defaults), model, width, height, sill (hidden when all are doors)
- 76-118 positionFields setup: reference and align candidates (F-0067 cost), labels with wall number and level, wall stops and base of each rule (distances from the face of the nearest meeting wall), side names by screen direction (north-up plan), rule labels, rule options (inGroup only when current)
- 119-198 positionFields list: rule select (aligned takes the first candidate, fromOpening the nearest), reference opening, align-with, align-by (edges that fit), distance (minus the face base), jambs readout from the rule's end, "centre between" action (sets fromStart at the middle of the stretch, dropping a fromOpening/aligned link without saying)
- 200-241 leafFields: swing side named by the rooms each side, hinge, a note on where the hinge is seen from
- 243-260 hingeOptions: left/right as seen from the swing side, start/end without a frame; left first (consistent comparator)
- 262-308 groupFields: members readout, spacing equal/fixed (fixed starts from the mean gap now), gap, anchor (F-0069), anchor distance, ungroup
- 310-326 arrangeFields: hint, distribute (same wall), align position (alignCandidates per other opening, F-0067), align heads
- 328-329 notNextOpening: mark, kind, notes, readouts and actions are not a next opening's
- 331-353 nextOpening(kind, size, set): a template Opening '__next__' of the tool's size and make inside a partial OpeningSolid (`as unknown as`); an update adapter turning the fields' patches (or patch functions) into OpeningSize patches, a catalog model chosen without a width bringing its usual width, height and sill; openingFields + styleFields (when it has a make) over it, minus notNextOpening; returns the fields and the item (F-0030)
- 355-360 modelName: plain, catalog name, or the operation's name
- 362-384 modelField: select of plain, the kind's models, and "custom" when one is hand-made (choosing custom does nothing); reads x.opening
- 386-398 withoutScreen and withoutMullions: a style without that key (rest destructuring)
- 400-405 styleFields setup: ids, kind of the first, change through fitStyle, style(x) with `!` (callers guarantee a style: panel.ts:53, nextOpening only with size.style), leafMax
- 406-442 operation select, leaves/panes (letting hand-placed mullions go), mullions and transoms as "a; b" lengths (parseLength, negatives refused), a note, frame and casing (clamped to 0.3 m), transom
- 443-464 window screen (none, shutter, grille) and door threshold
- 465-466 open amount in % (comment still says "and exports": F-0047)
- 467-510 door leaf design, door handle (default by operation), glazing clear/frosted, window muntins 2-6
- 511-529 leaf and frame materials when a materials list is given (not passed for the next opening)
- 531-545 nearest: the reference opening nearest jamb to jamb

## Contracts, state and data flow
- Fields are data for ui/fields.ts: get/set/when per row; sets go through OpeningPanelActions (app/frame.ts dispatches commands).
- Distances shown are measured from the face of the nearest meeting wall (wall-stops), and the stored rule distance is that plus the base (165-166).
- One list per element (RC1): placed and next openings use openingFields + styleFields; the next one's changes go to the tool's OpeningSize (F-0030 fixed). The ribbon adds placeSideFields before them; the panel shows them in the leaf section.

## Depends on / used by
- uses: ui/units, ui/fields (type), ui/i18n, core/measure (parseLength), app/document, app/wall-stops, app/geometry (type), opening/derive, sides, style, schema, commands; room/derive (type)
- used by: elements/opening/panel.ts (every section, nextOpeningPanel), app/ribbon-tabs.ts (nextOpening)

## Problems found (finding IDs)
- F-0069 (S4): anchor change jumps a fixed-gap row
- F-0030 fixed: nextOpeningFields/nextStyleFields replaced by nextOpening over the placed opening's fields
- F-0067 (Also): alignCandidates at 81 and 321

## To check in other files
- whether the plan can be rotated (side names at 101-108 assume north up)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort : a comparator must be consistent and anti-symmetric; sort is stable (line 259)
- https://en.wikipedia.org/wiki/Prototype_pattern : new objects made by copying a prototypical instance instead of a separate structure per type (nextOpening: the next opening is an opening, F-0030)
