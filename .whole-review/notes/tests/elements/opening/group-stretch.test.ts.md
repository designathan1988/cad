# tests/elements/opening/group-stretch.test.ts
Lines: 179
Summary: Tests that a distributed group keeps to the stretch of wall its openings were in (between the T or X joints just outside them, or the wall's ends), so distributing never lands an opening on a joint (tester's CK65→CK66). Cases:
- three windows left of an X or a T are spread over 0 to 2.90;
- five windows split by the X become two groups, g and g-2;
- two left and one right of the X: only the two are grouped and the third keeps its rule;
- windows right of the X are spread from 3.10;
- the stretch follows the joint when the crossing wall moves;
- a fixed spacing anchored at the end finishes at the joint;
- an old group (version 3, no stretch) gets a stretch when its spacing changes, whether made in memory or read from a real v3 file with typed ids;
- with the bounding wall deleted, the group takes the whole wall;
- a v3 file whose group already sits on the X is re-spread by stretch when read (as v4 it stays on the X);
- openings on both sides of the X, or a wall with no joint, record no stretch.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: groups keep to their stretch between joints; the tester's case
- 5-11 imports: vitest, document, deriveGeometry/hostsIn, opening commands (delete, distribute, spacing), derive, schema, CURRENT_VERSION/readProject
- 13-22 wall helper (20 cm concrete on its centreline)
- 23-35 0.60 windows on w (6 m); c crosses at x 3 (X), t meets it there (T); left and right sets; docOf, startOf, near (6 digits), clean (every opening valid with no warnings)
- 37-50 for X and T: between [null, other]; starts 0.275, 1.15, 2.025; clean
- 52-73 five windows: groups g [x, y] between [null, c] and g-2 [z, v, u] between [c, null]; starts 1.7/3, 2·1.7/3 + 0.6, 3.375, 4.25, 5.125; clean
- 75-81 two left and one right: one group [x, y]; z stays fromEnd 0.9 at 4.5
- 83-91 right set: between [c, null]; z, y, x at 3.375, 4.25, 5.125 (wall order); clean
- 93-98 c moved to x 2.5: spaces 0.15 within 0 to 2.40
- 100-105 fixed gap 0.1 anchored at the end: z ends at 2.9; the stretch is kept
- 107-115 a group with between removed (pre-stretch), switched to equal: gains [null, c], x at 0.275, clean
- 117-135 a real v3 JSON read by readProject: current version, between undefined, ids typed (group_g, wall_c); switched to equal it gains [null, wall_c] and is clean
- 137-141 c deleted: the group spreads over the whole wall, x at 1.05
- 143-164 v3 with an equal group on the X: read as v4 (version replaced in the string) it is not clean; read as v3 it is migrated to one group [opening_y, opening_z] between [wall_c, null], x stays at 1.05, y at 3.1 + 1.7/3
- 166-171 windows on both sides of the X: no between, whole wall
- 173-178 a wall with no joint: no between, x at 1.05; suite closes (line 179 blank)

## Contracts, state and data flow
- Group placement is derived from the members, the wall and the joints (hostsIn stops). It is one of the derived positions the RC2 fix replaces (F-0068): a crossing wall moved (93-98) moves every member.
- The version 3 → 4 migration splits a group that sits on a joint. The typed-ids migration renames ids on reading.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/opening (commands, derive, schema), src/io/project-file
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none new (derived group positions: F-0068)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace : a string pattern replaces only the first occurrence (line 152 rewrites the one version field)
