# src/app/modify-ui.ts
Lines: 252
Summary: The Modify tools over the selection (move, copy, rotate, mirror, scale, offset) driven by tools/modify-tool.ts's state machine, the copy series ("3x", "/3"), and the wall tools split, corner and merge; plus the marks a Modify tool shows. Functions over the App (app.ts delegates).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: Modify tools, split, corner, merge; app.ts delegates
- 3-13 imports: units text, vector, setWalls, i18n, wallNumber, geometry, modify-tool, transform, split, newId, App type
- 15-21 startModify: nothing transformable selected → hint, chrome only
- 22-27 offset needs a straight wall in the selection (its first): else hint
- 28-42 the selection kept across setTool('select'); tool 'modify'; copy on for copy/mirror/offset; offset carries its wall's line; the geometry before saved (modifyBefore) for the transform
- 44-50 toggleModifyCopy (C)
- 52-58 toggleModifyDisjoin (U, move only)
- 60-75 modifyEvent: the transition with the snap or cursor; leave → select tool; rejected typed value → error with examples; a step that does not apply yet updates the state
- 76-86 the transform: from modifyBefore's geometry; label cmd.copy for a move-copy else cmd.<kind> (all keys exist in i18n); tool, modify, snap reset; the result's selection; one dispatch whose apply returns the computed doc (the store wrapper's follow-ups still run on it)
- 87-95 a moved copy (move/copy/offset with copy on and a non-zero delta, the delta read by mapping the origin) remembered for a series, with a hint
- 96-102 a scale that touched objects: the hint that parametric objects keep their sizes
- 103-111 seriesReady: no change since the copy (identity of the doc) and the copy still exactly selected
- 113-140 copySeries: no copy just made → error naming the Copy tool's key as the user has it; n integer 1..200; the step (divided for "/n"); the series computed from the doc before the copy; the copy undone and the series dispatched as one step; the last copy selected; hint with n and the step
- 142-161 splitAt: the wall under the point split with a new id; a string result is the reason (through an opening / too short); else one step and a hint naming both wall numbers
- 163-186 cornerClick: first click selects a wall; second meets both at their lines' corner (cornerWalls) or says none; the selection Set is cleared IN PLACE (line 177) instead of replaced; the first wall is the selection's first id, whatever it is
- 188-202 mergeSelection: two selected walls joined into one (mergeWalls) or a hint why not
- 204-208 canMergeSelection: two walls that can merge
- 210-216 selectionCentre: the centre of the selection's derived box, else the first selected guide's point
- 218-233 modifyMarks for offset: the foot on the wall's line, the pointer, the distance text (len2 zero only for a zero-length wall, which walls cannot be)
- 234-251 modifyMarks otherwise: base, pointer, reference; text by kind: distance for move/copy, the turn normalised to [−180, 180) with ((x % 360) + 540) % 360 − 180, the scale factor, the mirror axis angle in [0, 180); the mirror axis as a unit direction

## Contracts, state and data flow
- The transform is computed against modifyBefore (geometry at the tool's start) and dispatched as a fixed result: correct because the document cannot change while the tool runs (input is captured).
- copySeries relies on store.undo() restoring c.before exactly (the wrapper's follow-ups ran on the copy step).
- cornerClick's first wall is the selection's first id: if a door or object is selected when Corner starts, the second click says "no corner" (setTool('corner') clearing the selection: to check).

## Depends on / used by
- uses: tools/modify-tool.ts, tools/transform.ts, tools/split.ts, elements/wall/commands.ts, app/geometry.ts, app/document.ts, ui/units.ts, ui/i18n.ts, core/vector.ts, core/id.ts
- used by: app/app.ts (delegating methods), app/input.ts / input-keys.ts (clicks, C, U, typed values), app/frame.ts (modifyMarks), app/actions.ts (startModify, merge)

## Problems found (finding IDs)
- none

## To check in other files
- app.ts setTool: clears selection when entering the corner tool; does anything compare ui.selection by identity (line 177 mutates it)
- tools/transform.ts: transformSelection keeping openings on moved walls (goal flow "move a wall carrying its openings")

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder : % keeps the dividend's sign; ((n % d) + d) % d gives a positive modulo (lines 243, 246)
