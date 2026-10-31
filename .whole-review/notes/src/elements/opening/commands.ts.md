# src/elements/opening/commands.ts
Lines: 367
Summary: Commands and rule helpers for doors and windows. It covers the placement check, adding, updating and deleting (with walls), holding a rule to its wall, detaching dependents, rewriting a rule to keep the opening's place, reference and alignment candidates, aligning centres and heads, distributing groups (split at joints), group spacing and ungrouping. Group bookkeeping is done by the private settleGroups.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: no command moves an opening as a side effect, except a distributed group; the latter is stale, see F-0039 Also
- 6-12 imports: MIN_ELEMENT_SIZE, dropKinds/hasKinds, Doc/wallHeights, Command, deriveGeometry/hostsIn, deriveOpenings and types, opening schema types
- 14-19 placementProblem: derive with the new opening; overlap or outside blocks it
- 21-24 addOpening: appends
- 26 placedIn: derive all openings on their hosts
- 28-55 settleGroups: members that left (another rule, wall, deleted) are taken out. A changed group is dissolved, and its lone or broken members become fromStart at their place in `before` (0 when not placed).
- 57-73 updateOpening: merge the patch; refuse a width or height under MIN_ELEMENT_SIZE or a sill below 0; no change (JSON.stringify) means no step; settleGroups
- 75-105 deleteElements: drop walls, their openings and the given openings. Openings measured from or aligned with a deleted one become fromStart at the same place (`placed.get(o.id)!`). dropKinds handles other kinds (dimensions go with their ends); then settleGroups.
- 107-112 a doc comment for ruleKeepingPosition, misplaced (F-0039)
- 113-127 wallRule: a fromOpening/aligned rule turned into fromStart or fromEnd by the nearer end, at its current place (what the tools store)
- 129-133 detachedFrom: openings measured from or aligned with `id` get wallRule, so `id` moves alone (used by nudge and select-drag)
- 135-161 ruleKeepingPosition: the rule of a kind that keeps the place. fromOpening needs a reference on the same wall, without a loop, toward the nearer side. aligned needs an align candidate. inGroup gives null.
- 163-174 dependsOn: follows references with a seen set (no infinite loop)
- 176-181 referenceCandidates: same wall, not itself, no loop
- 183-188 alignFits: derive with the aligned rule; the result must not be outside or a bad reference
- 190-207 alignCandidates: other straight walls, no loop, and alignFits for each, so one derive per candidate (F-0067)
- 209-218 alignOpenings: those that can be aligned get the aligned rule; settleGroups
- 220-249 alignHeads: head height from the reference's base; a door changes its height, a window its sill; refuses height ≤ 0 or sill < 0, with no MIN_ELEMENT_SIZE or wall-top check; no settleGroups
- 251-313 distributeOpenings: two or more on one wall, sorted by place, one group over their stretch. When a member would land on a T/X joint, it splits into runs by the joints between their middles, one group per run of two or more, and members left alone become fromStart at their place.
- 315-326 stretchAround: nearest joints wholly before and after the openings
- 328-346 setGroupSpacing: changes spacing; a version 3 group without a stretch gets one from its members' places
- 348-366 ungroupOpenings: removes the group; members become fromStart at their place

## Contracts, state and data flow
- Every command returns a new Doc (store: one undo step); "no change" returns the same doc.
- Rules are the opening's position (RC2). fromOpening and aligned make one opening follow another. wallRule and detachedFrom are the stop-gaps that hold dependents still while one is dragged (select-drag.ts:189, 279; nudge.ts:26; app.ts:562 for new openings).
- settleGroups is private: other modules that rewrite a member's rule (dimension/constraints.ts:67) leave the group unsettled (F-0050 Also).
- The `!` lookups (98, 265, 361) assume every opening is placed by derive, which holds while its wall exists.

## Depends on / used by
- uses: core/tolerance, core/store, elements/registry (dropKinds, hasKinds), app/document, app/geometry (hostsIn, deriveGeometry), opening/derive, opening/schema
- used by: app/frame.ts (align, distribute, spacing, ungroup, update, ruleKeepingPosition), app/wall-ui.ts:286, app/app.ts:562, app/select-drag.ts, tools/nudge.ts, elements/opening/fields.ts (candidates), elements/dimension/constraints.ts:67, the delete action

## Problems found (finding IDs)
- F-0067 (S3): alignCandidates does O(n) full derivations per call (panel, multi-selection)
- F-0039 (Also): misplaced doc comment 107-112; stale header about groups
- F-0050 (Also): rewritten group members are not settled outside this file

## To check in other files
- src/elements/opening/derive.ts: how a group listing a member whose rule is not inGroup is placed; the cost of deriveOpenings (F-0067)
- updateOpening with a `wallId` patch keeps a fromOpening/aligned rule pointing at an opening on the old wall: see who patches wallId (select-drag.ts uses wallRule at 279)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify : keys in Object.keys order; undefined omitted and NaN turned to null, so string comparison is only a rough equality (lines 67, 336)
