# src/io/library-file.ts
Lines: 182
Summary: Shareable libraries of object definitions (with what they nest) and materials, as a JSON file or a link hash (#lib=, deflate-raw in base64url). The file covers making a library from the project, finding the materials a definition uses, and merging a library in: same items are kept, clashing ids get new ids and their references follow, and invalid items are counted. Also encoding and decoding the link.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-7 header: phase "diferenciais 9" shared libraries; checked as the project file checks; clashing ids renamed, references follow; pure but the compression
- 9-14 imports: newId, Doc, Material, object schema, isDefinition, isMaterial
- 16-22 LIBRARY_VERSION 2 and LibraryFile
- 24-44 mapMaterials: every material reference of a definition through f — parameter defaults, part materials (not parameter names), nested objects' material values, type values
- 46-54 materialsUsed: the ids mapMaterials visits
- 56-74 libraryOf: the chosen definitions (all when null) and every nested one, as deep as they go; their materials plus the chosen ones
- 76-78 MergeResult: counts of definitions, materials, bad, same; or not a library
- 80-92 mergeLibrary: a plain list or {definitions, materials}; valid items only
- 93-105 materials: an identical one (JSON) is the project's; a clashing id gets a new id
- 106-130 definitions: identical ones kept (after mapping materials), unless something they nest is not; the rest under their id or a new one
- 131-147 added definitions with materials and nested ids remapped; the new doc and counts
- 149-150 LINK_KEY 'lib='
- 152-163 base64url encode (chunks of 32 KB through fromCharCode) and decode (atob)
- 165-167 through: a byte array piped through a (de)compression stream
- 169-173 libraryHash: JSON deflated (raw) in base64url after '#lib='
- 175-181 libraryFromHash: decoded and inflated whole, then parsed (no size limit: F-0094)

## Contracts, state and data flow
- Pure except the streams. Merge checks shapes (isDefinition, isMaterial), not size or counts.
- Nested part `values` with literal material ids are remapped (answers object/materials.ts's question).

## Depends on / used by
- uses: core/id, app/document (type), material/schema (type), object/schema, object/valid, io/project-file (isMaterial)
- used by: app/library-link.ts (links), the objects/materials dialogs (export/import files)

## Problems found (finding IDs)
- F-0094 (S3): unbounded inflate and unasked merge from a link

## To check in other files
- src/app/boot.ts: when links are opened

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream : a stream transform with no size limit of its own; Baseline since May 2023 (lines 165-181)
