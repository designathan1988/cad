# src/app/guide-ui.ts
Lines: 120
Summary: The guide tool and guides set off a wall face or another guide: modes (line, point, circle), clicks, a circle's typed radius, the guides shown in plan for snapping, the guide draft (start, move, offset typed or pointed, place, cancel), and clearing the level's guides.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: guides from a wall face or a guide; functions over the app
- 3-12 imports: t, parseLength, vector helpers, guide-tool (draftAt, GuideBase, newGuide), guide commands/schema, registry solidsOf, guideKind, newId, App
- 14-16 a doc comment that belongs to levelGuides (61) sits over the GuideMode type (F-0017); GuideMode line | point | circle
- 18-24 setGuideTool: guide tool on, the mode, no first point
- 26-45 guideClick: point mode → a point guide at once; else the first click keeps the point; a second closer than MIN_GUIDE_RUN (1 cm) is ignored; circle → centre + radius; line → through both points (unit direction); each guide one command with a "made" note
- 47-56 guideRadius: a typed radius for a circle begun (≥ 1 cm): the circle guide, true; else false
- 58-59 MIN_GUIDE_RUN 1 cm (declared after the functions that use it: fine at run time, they run later)
- 61-64 levelGuides: in plan, the visible line guides (registry solids)
- 66-73 guideShapes: in plan, point guides as snap nodes, circle guides as snap centres and circles
- 75-84 startGuide: a draft from a base (wall face or guide) at the pointer (snapped to whole steps when snaps are on), snap/error/info/field cleared
- 86-90 moveGuide: the draft follows the pointer
- 92-98 guideOffset: the typed distance while the field parses as a non-negative length, else the draft's
- 100-107 placeGuide: the draft becomes a guide at the offset, one command, field cleared
- 109-119 cancelGuide; clearGuidesHere: one command removing the level's guides

## Contracts, state and data flow
- Guides are document elements (undoable); the draft is interface state (ui.guide).

## Depends on / used by
- uses: tools/guide-tool.ts, elements/guide/*, elements/registry.ts, elements/kinds/guide.ts, core/measure.ts
- used by: app/app.ts (delegations), app/actions.ts (via app.setGuideTool), app/input*.ts (Alt guides)

## Problems found (finding IDs)
- F-0017 misplaced doc comment (14-15)

## To check in other files
- tools/guide-tool.ts draftAt snapping

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let : the temporal dead zone depends on execution order: MIN_GUIDE_RUN (59) is read only when the functions above it are called later
