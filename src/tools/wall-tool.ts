// The wall tool as a state machine with a written table and a pure transition.
//
// | state   | event                | next    | effect                                 |
// |---------|----------------------|---------|----------------------------------------|
// | idle    | click p              | drawing | chain starts at p                      |
// | drawing | move p               | drawing | preview from last point to p           |
// | drawing | click p (≠ last)     | drawing | wall last→p; p becomes last            |
// | drawing | click chain start    | idle    | wall last→start; outline closed        |
// | drawing | typed length[<angle] | drawing | wall of that length, along the cursor  |
// |         |                      |         | direction or the typed angle           |
// | drawing | enter                | idle    | chain ends, walls stay                 |
// | drawing | escape               | idle    | the segment in progress is dropped     |
// | idle    | escape               | idle    | (the app leaves the tool)              |
// | any     | arc (A)              | same    | arc mode on or off for the next walls  |
// | drawing | click p, arc mode    | bend    | the chord last→p is fixed              |
// | bend    | move p               | bend    | the arc through last, p and the cursor |
// | bend    | click p              | drawing | arc wall last→end through p            |
// | bend    | typed radius r       | drawing | arc of radius r, bulging to the cursor |
// | bend    | escape               | drawing | the chord is dropped                   |

import { MIN_WALL_LENGTH, POINT_TOLERANCE } from '../core/tolerance';
import { add, cross, distance, dot, normalize, type Point2, scale, sub, vec } from '../core/vector';

export type WallToolState =
  | { readonly kind: 'idle'; readonly arc?: boolean }
  | {
      readonly kind: 'drawing';
      readonly start: Point2;
      readonly last: Point2;
      /** Where the cursor is, already snapped: the preview runs last → cursor. */
      readonly cursor: Point2;
      readonly count: number;
      readonly arc?: boolean;
    }
  | {
      /** Arc mode, chord fixed: the cursor bends the arc from `last` to `end`. */
      readonly kind: 'bend';
      readonly start: Point2;
      readonly last: Point2;
      readonly end: Point2;
      readonly cursor: Point2;
      readonly count: number;
      readonly arc: true;
    };

export type WallToolEvent =
  | { readonly kind: 'move'; readonly point: Point2 }
  | { readonly kind: 'click'; readonly point: Point2 }
  | { readonly kind: 'typed'; readonly length: number; readonly angle: number | null }
  | { readonly kind: 'typedRadius'; readonly radius: number }
  | { readonly kind: 'arc' }
  | { readonly kind: 'enter' }
  | { readonly kind: 'escape' };

export interface WallToolResult {
  readonly state: WallToolState;
  /** A wall to create, in drawing order. */
  readonly segment?: { readonly start: Point2; readonly end: Point2; readonly bulge?: number };
  /** The event did nothing useful (a zero-length click, a zero typed length). */
  readonly rejected?: boolean;
}

export const IDLE: WallToolState = { kind: 'idle' };

export function wallTransition(state: WallToolState, event: WallToolEvent): WallToolResult {
  if (event.kind === 'arc') {
    if (state.kind === 'bend') return { state: { ...state, kind: 'drawing', cursor: state.end, arc: false } };
    return { state: { ...state, arc: !state.arc } };
  }
  if (state.kind === 'idle') {
    if (event.kind === 'click') {
      return { state: { kind: 'drawing', start: event.point, last: event.point, cursor: event.point, count: 0, arc: state.arc ?? false } };
    }
    return { state, rejected: event.kind === 'typed' || event.kind === 'typedRadius' };
  }
  if (state.kind === 'bend') return bendTransition(state, event);
  switch (event.kind) {
    case 'move':
      return { state: { ...state, cursor: event.point } };
    case 'click': {
      if (distance(event.point, state.last) < MIN_WALL_LENGTH) return { state, rejected: true };
      if (state.arc) {
        const end = state.count >= 2 && distance(event.point, state.start) <= POINT_TOLERANCE ? state.start : event.point;
        return { state: { kind: 'bend', start: state.start, last: state.last, end, cursor: event.point, count: state.count, arc: true } };
      }
      const segment = { start: state.last, end: event.point };
      const closes = state.count >= 2 && distance(event.point, state.start) <= POINT_TOLERANCE;
      if (closes) return { state: IDLE, segment: { start: state.last, end: state.start } };
      return { state: { ...state, last: event.point, cursor: event.point, count: state.count + 1 }, segment };
    }
    case 'typed': {
      if (!(event.length >= MIN_WALL_LENGTH)) return { state, rejected: true };
      const end = typedEnd(state, event.length, event.angle);
      if (state.arc) return { state: { kind: 'bend', start: state.start, last: state.last, end, cursor: end, count: state.count, arc: true } };
      return {
        state: { ...state, last: end, cursor: end, count: state.count + 1 },
        segment: { start: state.last, end },
      };
    }
    case 'typedRadius':
      return { state, rejected: true };
    case 'enter':
    case 'escape':
      return { state: state.arc ? { kind: 'idle', arc: true } : IDLE };
  }
}

