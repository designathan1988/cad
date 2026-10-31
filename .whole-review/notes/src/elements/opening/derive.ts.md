# src/elements/opening/derive.ts
Lines: 234
Summary: Turns opening rules into positions on their host walls, with warnings. It covers host info per wall (reference length, height, straight line, joints inside it, clear length between corner faces), a group's stretch, and deriveOpenings: reference checks with loop detection, group stations, cross-wall alignment, then outside/overlap/too-tall warnings.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: rule → position, derived every time; "an opening moves only when its rule's own reference moves"
- 4-9 imports: Doc/DocWall/wallHeights, POINT_TOLERANCE, vector ops, arcOf, WallId, opening types
- 11-20 HostInfo: length, height, line when straight, joints (T/X stations), clear (from inner face to inner face at the corners)
- 22-35 warning kinds (no host, bad reference, outside, overlap, too tall, at joint, swing clash) and OpeningWarning
- 37-44 PlacedOpening: opening, start < end stations, valid, warnings
- 46-50 referenceLength: chord, or arc radius × |sweep|
- 52-71 hostsOf: per wall, heights from wallHeights, line only when straight, the joints and clear ends passed in
- 73-84 groupStretch: between the bounding joints (their hi/lo) or the clear ends; a joint gone gives the end back; empty means the whole length
- 86-94 deriveOpenings starts: maps by id, inGroup test (rule, group id and same wall)
- 96-111 referenceOf and wrongReference: inGroup without its group, listing or host; fromOpening on another wall; aligned on the same wall or a curved one
- 112-125 badReference: wrong, or a loop found by following references with a seen set; a chain reaching a wrong reference is fine for this one (that one centres)
- 127-154 startsInGroup (memoised): members truly in it, equal spacing (gap = free length / (n+1)) or fixed gap anchored at start, end or centre
- 156-162 across: station on another straight wall of a point at station s (projection)
- 164-193 startOf (memoised): fromStart, fromEnd, centred (also for a bad reference), inGroup, aligned (the reference's jambs projected, by edge), fromOpening (after or before the reference)
- 195-200 warnings per opening and in a list
- 201-210 no host; bad reference; outside the host length
- 211-220 overlap: every pair of openings, same wall tested inside the loop (O(n²))
- 221-224 too tall for the host's height
- 226-233 placed map: start, end, valid when no warning

## Contracts, state and data flow
- Pure. Positions are never stored. They are recomputed from rules on every call, so an opening's place depends on other openings (fromOpening, aligned, inGroup) and on the host's length (fromEnd, centred, groups): F-0068 (RC2).
- startOf terminates: loops are detected by badReference before recursing (a looping opening is centred).
- `groupById.get(...)!` and `byId.get(...)!` (175, 177, 187) are safe because wrongReference was checked first.
- Cost: O(n²) pair loop per call, plus chain walks in badReference.

## Depends on / used by
- uses: app/document.ts (wallHeights), core/tolerance, core/vector, wall/geometry/arc, wall/schema, opening/schema
- used by: app/geometry.ts (hostsIn, placing openings for the model), opening/commands.ts (everything), keep-openings, select-drag, opening tool, fields, plan and 3D rendering through geometry

## Problems found (finding IDs)
- F-0068 (S2, RC2): positions computed from other openings; a bad reference silently centres
- F-0067 (Also): the pair loop makes each derive O(n²)

## To check in other files
- src/elements/opening/schema.ts: the rule kinds and their migration (for F-0068)
- src/app/keep-openings.ts: how rules are rewritten after wall edits

## Sources
- https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-05A0DA70-E276-4944-ACCA-5702DC8B9DCA.htm : doors are hosted components repositioned along their wall; a new host by Pick New Host (the reference for F-0068's fix: each opening placed on its own host)
