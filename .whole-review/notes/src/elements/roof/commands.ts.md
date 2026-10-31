# src/elements/roof/commands.ts
Lines: 66
Summary: Commands on roofs: add one, and update several. An update can change the roof's form (sides rebuilt for the new kind, parapet and eaves adjusted), every sloped side's slope, the overhang, one side's slope (0 makes a gable), thickness, base offset, parapet and covering.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: each returns a new document, one undo step
- 3-5 imports: Doc and Command types; edgesFor, Roof, defaults and RoofKind from the schema
- 7-10 addRoof: appends a roof to the document's list
- 12-24 RoofPatch: kind, grade (%), overhang, one side's grade, thickness, base offset, parapet, covering (material id, thickness)
- 26-27 gradeOf: the first sloped side's grade, or a fallback
- 29-34 updateRoofs checks: finite numbers; thickness > 0; grade and overhang ≥ 0 (no upper bound: F-0080)
- 35-45 per roof: a kind change rebuilds the sides from the outline (flat gets no overhang and a parapet, sloped from flat gets eaves back); otherwise a grade sets every sloped side
- 46-53 overhang for all sides; one side's grade (≤ 0 → gable); thickness; base offset; parapet ≥ 0
- 54-58 covering merged over the current or the default; an invalid thickness leaves that roof unchanged
- 59-65 JSON comparison for "no change"; same doc when nothing changed

## Contracts, state and data flow
- Pure. Sides are rebuilt by edgesFor (schema.ts) on a kind change, losing per-side slopes (expected).
- The covering's material id is a material reference not counted by materialUses (F-0058).

## Depends on / used by
- uses: app/document (type), core/store (type), roof/schema
- used by: roof fields/panel (updateRoofs), the roof tool (addRoof), presets

## Problems found (finding IDs)
- F-0080 (S4): no upper bound on slope; a negative side slope becomes a gable

## To check in other files
- src/elements/roof/fields.ts: field limits

## Sources
- https://en.wikipedia.org/wiki/Grade_(slope) : grade = 100 × rise/run, 100 % at 45°, unbounded toward vertical (lines 14-15, 32-34, 45-50)
