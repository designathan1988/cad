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

import { MIN_WALL_LENGTH, POINT_TOLERANCE } from '../core/tolerance';
import { add, distance, normalize, type Point2, scale, sub, vec } from '../core/vector';

export type WallToolState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'drawing';
      readonly start: Point2;
      readonly last: Point2;
      /** Where the cursor is, already snapped: the preview runs last → cursor. */
      readonly cursor: Point2;
      readonly count: number;
    };

export type WallToolEvent =
  | { readonly kind: 'move'; readonly point: Point2 }
  | { readonly kind: 'click'; readonly point: Point2 }
  | { readonly kind: 'typed'; readonly length: number; readonly angle: number | null }
  | { readonly kind: 'enter' }
  | { readonly kind: 'escape' };

export interface WallToolResult {
  readonly state: WallToolState;
  /** A wall to create, in drawing order. */
  readonly segment?: { readonly start: Point2; readonly end: Point2 };
  /** The event did nothing useful (a zero-length click, a zero typed length). */
  readonly rejected?: boolean;
}

export const IDLE: WallToolState = { kind: 'idle' };

export function wallTransition(state: WallToolState, event: WallToolEvent): WallToolResult {
  if (state.kind === 'idle') {
    if (event.kind === 'click') return { state: { kind: 'drawing', start: event.point, last: event.point, cursor: event.point, count: 0 } };
    return { state, rejected: event.kind === 'typed' };
  }
  switch (event.kind) {
    case 'move':
      return { state: { ...state, cursor: event.point } };
    case 'click': {
      if (distance(event.point, state.last) < MIN_WALL_LENGTH) return { state, rejected: true };
      const segment = { start: state.last, end: event.point };
      const closes = state.count >= 2 && distance(event.point, state.start) <= POINT_TOLERANCE;
      if (closes) return { state: IDLE, segment: { start: state.last, end: state.start } };
      return { state: { ...state, last: event.point, cursor: event.point, count: state.count + 1 }, segment };
    }
    case 'typed': {
      if (!(event.length >= MIN_WALL_LENGTH)) return { state, rejected: true };
      const toward = sub(state.cursor, state.last);
      const dir =
        event.angle !== null
          ? vec(Math.cos((event.angle * Math.PI) / 180), Math.sin((event.angle * Math.PI) / 180))
          : distance(state.cursor, state.last) > 0
            ? normalize(toward)
            : vec(1, 0);
      const end = add(state.last, scale(dir, event.length));
      return {
        state: { ...state, last: end, cursor: end, count: state.count + 1 },
        segment: { start: state.last, end },
      };
    }
    case 'enter':
    case 'escape':
      return { state: IDLE };
  }
}
