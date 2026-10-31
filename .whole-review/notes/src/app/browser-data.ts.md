# src/app/browser-data.ts
Lines: 14
Summary: Pure helper for the project browser: how many walls use each wall type, on one level or on all.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header (pure) and the Doc type import
- 5-13 typeUsage(doc, levelId?): a Map of every type id → 0 in the types' order, then +1 for each wall (of the level when given) whose type is in the map; walls of a type not in the project are not counted

## Contracts, state and data flow
- Input: the document; output: a new Map, insertion order = doc.wallTypes order (the browser lists types in that order). No mutation.

## Depends on / used by
- uses: app/document.ts (type)
- used by: ui/browser.ts (the types section), tests/app/browser.test.ts

## Problems found (finding IDs)
- none in this file

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/Map : new Map(entries) adds each [key, value] (line 7); iteration in insertion order per the Map page (the constructor page does not state it)
