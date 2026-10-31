# src/tools/opening-tool.ts
Lines: 150
Summary: The door and window tool as a pure state machine: hovering over a wall aims (the aim fitted into the free stretch nearest the cursor); the position stored is a rule read from the cursor (centred within 10 px of the middle, else the nearest reference: the stop before, the stop after, or a neighbouring opening's jamb, in 5 cm steps); a click places it with the swing side, a typed distance places it from the same reference; Escape goes idle.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-20 header: never a coordinate, always a rule; the transition table; how the rule under the cursor is chosen; ends measured from meeting walls' faces (stops)
- 22-24 imports: rule types and hasDistance, WallId, stopBefore/stopAfter (app/wall-stops)
- 26-27 OPENING_STEP 5 cm and CENTRE_PX 10
- 29-46 Aim: wall id, length, cursor station, side, other openings' jambs, mpp, stops, occupied bands (walls standing across)
- 48-66 fitAim: the free stretches between ends and stops; skipped when too narrow or occupied; the station clamped into each; the nearest kept
- 68-84 state, event and result types; OPENING_IDLE
- 86 step: round to 5 cm
- 88-98 ruleBase: the stop before (fromStart) or the length past the stop after (fromEnd), else 0
- 100-124 ruleAt: centred near the middle; else candidates fromStart (gap past the stop before), fromEnd, and fromOpening for every other opening on the wall before or after the cursor (F-0068 Also: links made silently); the nearest clear reference wins (else the least overlap); distance stored as base + stepped gap
- 126-149 openingTransition: hover → aiming with the rule; escape → idle; click → place (rejected when idle); typed (≥ 0) → a distance rule from base + d, or from the nearer wall end for a centred preview (F-0042 Also)

## Contracts, state and data flow
- Pure. The stored distance of fromStart/fromEnd is a station from the reference end (stop base included); fromOpening's is the gap to the jamb.
- Every placed opening's position depends on what was nearest the pointer: a wall end, a stop or another opening.

## Depends on / used by
- uses: elements/opening/schema (rule types), elements/wall/schema (WallId), app/wall-stops
- used by: app/app.ts (openingTransition, OPENING_IDLE), app/opening-ui.ts (Aim, ruleBase), app/chrome.ts (ruleBase for the hint text), app/select-drag.ts (ruleAt while dragging an opening)

## Problems found (finding IDs)
- F-0068 (Also): ruleAt makes fromOpening links silently
- F-0042 (Also): a fourth meaning of the typed distance (centred preview)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Constraint_(computer-aided_design) : constraints are limits a designer sets; systems that add constraints automatically when entities are placed near one another can produce unexpected results (lines 100-124, F-0068)
