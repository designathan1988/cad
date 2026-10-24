// The door and window tool as a state machine with a written table and a pure transition. The tool
// never stores a coordinate: what it places is a rule, read from where the cursor is on the wall.
//
// | state  | event              | next   | effect                                            |
// |--------|--------------------|--------|---------------------------------------------------|
// | idle   | hover over a wall  | aiming | live preview with the rule under the cursor       |
// | aiming | hover over a wall  | aiming | the preview follows                               |
// | aiming | hover off the walls| idle   | no preview                                        |
// | aiming | click              | aiming | opening placed with that rule; the tool stays     |
// | aiming | typed distance d   | aiming | placed at d from the same reference (from the     |
// |        |                    |        | nearer end when the preview is centred)           |
// | idle   | click, typed       | idle   | rejected: no wall under the cursor                |
// | any    | escape             | idle   | (the app leaves the tool when already idle)       |
//
// The rule under the cursor: within 10 px of the wall's middle it is centred; otherwise the nearest
// reference wins (the wall's start, its end, or the jamb of a neighbouring opening), measured to the
// nearest jamb in 5 cm steps; a reference the opening would overlap counts only when none is clear.

import { type DistanceRule, hasDistance, type OpeningId, type PositionRule } from '../elements/opening/schema';
import type { WallId } from '../elements/wall/schema';

export const OPENING_STEP = 0.05;
const CENTRE_PX = 10;

/** The wall under the cursor, as the tool needs it. */
export interface Aim {
  readonly wallId: WallId;
  /** Length of the wall's reference line. */
  readonly length: number;
  /** Station of the cursor along the reference line: where the opening's centre goes. */
  readonly station: number;
  /** Side of the reference line the cursor is on: where a door opens to. */
  readonly side: 'left' | 'right';
  /** The other openings on this wall, as jamb stations. */
  readonly others: readonly { readonly id: OpeningId; readonly start: number; readonly end: number }[];
  /** Metres per screen pixel. */
  readonly mpp: number;
}

export type OpeningToolState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'aiming'; readonly aim: Aim; readonly rule: PositionRule };

export type OpeningToolEvent =
  | { readonly kind: 'hover'; readonly aim: Aim | null }
  | { readonly kind: 'click' }
  | { readonly kind: 'typed'; readonly distance: number }
  | { readonly kind: 'escape' };

export interface OpeningToolResult {
  readonly state: OpeningToolState;
  readonly place?: { readonly wallId: WallId; readonly rule: PositionRule; readonly swing: 'left' | 'right' };
  readonly rejected?: boolean;
}

export const OPENING_IDLE: OpeningToolState = { kind: 'idle' };

const step = (d: number): number => Math.round(d / OPENING_STEP) * OPENING_STEP;

export function ruleAt(aim: Aim, width: number): PositionRule {
  if (Math.abs(aim.station - aim.length / 2) <= CENTRE_PX * aim.mpp) return { kind: 'centered' };
  const lo = aim.station - width / 2;
  const hi = aim.station + width / 2;
  const candidates: DistanceRule[] = [
    { kind: 'fromStart', distance: lo },
    { kind: 'fromEnd', distance: aim.length - hi },
  ];
  for (const o of aim.others) {
    if (o.end <= aim.station) candidates.push({ kind: 'fromOpening', openingId: o.id, distance: lo - o.end, toward: 'end' });
    else if (o.start >= aim.station) candidates.push({ kind: 'fromOpening', openingId: o.id, distance: o.start - hi, toward: 'start' });
  }
  // A reference the opening clears (distance ≥ 0) beats one it would overlap, however near.
  const rank = (r: { distance: number }) => (r.distance >= 0 ? r.distance : Infinity);
  const clear = candidates.some((r) => r.distance >= 0);
  const best = candidates.reduce((a, b) => (clear ? rank(b) < rank(a) : Math.abs(b.distance) < Math.abs(a.distance)) ? b : a);
  return { ...best, distance: step(best.distance) };
}

export function openingTransition(state: OpeningToolState, event: OpeningToolEvent, width: number): OpeningToolResult {
  switch (event.kind) {
    case 'hover':
      return { state: event.aim ? { kind: 'aiming', aim: event.aim, rule: ruleAt(event.aim, width) } : OPENING_IDLE };
    case 'escape':
      return { state: OPENING_IDLE };
    case 'click':
      if (state.kind === 'idle') return { state, rejected: true };
      return { state, place: { wallId: state.aim.wallId, rule: state.rule, swing: state.aim.side } };
    case 'typed': {
      if (state.kind === 'idle' || !(event.distance >= 0)) return { state, rejected: true };
      const r = state.rule;
      const d = event.distance;
      const rule: PositionRule = hasDistance(r)
        ? { ...r, distance: d }
        : state.aim.station < state.aim.length / 2
          ? { kind: 'fromStart', distance: d }
          : { kind: 'fromEnd', distance: d };
      return { state, place: { wallId: state.aim.wallId, rule, swing: state.aim.side } };
    }
  }
}
