# src/app/keep-openings.ts
Lines: 45
Summary: Pure follow-up run after every wall change (store wrapper and previews): a door or window placed by a fromStart/fromEnd rule stays where it is when its host wall is stretched or shortened at one end (the rule from the moved end takes the change of length), and goes with the wall when the wall moves whole. No other wall's move changes it (F-0008: the old rule kept the gap to a neighbouring wall's face, a link the user never made).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 header: stations from an end; stretched at one end, the opening stays at the end that did not move; moved whole, it goes with it; nothing else moves it (root cause 2)
- 8-12 imports: distance (as gap), POINT_TOLERANCE, referenceLength, Opening, Doc
- 14-15 SLACK 1e-9 m: a distance change under it is none
- 17-22 keepOpenings(from, to): same walls array → to; walls by id before/after; the openings' rules before, by id
- 23-31 per opening of `to` with a fromStart/fromEnd rule: skipped when the command itself changed its wall, rule kind or distance; skipped when its host is unchanged (same object), missing, or an arc
- 32-35 which ends stayed (within POINT_TOLERANCE); both or neither → the rule is left (the wall moved whole, or was turned/scaled: the opening goes with it)
- 36-40 one end stayed: a rule measured from the moved end gets distance + (new length − old length), so its station from the end that stayed is unchanged
- 42-43 the openings with their new rules, or `to` itself

## Contracts, state and data flow
- Pure; returns `to` itself when nothing changes. A partition beside an opening moving no longer moves it (the old version measured from wall-stops' faces). Arc hosts are left as they are.

## Depends on / used by
- uses: core/vector (distance), core/tolerance (POINT_TOLERANCE), elements/opening/derive (referenceLength), types
- used by: app/app.ts (the store wrapper at 269 and the previews at 447, 475)

## Problems found (finding IDs)
- F-0008 fixed: the hidden link to a neighbouring wall's face removed
- F-0006 (open): the wrapper also runs it when a whole other project replaces the document

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Principle_of_least_astonishment : a component should behave as most users expect (an opening moves with its own wall, not with a neighbour)
