# src/elements/section/commands.ts
Lines: 36
Summary: Commands on section and elevation marks: add several, rename one (unique, trimmed, non-empty), set the depth they see (within limits), and flip their direction.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: each returns a new document, one undo step
- 3-5 imports: Doc and Command types; depth limits and SectionMark
- 7-10 addSections: appended in one step; label for one section or a set of elevations; names not checked for uniqueness here
- 12-20 renameSection: trimmed; refuses empty, a name another mark has, or no change
- 22-29 setSectionDepth: finite, within DEPTH_MIN..DEPTH_MAX, and a real change, on every given mark
- 31-35 flipSections: start and end traded on the given marks

## Contracts, state and data flow
- Pure. Uniqueness of names is enforced on rename only; the tools pick fresh names when adding.

## Depends on / used by
- uses: app/document (type), core/store (type), section/schema
- used by: the section and elevation tools (addSections), app/section-view and the section panel (rename, depth, flip), views dialogs

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trim : trim removes whitespace and line terminators at both ends (line 16)
