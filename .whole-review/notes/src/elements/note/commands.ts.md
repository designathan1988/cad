# src/elements/note/commands.ts
Lines: 52
Summary: Note commands: drop leaders (callouts back to plain texts), add a note, update text (trimmed, not for level marks), height and a level mark's offset; an empty text, a non-positive height or non-finite offset changes nothing.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: commands on text notes, each one undo step
- 3-5 imports: Doc, Command, Note
- 7-21 dropLeaders: the leaders of the given notes removed; none had one → unchanged
- 23-26 addNote: appended
- 28-34 updateNotes: a blank text (after trim of spaces and line ends), a height ≤ 0 or a non-finite offset refused
- 35-51 per note: text for notes only, height, offset for level marks only; unchanged → the same note; a new document only when one changed

## Contracts, state and data flow
- A note's text can never become empty through the panel, matching the file guard (kinds/note.ts valid).

## Depends on / used by
- uses: app/document.ts, core/store.ts, elements/note/schema.ts (types)
- used by: app/kind-tools.ts (addNote), elements/kinds/note.ts (updateNotes, dropLeaders)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trim : removes white space and line terminators at both ends (lines 32, 40)
