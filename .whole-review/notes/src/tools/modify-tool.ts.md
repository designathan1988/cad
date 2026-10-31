# src/tools/modify-tool.ts
Lines: 134
Summary: The Modify tools (move, copy, rotate, scale, mirror, offset) as a pure state machine with a written table: points picked (snapped by the caller) or a typed value give one Transform from tools/transform.ts for the selection. Offset takes no base: one click or a typed distance across the selected wall's line. Esc steps back a point; at the first, the app leaves the tool. Also the preview transform for the pointer.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-19 header: the table per tool (clicks and typed meaning), offset without base, Esc steps back, typed before a base refused
- 21-23 imports: MIN_WALL_LENGTH, vector helpers, transform constructors
- 25-28 ModifyKind and OffsetLine (the straight wall measured across)
- 30-35 ModifyState (base, second with base, third with base and ref) and ModifyEvent (click, typed, escape)
- 37-47 ModifyResult (state, apply, leave, rejected) and MODIFY_START
- 49-52 threePoints (rotate, scale) and angleOf (atan2)
- 54-59 across: the line's left unit normal and p's signed distance from it
- 61-84 previewTransform: offset → translation across when ≥ MIN_WALL_LENGTH; move/copy → translation to the cursor (no length check, F-0104); mirror → reflection when the axis is long enough; rotate → angle between ref and cursor about base; scale → projection on the reference direction / its length, when > 1e-6
- 86-98 modifyTransition for offset: escape leaves; no line rejected; click → preview or rejected; typed → positive value to the pointer's side (left without one)
- 99-103 escape: third → second, second → start, start → leave
- 104-112 click: base taken; second of rotate/scale → ref unless too near; else the preview applied (start again) or rejected
- 113-133 typed after a base: move/copy toward the pointer (or +x) by v > 0; rotate by v degrees ≠ 0; scale by v > 0; mirror about the axis at v degrees through base

## Contracts, state and data flow
- Pure. The caller snaps points, applies `apply` with transformSelection and handles `leave`/`rejected` (modify-ui.ts:60-95).

## Depends on / used by
- uses: core/tolerance, core/vector, tools/transform (reflection, rotation, scaling, translation)
- used by: app/modify-ui.ts (modifyTransition, previewTransform, MODIFY_START), app/app.ts:441-447 (the preview doc while moving)

## Problems found (finding IDs)
- F-0104 (S3): a zero copy step duplicates the selection in place

## To check in other files
- src/tools/transform.ts: transformSelection with copy

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/atan2 : range −π..π, atan2(0,0) = 0 (lines 52, 76: an angle difference may exceed ±π, which rotation handles as the same turn)
