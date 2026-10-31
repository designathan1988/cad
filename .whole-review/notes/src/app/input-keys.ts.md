# src/app/input-keys.ts
Lines: 263
Summary: The drawing's keyboard: one window keydown listener that skips fields and dialogs, then tries Tab (next snap), the actions' Ctrl keys, view keys, Alt guides, digits for a guide, arrow locks, nudges, Escape cancels, typing into the measure field, Escape per tool, Enter per tool, Backspace in a chain, the tools' own keys, and last every other action's key: every action key is looked up in the action list (its current key), none is written here.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: shortcuts, tools' keys, arrows, Escape, Enter, Delete, Alt for a guide; shared state in k
- 4-11 imports: actionOfKey/comboOf (keymap), Point2, t, viewKey, App, selectGestures type, arrowStep (nudge), guideBaseAt
- 13-29 KeyContext: shift, Alt start point and moved flag, the element clicked again, the press point, the select gestures, guideTools(), showMarquee(), nextSnap() (Tab), lock(key) (arrows), shiftLock()
- 31-46 the listener: Ctrl or Cmd; key lower-cased; on the level list Ctrl/Delete/Escape are the drawing's (the list blurred); otherwise any field, dialog or the help overlay keeps its keys (except Alt from the measure field); shift remembered
- 47-51 Tab: the next snap under the pointer while snapping
- 52-64 byKey(): the event's combo looked up with actionOfKey in the action list (built for each lookup); found → preventDefault and run, even greyed out (the actions say why they cannot: hint.modifyNothing, hint.copyNothing); Ctrl combos tried here, before the drawing's own keys
- 65-71 view keys (+, −, Shift+arrows) unless typing in a drawing tool
- 72-89 Alt: always kept from the browser; in the guide tools: a second Alt places the guide; else a guide base under the pointer (wall face or guide, hidden ones skipped) starts a guide, or a "no base" hint
- 90-102 digits for a guide's distance go to the measure field; arrows while drawing lock the direction; Shift while drawing holds the snapped direction
- 103-118 arrows nudge the selection in plan (Alt: 1 cm); Esc cancels an object handle drag or a selection drag
- 119-141 with Ctrl or Alt: nothing more; digits after a copy start a series ("3x", "/3"); in tools that ask for a measure, digits . , - @ = go to the measure field (focus + value, refresh)
- 142-209 Escape: clears an error and the field; cancels guide, Modify, drag; leaves the opening tools; floor outline cleared or tool left; room/floor/measure/dimension/grid/section/calibrate/callout/column/object/note/level mark/guide/railing (finishes)/stair/roof/beam-separator-curtain/mark (one point back)/wall/split/corner each step back or leave; finally clears the selection
- 210-230 Enter: place the guide; a turn/scale/mirror about the selection's centre; wall/floor/measure finish; C toggles the measure mode; roof/railing finish; a beam chain ends; an aimed opening is placed
- 231-232 Backspace in a wall chain takes the last wall back
- 233-257 without Shift, the tools' own keys (not actions): C/U in Modify; A arc and Q rectangle in the wall tool (the second key of "W, A" / "W, Q"); Space flips the wall side, turns the object, flips the selected door's swing or the door being placed; H the hinge of the door being placed
- 258-261 every other key: byKey() (tools, Modify, views, N/Shift+N, Del and Backspace, Home, ?, snaps, collisions, 1, 2, the selected door's hinge H)

## Contracts, state and data flow
- Action keys come only from the action list (actions.ts make → keyOf): a key the user changes or turns off changes here too (F-0021 fixed). The tools' own keys stay literal: they are not actions.
- The action list (~200 objects) is built on each lookup (F-0011's cost, now on every key that reaches byKey).

## Depends on / used by
- uses: app/keymap.ts, app/view-keys.ts, tools/nudge.ts, tools/guide-tool.ts, App
- used by: app/input.ts (wireKeys with its KeyContext)

## Problems found (finding IDs)
- F-0021 fixed: the literal checks for the actions' keys were removed; byKey reads the action list
- F-0010 (the footer's literals were a third copy; fixed)

## To check in other files
- app/input.ts: the KeyContext implementation (palette member removed)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key : key is the printed character with the modifiers and the layout (Shift+W → "W", Space → " ", "?" layout-dependent); control keys named "Delete", "Backspace", "Home", "Escape" (lines 38, 55-64, 233-260)
- https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat : repeat true on auto-repeated keydowns (lines 78, 102)
