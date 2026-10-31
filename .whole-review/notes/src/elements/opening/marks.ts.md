# src/elements/opening/marks.ts
Lines: 46
Summary: Door and window type marks derived from sizes and makes (P1, J2…), and where an opening's tag goes beside it in plan.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: a type is a size with its make; numbered from the smallest; derived, never stored ("in the schedule": stale)
- 6-8 imports: vector ops, opening types, OpeningFrame
- 10-11 SAME: sizes within 1e-6 m are one
- 13-28 openingMarks: per kind, distinct (width, height, sill for windows, make = JSON.stringify(style)) keys, sorted by width, height, sill, make (localeCompare), each opening numbered by its key's index plus the kind's prefix
- 30-35 markPoint doc: off the middle, `clear` out from a face; doors away from the swing, windows outside unless that side is in a room
- 36-45 markPoint: door by swing side; window on the exterior face, or the interior one when only the exterior point is in a room

## Contracts, state and data flow
- Pure, recomputed per call; marks depend on every opening of the kind (adding a smaller size renumbers all).
- Make equality is string equality of the whole style (F-0071).

## Depends on / used by
- uses: core/vector, opening/schema, opening/void (type)
- used by: elements/opening/panel.ts:44 (mark readout), the plan's opening tags (render), fields.ts (marks map)

## Problems found (finding IDs)
- F-0071 (S3): make by JSON of the whole style (open amount, key order)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare : without a locale the default locale decides the order (line 24)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify : properties serialised in insertion order (line 19)
