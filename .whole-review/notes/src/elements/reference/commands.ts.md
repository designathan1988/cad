# src/elements/reference/commands.ts
Lines: 35
Summary: Commands on reference pictures and PDFs: list them, add one, update opacity/turn/scale/place on several, and replace one as calibrated.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: each returns a new document, one undo step
- 3-5 imports: Doc and Command types; isReference and the Reference type
- 7 referencesOf: the document's list of references
- 9-12 addReference: appended only when it passes isReference
- 14-28 updateReferences: merge the patch, refuse what is not a reference; "no change" by JSON.stringify of the whole reference, image data URL included (F-0079)
- 30-34 setReference: replaces an existing one by id when valid (calibration)

## Contracts, state and data flow
- Pure. A picture's pixels live in the Doc as a data URL; each update copies them into two JSON strings (F-0079).

## Depends on / used by
- uses: app/document (type), core/store (type), reference/schema (isReference, Reference)
- used by: app/reference-ui.ts (import, calibrate, move, opacity), the reference kind's panel

## Problems found (finding IDs)
- F-0079 (S3): whole image serialised twice per update

## To check in other files
- src/app/reference-ui.ts: update frequency while dragging

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify : serialises every own enumerable value, strings included in full (line 22)
- https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/data : base64 data URLs take 4 characters per 3 bytes; Chromium allows up to 512 MB (the size of what line 22 copies)
