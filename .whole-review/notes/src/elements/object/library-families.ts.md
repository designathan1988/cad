# src/elements/object/library-families.ts
Lines: 29
Summary: The library's later families in batches, each with the file version that brought it (50 living … 60 sectors), so an older file gets the batches it lacks and a family the user deleted afterwards is not brought back; and all of them as one list.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: batches by file version; io/project-file.ts adds a batch to files older than it
- 5-14 imports: ObjectDefinition and the nine family lists (living, bedroom, kitchen, bath, office, outdoor, decor, equipment, sectors)
- 16-26 FAMILY_BATCHES: version 50 living, 51 bedroom, 52 kitchen, 53 bath, 54 office, 55 outdoor, 56 decor, 58 equipment, 60 sectors
- 28 LIBRARY_FAMILIES: every batch's families, flattened (computed at module evaluation from the imports, which ES modules evaluate first: no cycle here)

## Contracts, state and data flow
- Pure data; the version numbers are part of the file migration contract (do not renumber).

## Depends on / used by
- uses: the library-* family modules, schema.ts (type)
- used by: elements/object/library.ts (the full library), io/project-file.ts (batches by version)

## Problems found (finding IDs)
- none

## To check in other files
- io/project-file.ts: batch insertion by version

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import : imports are hoisted and their modules evaluated before the importer's body (line 28 reads them at top level)