function bendTransition(state: Extract<WallToolState, { kind: 'bend' }>, event: WallToolEvent): WallToolResult {
  const done = (bulge: number): WallToolResult => {
    const segment = { start: state.last, end: state.end, bulge };
    const closes = distance(state.end, state.start) <= POINT_TOLERANCE && state.count >= 1;
    if (closes) return { state: { kind: 'idle', arc: true }, segment };
    return { state: { kind: 'drawing', start: state.start, last: state.end, cursor: state.end, count: state.count + 1, arc: true }, segment };
  };
  switch (event.kind) {
    case 'move':
      return { state: { ...state, cursor: event.point } };
    case 'click': {
      const b = bulgeThrough(state.last, state.end, event.point);
      return b === null ? { state, rejected: true } : done(b);
    }
    case 'typedRadius': {
      const b = bulgeForRadius(state.last, state.end, event.radius, state.cursor);
      return b === null ? { state, rejected: true } : done(b);
    }
    case 'typed':
      return { state, rejected: true };
    case 'escape':
      return { state: { kind: 'drawing', start: state.start, last: state.last, cursor: state.last, count: state.count, arc: true } };
    case 'enter':
      return { state: { kind: 'idle', arc: true } };
  }
  return { state, rejected: true };
}

/**
 * Where a typed length (and angle, counter-clockwise from +x, in degrees) ends the segment: along the
 * angle, or toward the cursor when no angle is typed.
 */
export function typedEnd(state: { readonly last: Point2; readonly cursor: Point2 }, length: number, angle: number | null): Point2 {
  const dir =
    angle !== null
      ? vec(Math.cos((angle * Math.PI) / 180), Math.sin((angle * Math.PI) / 180))
      : distance(state.cursor, state.last) > 0
        ? normalize(sub(state.cursor, state.last))
        : vec(1, 0);
  return add(state.last, scale(dir, length));
}

/**
 * The bulge of the arc from a to b through c: the inscribed angle at c is π − θ/2. Positive bulges
 * run counter-clockwise and lie to the right of a→b. Null when c is on the chord's line.
 */
export function bulgeThrough(a: Point2, b: Point2, c: Point2): number | null {
  const ca = sub(a, c);
  const cb = sub(b, c);
  const side = cross(sub(b, a), sub(c, a));
  if (Math.abs(side) < 1e-12 || distance(a, b) < MIN_WALL_LENGTH) return null;
  const atC = Math.atan2(Math.abs(cross(ca, cb)), dot(ca, cb));
  const quarter = (Math.PI - atC) / 2;
  return (side < 0 ? 1 : -1) * Math.tan(quarter);
}

/** The bulge of the shorter arc of radius r from a to b, on the side of `toward`. Null if r is too small. */
export function bulgeForRadius(a: Point2, b: Point2, r: number, toward: Point2): number | null {
  const c = distance(a, b);
  if (!(r >= c / 2) || c < MIN_WALL_LENGTH) return null;
  const sweep = 2 * Math.asin(c / (2 * r));
  const side = cross(sub(b, a), sub(toward, a));
  return (side < 0 ? 1 : -1) * Math.tan(sweep / 4);
}
