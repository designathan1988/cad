# src/core/store.ts
Lines: 84
Summary: The document store: commands turn one immutable version into the next, each dispatch one undo step (unchanged result: no step); undo/redo stacks with labels; reset (new history); listeners told after every change.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the only way the project changes; one dispatch, one undo step
- 4-10 Command: label (message key), apply(doc) → doc, replaces? (it puts another document in place: not an edit; app.ts's wrapper then runs no edit follow-up, F-0006)
- 12-25 Store: get, dispatch, undo, redo, canUndo/canRedo, undo/redo labels, reset, subscribe
- 27-35 createStore: the current doc, past/future versions and their labels, listeners, emit (forEach: a throwing listener stops the others)
- 36-47 dispatch: apply; the same object → nothing; else pushed to past with its label, future cleared, emit
- 48-56 undo: back one version, the step moved to future
- 57-65 redo: forward one version, the step moved to past
- 66-69 canUndo/canRedo and the labels
- 70-77 reset: the doc replaced, history cleared, emit
- 78-83 subscribe: added; the unsubscribe function

## Contracts, state and data flow
- History is unbounded: every step keeps its whole version (shared structurally, since docs are immutable). Long sessions with many small steps (arrow nudges) grow memory without a limit.
- app.ts wraps dispatch with follow-ups (settleDimensions, keepOpenings, keepRooms) for edits; a command with replaces (open, new project) passes as it is (F-0006).

## Depends on / used by
- uses: nothing
- used by: app/app.ts (the app's store and its dispatch wrapper), every Command producer (elements/*/commands.ts, app/*-ui.ts), tests/core/store.test.ts

## Problems found (finding IDs)
- none (unbounded history noted)

## To check in other files
- app.ts: the dispatch wrapper and what undo/redo run (follow-ups on undo?)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/forEach : values added during forEach are visited, deleted ones skipped; an exception propagates and stops it (line 33)
