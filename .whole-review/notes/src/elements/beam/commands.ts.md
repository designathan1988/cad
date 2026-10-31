# src/elements/beam/commands.ts
Lines: 39
Summary: Beam commands: add a beam; update the section/top/end offsets/shape/plate of several beams (refusing non-positive sizes and non-finite offsets; no step when nothing changes).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: commands on beams, each one undo step
- 3-5 imports: Doc, Command, Beam
- 7-10 addBeam: appended
- 12-19 BeamPatch: width, depth, top offset, end offset, shape (rect or I), plate thickness
- 21-27 updateBeams: width/depth/plate not above zero, or non-finite offsets → unchanged (the floor is > 0, not MIN_ELEMENT_SIZE's 1 cm "however it is set")
- 28-38 each listed beam merged with the patch; unchanged by JSON → kept; a new document only when one changed

## Contracts, state and data flow
- The patch is spread over the beam: with exactOptionalPropertyTypes on (tsconfig.json:8) a key cannot carry an explicit undefined, so spread cannot blank a field.

## Depends on / used by
- uses: app/document.ts (type), core/store.ts (type), elements/beam/schema.ts (type)
- used by: app/kind-tools.ts (addBeam), elements/kinds/beam.ts fields (updateBeams): to confirm

## Problems found (finding IDs)
- none (the > 0 floor vs MIN_ELEMENT_SIZE to check against the beam's validator)

## To check in other files
- elements/beam/schema.ts: the validator's minimum sizes

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax : object spread copies own enumerable properties, undefined values included; later keys win (line 31)
