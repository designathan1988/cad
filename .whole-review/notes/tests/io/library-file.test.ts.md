# tests/io/library-file.test.ts
Lines: 117
Summary: Tests of shareable libraries (phase 11, differential 9).
- A definition is exported together with what it nests and the materials both use (materialsUsed, libraryOf); a single material can be exported alone.
- Merging into a project that lacks them adds them as they are; a material the project already has, identical, is not added twice.
- Merging into a project that has other things under the same ids gives new ids, and every reference follows: the parameter default, the nested definition and the nested value. A parameter name used as a material stays.
- Merging the same library twice adds nothing the second time and reports "already here". A definition changed in the project since then comes in again beside it.
- An old library format (a bare list) is still read, with bad entries counted. Something that is not a library is refused.
- A link `#lib=` carries the library (deflate-raw, base64url) and gives it back; another hash gives null.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: definitions with nested ones and materials, new ids where taken, carried in a link
- 4-9 imports: vitest, Doc/newDocument, Material, ObjectDefinition, isDefinition, the library-file functions
- 11-36 words(); a gold material; a handle with a material parameter defaulting to gold; a door nesting the handle; the source document
- 38-42 both definitions are valid
- 44-51 materialsUsed(door) = gold and wood; libraryOf(['def_door']) brings the handle and both materials; a material alone gives {cad2Library: 2, definitions: [], materials: [gold]}
- 53-62 merge into an empty project: 2 definitions, 1 material (wood already there), the door unchanged
- 64-86 the target has a silver material under mat_gold and another def_handle: the new gold gets a new id; the project's own are untouched; the merged handle gets a new id and its default follows; part material 'acabamento' stays; the door's nested definition and value follow; wood stays
- 88-100 merged twice: [0, 0, 2] with "same"; the project's handle renamed: the library's comes in again, [2, 0]
- 102-106 a bare list [handle, {id: 'bad'}]: 1 definition, 1 bad; {hello: 1} gives notLibrary
- 108-116 libraryHash starts with '#lib=' in the base64url alphabet; libraryFromHash restores it; '#nothing' gives null; suite closes (line 117 blank)

## Contracts, state and data flow
- Library files are plain JSON (version cad2Library 2). Merging is pure and returns counts: added, same, bad. The link uses CompressionStream('deflate-raw') and base64url (library-file.ts:155-171), which needs the Compression Streams API in the test runtime (Node 18+ exposes it).

## Depends on / used by
- uses: src/app/document, src/elements/material/schema, src/elements/object (schema, valid), src/io/library-file
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://compression.spec.whatwg.org/ : CompressionStream formats include deflate-raw (the link, lines 108-115)
- https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream : the stream interface, available across browsers since May 2023 (lines 108-115)
