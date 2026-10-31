# src/elements/note/fields.ts
Lines: 29
Summary: A note's panel fields: its text (notes only), what a level mark says and its offset (marks only), letter height (min 2 cm), and taking a callout's arrow off.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: the note's panel fields
- 3-4 imports: Field, Note
- 6-9 NoteFieldActions: updateNotes, dropLeaders
- 11-14 noteFields: ids; all marks / all texts
- 15-17 text: a 'text' field — ui/fields.ts builds it as a one-line input (no textarea anywhere in fields.ts): a note's text can never get a line break from the panel, and editing a multi-line note (from a file) drops its breaks, since a text input strips line feeds from its value (F-0059)
- 18-23 a mark's shown height (readout) and its offset
- 24 height: min 2 cm
- 25-28 drop the leader when any has one; the list's end

## Contracts, state and data flow
- The plan draws notes line by line (kinds/note.ts splits on \n), so multi-line notes exist in the model but not in the editor.

## Depends on / used by
- uses: ui/fields.ts (type), elements/note/schema.ts (type)
- used by: elements/kinds/note.ts (fields)

## Problems found (finding IDs)
- F-0059 notes cannot be given several lines, and editing one loses its line breaks

## To check in other files
- ui/fields.ts: the 'text' control

## Sources
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/text : a single-line input; line breaks are stripped from its value; use textarea for several lines (line 17)
