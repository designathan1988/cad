# tests/elements/annotations.test.ts
Lines: 73
Summary: Tests of callouts (where the leader leaves the text's box, the arrow moving and mirroring with the note, a bad arrow invalid, picked on its arrow, the arrow taken off) and room tags (what the tag says per drawing setting in Portuguese, one line when the area line is empty, the setting validated).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: a callout's leader; what a room's tag says
- 4-12 imports: vitest, newDocument, roomTagText, drawing schema, noteKind, dropLeaders, leaderStart/Note, layoutRoomTags, setLang
- 14 a callout note with its arrow point
- 16-48 callouts: leaderStart by box side (worked: a fifth vs a third of the way), moved/mirrored arrow, validity, hit on the arrow, dropLeaders (idempotent)
- 50-52 room tags: a room, and the language set to Portuguese in the describe body (left set for the rest of the file)
- 54-61 the four tag styles; the room's own height wins
- 63-66 a tag with an empty area line laid out on one line
- 68-72 roomTag validated in the drawing settings

## Contracts, state and data flow
- Pure; i18n module state set once (no reset; Vitest isolates files).

## Depends on / used by
- uses: src/app/document, src/app/room-tag, src/elements/drawing/schema, src/elements/kinds/note, src/elements/note (commands, schema), src/render/room-tags, src/ui/i18n
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/describe.html : suites and their tests are collected from the file's structure (line 52 runs while collecting)
