# src/elements/wall/join/discover.ts
Lines: 295
Summary: Join discovery. It finds which wall ends meet (corners of two, nodes of three or more), which free ends stop against another wall (abutments), where axes cross inside both walls (crossings), and junctions where several of those meet. It also warns about walls too short, lying over each other, inside another or overrun. Deterministic in id order; 'off' ends are left out.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: corners, nodes, abutments; pure, ascending id order
- 4-11 imports: tolerances, vector ops, offset helpers, schema and shape types, arc segment helpers, join types, gatherJunctions
- 13 ENDS: the two end names, start and end
- 15-27 deriveJoins setup: sorted; walls shorter than MIN_WALL_LENGTH warned and left out; every end except 'off' ones; lookups
- 28-42 internal: an arc's own consecutive segments' joint is not a meeting; clusters of more than two split off such pairs
- 44-61 joint normals of a segment's ends inside its arc (radial bisectors)
- 63-81 across: two ends meeting inside a third wall's band from opposite faces are two Ts, not an L (the host must reach past by more than the thicker wall)
- 83-97 clusters → free ends, corners (two ends, node at their middle) or nodes (three or more, at their centroid)
- 99-114 abutments: a free end inside another wall's band (not at that wall's 'off' end); parallel → 'wallsOverlap'; first host only
- 116-126 a wall with both ends in the same host lies inside it: warned and dropped
- 128-147 ends inside each other: a corner that overran when the axes cross near both ends, else 'wallsOverlap'
- 148-167 crossings found, less those that are an arc T passing a neighbouring segment's line (16 samples inside the arc)
- 168-170 lyingOver pairs warned as 'wallsOverlap' (unless already)
- 171-174 junctions gathered from corners, nodes, crossings and abutments at one point; the graph
- 176-199 lyingOver: parallel straight walls overlapping across and along (a wall drawn twice)
- 201-228 findCrossings: non-parallel pairs whose axes cross inside both, with no real end of either inside the other's band; the thicker core goes through
- 230-242 goesThrough (thicker core, ties by lower id) and coreThickness (summed layers)
- 244-256 interior (strictly inside the length, up to arc joints) and withinBand (the rectangle with ends, tolerance)
- 258-271 clusterEnds: union-find with path compression over all pairs within POINT_TOLERANCE (O(n²) pairs)
- 273-287 Joints type and insideBand (strictly between the ends, or up to the radial plane at an arc joint)
- 289-294 parallel: angle under COLLINEAR_ANGLE, either direction

## Contracts, state and data flow
- Pure and deterministic. Warnings for overlaps of straight parallel walls, walls inside walls and overrun corners come from here (F-0089 narrowed accordingly).
- O(n²) pair loops (clusterEnds, abutments over all hosts, findCrossings, lyingOver) per derivation of all walls.
- User join choices: only 'off' enters here (F-0088).

## Depends on / used by
- uses: core/tolerance, core/vector, wall/geometry (offset, shape, arc), wall/schema, wall/join (types, junctions)
- used by: wall/geometry/footprint.ts (deriveJoins, goesThrough), wall/join/cut-l.ts (goesThrough), other tools reading the graph

## Problems found (finding IDs)
- none new; F-0089 corrected (discovery reports parallel overlaps)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Disjoint-set_data_structure : union-find with path compression (lines 258-271)
