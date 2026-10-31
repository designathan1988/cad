# src/elements/measure/commands.ts
Lines: 34
Summary: Measure commands: add one; update what arc measures say and at which line, or an angle's arc radius (coordinates unchanged), with no step when nothing changes.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: commands on the measures, each one undo step
- 3-5 imports: Doc, Command, ArcFace/ArcMeasure/Measure
- 7-10 addMeasure: appended
- 12-17 updateMeasures: the ids as a Set
- 18-30 an angle takes a radius > 0 (Infinity passes the check); a coordinate is left; an arc measure takes type and face; unchanged by JSON → the same object
- 31-33 a new document only when one changed

## Contracts, state and data flow
- Pure; the radius field's min (5 cm, kinds/measure.ts) keeps typed values sensible.

## Depends on / used by
- uses: app/document.ts, core/store.ts, elements/measure/schema.ts (types)
- used by: app/kind-tools.ts (addMeasure), elements/kinds/measure.ts (updateMeasures)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/has : true when the value is in the set (line 19)
