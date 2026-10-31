# src/elements/dimension/constraints.ts
Lines: 137
Summary: Keeping locked and equal (EQ) dimensions after every model change (pure): a locked dimension whose length changed moves what holds its other end (a free point, a wall moved or stretched, a door/window along its wall, never against the rule the user chose for it) by the difference; an EQ chain moves its middle points to equal steps; repeated until nothing moves (12 rounds), or the change refused naming a dimension.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 header: Revit's padlock and EQ; kept after every change; the change refused when they cannot be kept
- 8-14 imports: Doc, deriveGeometry, vector, moveWalls/stretchEnd, PositionRule, placeDimension/resolve, DimAnchor/Dimension
- 16-19 SAME 0.01 mm; ROUNDS 12
- 21 Settled: ok with the doc, or the dimension and why it failed
- 23-28 equalChains: dimensions with a chain and eq, grouped, two or more
- 30-33 shiftEnd: what holds an end moved by delta
- 34-46 a free point moves (and a chain member sharing it)
- 47-56 a wall: both ends on it → that end stretched; else the whole wall moved with its joins (moveWalls)
- 57-64 an opening: only along its wall (any part across → null)
- 65-68 a centred, aligned or grouped opening cannot be moved (the user's rule would be undone): null, so the change is refused and said (F-0050)
- 69-79 the distance changed by the move along (sign by rule kind and direction); negative → null; the opening updated
- 81-88 settleDimensions: no locks or EQ → unchanged; the geometry before; up to 12 rounds
- 89-95 each round derives the whole model again; the first locked dimension off its length
- 96-110 the end the change moved leads, the other follows (both or neither: b follows); moved by the difference; impossible → refused naming it; one move per round
- 111-131 EQ chains: each middle point to its equal step along first→last; one move per round
- 132-133 nothing moved → settled
- 134-136 rounds used up → refused, naming the FIRST locked (or EQ) dimension of the document, not the one that kept moving

## Contracts, state and data flow
- Runs on every edit through the store wrapper (not on a replaced document: F-0006), deriving the whole model up to 13 times when any lock exists: slow on large models for every edit.
- A lock moves whole walls with their joins and slides openings measured by distance: user-made, visible links (the goal allows those). It never rewrites a centred, aligned or grouped rule (F-0050 fixed): such a change is refused with app.ts's toast (dim.refusedLocked / dim.refusedEqual).

## Depends on / used by
- uses: app/geometry.ts, tools/edit.ts, elements/dimension/anchor.ts, core/vector.ts
- used by: app/app.ts (store wrapper: settleDimensions), tests/elements/dimension-constraints.test.ts

## Problems found (finding IDs)
- F-0050 fixed (65-68 refuse instead of replacing the rule)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/break : an unlabeled break leaves only the innermost loop (lines 109, 128, 130: one move per round)
- https://help.autodesk.com/cloudhelp/2014/ENU/Revit-LT/files/GUID-BD91C1BE-4FBC-41F0-AC82-5C60A545EAC6.htm : a locked dimension's value is fixed, preventing any change to the distance; to change it the user unlocks it (F-0050: refuse, do not rewrite)
