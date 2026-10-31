# src/tools/split.ts
Lines: 226
Summary: Dividing a wall at a point (refused when a part would be under 5 cm or the cut goes through an opening), joining two straight in-line walls of the same type, line, top and base into one, and making two walls meet at a corner (Revit's Trim/Extend to Corner). Openings stay where they are: re-hosted on the part they lie on with their rule kept when its reference survives, else turned into fromStart; groups split by the cut are undone. Each wall keeps only the end joins of its own outer ends, and dimensions (and an arc's measures) held by a wall go with the end or part they were on (F-0106).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: Split / merge / corner; openings stay, re-measured; split groups undone
- 6-16 imports: Doc types, hostsIn, MIN_WALL_LENGTH, vector helpers, deriveOpenings/referenceLength, opening types, EndJoin, DimAnchor, arc helpers, meet and stretchEnd (edit.ts), GRID_STEP
- 18-19 MIN_PART = GRID_STEP (5 cm)
- 21-33 stationOf: the foot's distance along the reference line (straight) or along the arc (angle within the sweep), null off the run
- 35 SplitProblem: tooShort or throughOpening
- 37-52 splitWall checks: the wall, the station, both parts ≥ 5 cm, no placed opening spanning the cut
- 54-72 the two parts: an arc's sweep split (bulge tan(φ/4) each), or the straight cut point; the first keeps only the start's join, the second only the end's (withEndJoins: nothing chosen at the cut)
- 74-92 openings: those starting past the cut go to the new part; groups spanning both undone; a rule kept when its reference still holds (group intact, aligned, fromStart on the first, fromEnd on the second, fromOpening with its reference on the same part), else fromStart at its placed start
- 93-100 groups: broken ones removed; the rest lose `between` and move to the new part when all their members did
- 101-110 the new part appended after all walls (numbers kept); dimensions held from the wall's end go to the second part (same end, same distance), those from its start stay; an arc's measures to the part their t falls on, t rescaled; the doc returned
- 112-117 withEndJoins: the wall with only the given end joins, no joins key without any
- 119-122 canMerge: true when mergedEnds finds a joined line
- 124-141 mergedEnds: both straight, same level, type, reference line, top and base offset (JSON compare), parallel within 1e-9, end to end within 1e-6 once b is turned to a's direction
- 143-157 mergeWalls: the merged wall from a with the outer ends' joins taken from the wall that owned each (b's swapped when it ran the other way)
- 158-174 dimensions held by a or b re-held by the merged wall at the same point: from an end that is still an end (b's turned round when flipped, its offset negated), else from the merged start at its station
- 175-195 openings of both re-hosted on a with fromStart stations (aligned kept); a door of a flipped b swaps hinge and swing; groups of both removed
- 196-203 the doc: b deleted, a merged, openings, groups, dimensions
- 205-225 cornerWalls: the lines' crossing by edit.ts meet (null when about parallel: F-0101's guard); each wall's nearer end stretched there (stretchEnd, its corner neighbours following), refused when a wall would vanish or for arcs/parallels

## Contracts, state and data flow
- Pure; returns a Doc (split, merge) or walls (corner) for one dispatch by modify-ui.ts.
- Openings are placed from the doc before the change and stored as explicit fromStart where their references do not survive.
- An arc's dimension along its chord is moved to the second part by its end only (its chord changes; the point is read against the new part's chord).

## Depends on / used by
- uses: app/document, app/geometry (hostsIn), core/tolerance, core/vector, opening derive/schema, wall/schema (EndJoin), dimension/schema (DimAnchor), wall/geometry/arc, tools/edit (meet, stretchEnd), tools/snap (GRID_STEP)
- used by: app/modify-ui.ts (150-199: split, corner, merge)

## Problems found (finding IDs)
- F-0106 fixed (joins by outer end; dimensions and arc measures re-held)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring : object rest copies own enumerable properties not picked off, shallowly (lines 98, 114: `between` dropped from a group, `joins` from a wall)
- https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-1FD99EBE-5F75-4B54-858B-B18D7DE297C6.htm : Split Element divides an element into two separate parts (each with its own ends, F-0106)
