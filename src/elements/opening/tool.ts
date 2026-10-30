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
// |        |                    |        | nearer end when the preview is centred; the start |
// |        |                    |        | at the very middle)                               |
// | idle   | click, typed       | idle   | rejected: no wall under the cursor                |
// | any    | escape             | idle   | (the app leaves the tool when already idle)       |
//
// The rule under the cursor: within 10 px of the wall's middle it is centred; otherwise the nearest
// reference wins (the wall's start, its end, or the jamb of a neighbouring opening), measured to the
// nearest jamb in 5 cm steps; a reference the opening would overlap counts only when none is clear.
// The start and the end are measured from the nearest face of a wall meeting this one on that side
// (a stop), when there is one: the gap to it goes in 5 cm steps and a typed distance is that gap.

import { type DistanceRule, hasDistance, type OpeningId, type PositionRule } from './schema';
import type { WallId } from '../wall/schema';
import { stopAfter, stopBefore } from '../wall/stops';

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
  /** Stations of the faces of the walls meeting this one (sorted): what the ends are measured from. */
  readonly stops?: readonly number[];
  /** Where those walls stand across this one: from one face to the other, no room for an opening. */
  readonly occupied?: readonly (readonly [number, number])[];
}

/**
 * The aim with the opening fitted where it can stand: in the free stretch of the wall (between its
 * ends and the walls meeting it) nearest the cursor where it is wide enough, against the stretch's
 * end when the cursor is past it. Taken at a wall's end, or over a wall crossing it, an opening was
 * left half out of its wall ("does not fit in the wall"), dragged or placed.
 */
export function fitAim(aim: Aim, width: number): Aim {
  const bounds = [0, ...(aim.stops ?? []).filter((s) => s > 0 && s < aim.length), aim.length].sort((a, b) => a - b);
  let best: number | null = null;
  for (let i = 0; i + 1 < bounds.length; i++) {
    const a = bounds[i]!;
    const b = bounds[i + 1]!;
    const mid = (a + b) / 2;
    if (b - a < width - 1e-9 || (aim.occupied ?? []).some(([x, y]) => mid > x && mid < y)) continue;
    const s = Math.min(Math.max(aim.station, a + width / 2), b - width / 2);
    if (best === null || Math.abs(s - aim.station) < Math.abs(best - aim.station)) best = s;
  }
  return best === null || best === aim.station ? aim : { ...aim, station: best };
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

/**
 * What a start or end rule is measured from, as its own distance: the station of the stop before the
 * opening for `fromStart`, the length past the stop after it for `fromEnd` (0 at the wall's ends).
 * The gap shown and typed is the rule's distance less this.
 */
export function ruleBase(aim: Pick<Aim, 'length' | 'stops'>, rule: PositionRule): number {
  const stops = aim.stops ?? [];
  if (rule.kind === 'fromStart') return stopBefore(stops, rule.distance);
  if (rule.kind === 'fromEnd') return aim.length - stopAfter(stops, aim.length - rule.distance, aim.length);
  return 0;
}

export function ruleAt(taken: Aim, width: number): PositionRule {
  const aim = fitAim(taken, width);
  if (Math.abs(aim.station - aim.length / 2) <= CENTRE_PX * aim.mpp) return { kind: 'centered' };
  const lo = aim.station - width / 2;
  const hi = aim.station + width / 2;
  const stops = aim.stops ?? [];
  // Start and end: the gap to the nearest stop on that side (the wall's end when none).
  const before = stopBefore(stops, lo);
  const after = stopAfter(stops, hi, aim.length);
  const candidates: { rule: DistanceRule; base: number }[] = [
    { rule: { kind: 'fromStart', distance: lo - before }, base: before },
    { rule: { kind: 'fromEnd', distance: after - hi }, base: aim.length - after },
  ];
  for (const o of aim.others) {
    if (o.end <= aim.station) candidates.push({ rule: { kind: 'fromOpening', openingId: o.id, distance: lo - o.end, toward: 'end' }, base: 0 });
    else if (o.start >= aim.station) candidates.push({ rule: { kind: 'fromOpening', openingId: o.id, distance: o.start - hi, toward: 'start' }, base: 0 });
  }
  // A reference the opening clears (distance ≥ 0) beats one it would overlap, however near.
  const rank = (r: { distance: number }) => (r.distance >= 0 ? r.distance : Infinity);
  const clear = candidates.some((c) => c.rule.distance >= 0);
  const best = candidates.reduce((a, b) =>
    (clear ? rank(b.rule) < rank(a.rule) : Math.abs(b.rule.distance) < Math.abs(a.rule.distance)) ? b : a,
  );
  return { ...best.rule, distance: best.base + step(best.rule.distance) };
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
      // From the same reference the preview is measured from: for the start and the end, past the stop.
      const rule: PositionRule = hasDistance(r)
        ? { ...r, distance: ruleBase(state.aim, r) + d }
        : // The nearer end; at the very middle (an aim from the keyboard) the start, as reading goes.
          state.aim.station <= state.aim.length / 2
          ? { kind: 'fromStart', distance: d }
          : { kind: 'fromEnd', distance: d };
      return { state, place: { wallId: state.aim.wallId, rule, swing: state.aim.side } };
    }
  }
}
