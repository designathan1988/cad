# src/ui/dialog.ts
Lines: 113
Summary: The shared frame of every project dialog (levels, wall types, materials, objects, units, keys, variables, sections, overrides, presets, floors, openings, drawing settings, references): drawn into the shell's dialog layer, redrawn after each store change but not while a text field is being typed in (caught up when it is left), focus kept by data-focus key or position, Escape closes from anywhere, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y undo and redo outside text fields, a click on the backdrop closes.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-8 header: redrawn after changes but not under the cursor; undo/redo from anywhere but text fields; Esc closes; focus never lost
- 10 import: App type
- 12-16 ProjectDialog: redraw and close
- 18-24 openProjectDialog setup: the helpBack layer, `stale`, typing() = a text input or textarea inside the layer has focus
- 25-28 between(): focus on nothing or body (between a blur and the next focus)
- 29-33 focusKey: the control with that data-focus key if enabled, else the fallback's, else Close
- 34 focusables: the layer's inputs, selects, textareas, buttons and summaries
- 35-50 redraw: the focused control's key, or its index and tag among focusables; the layer rebuilt; focus restored by key or position
- 51-60 store subscription: stale while typing; between focuses → redraw on the next task; else at once
- 61-71 onFocusOut: after a field is left (microtask, then a task if focus has not landed), redraw when stale
- 72-87 onKey (window, capture): Escape → close on the next task (after the field's own Esc); Ctrl+Z/Y outside text fields → undo/redo, propagation stopped
- 88-90 onClick: a click on the backdrop itself closes
- 91-101 close: once; unsubscribe, listeners removed, layer hidden, focus to the plan canvas (not the opener)
- 102-112 listeners attached (earlier dialogs' onkeydown/onclick cleared), first render, layer shown, handle returned

## Contracts, state and data flow
- The dialog renders from the store each time; its controls dispatch to the store and the subscription redraws.
- No focus containment (F-0114); Escape is taken before any inner control (F-0113 Also).

## Depends on / used by
- uses: app/app (App type: store, shell, undo, redo)
- used by: ui/levels-dialog, types-dialog, materials-dialog, objects-dialog, units-dialog, keys-dialog, variables-dialog, sections-dialog, overrides-dialog, presets-dialog, floors-dialog, openings-dialog, drawing-dialog, app/reference-ui

## Problems found (finding IDs)
- F-0114 (S4): no focus containment in a modal layer; focus returned to the canvas, not the opener
- F-0113 (Also): Escape closes the dialog even when meant for an inner list

## To check in other files
- src/ui/shell.ts: the dialog layer (helpBack) and what else stays focusable

## Sources
- https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ : Tab/Shift+Tab wrap inside the dialog, Escape closes, focus moves in on open and back to the invoking element on close (lines 72-111, F-0114)
