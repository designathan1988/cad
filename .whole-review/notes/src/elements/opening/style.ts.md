# src/elements/opening/style.ts
Lines: 213
Summary: The make of doors and windows as data. It holds the catalogue of usual models (style and size each), a model lookup, the leaf range per operation, which openings swing, the paned operations, fitStyle (keeps a style to what its kind and operation allow), the pane spans and rows from mullions/transoms, the style guard for files, and IFC operation names (unused now).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: phase 5 makes after IFC; catalogue; file check; IFC names; plain openings unchanged
- 6-7 imports: finite, isObject; schema lists and types
- 9-16 OpeningModel: id, kind, style, width, height, sill
- 18-33 door() and win() builders: default frame 5 cm, casing 5 cm (doors) or 0 (windows), extras spread last
- 35-74 OPENING_MODELS: 9 basic doors, 8 basic windows, then designed doors and windows (panels, glazed, louvred, barn, shutter, grille, frosted, full height, sash bars, corner band)
- 76 operationsOf: the kind's operation list
- 78-83 modelOf: the catalogue model whose style is JSON-equal (key order matters: F-0071 Also)
- 85-91 leafRange: double 2, sliding 1-6, folding 2-6, fixed/casement/awning/hopper 1-6, others 1
- 93-97 a misplaced PANED comment above swings (F-0039 Also); swings (door or casement); PANED operations
- 99-118 fitStyle: operation kept to the kind's (else its first); screen only on windows; mullions and transoms only on paned windows, sorted, mullions up to leaves − 1, transoms up to 5; leaves from mullions or clamped; threshold only on doors
- 120-129 paneSpans: at the kept mullions, or `leaves` equal panes
- 131-135 paneRows: at the kept transoms, or one row
- 137-143 splitsIn: sorted, 5 cm clear of the ends and of each other (`at(-1) ?? 0`)
- 145-169 isOpeningStyle: operation known; leaves 1-6; frame and casing 0-0.3; transom ≥ 0 (no upper bound); threshold boolean; screen; splits ≤ 6 non-negative; design; open 0-1; handle; materials as strings; glazing; muntins integer 2-8
- 171-212 ifcOperation: IFC door and window operation names by hinge; read by nothing since the exports left (F-0047 Also)

## Contracts, state and data flow
- Pure data and functions. fitStyle is the only normaliser of edited styles (fields.ts change()), and its output's key order differs from the catalogue's.
- isOpeningStyle guards files (io/project-file.ts:248), together with the kind's operations.

## Depends on / used by
- uses: core/guards, opening/schema
- used by: opening/fields.ts (models, fitStyle, leafRange, operationsOf, PANED), parts.ts (paneSpans, paneRows), io/project-file.ts (isOpeningStyle, operationsOf), app/app.ts:1607-1613 (swings), tests/elements/opening/*

## Problems found (finding IDs)
- F-0071 (Also): modelOf by JSON equality makes edited catalogue styles read "custom"
- F-0047 (Also): ifcOperation unused
- F-0039 (Also): misplaced PANED comment

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/at : at(-1) on an empty array is undefined (line 141)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify : properties in insertion order (line 82)
