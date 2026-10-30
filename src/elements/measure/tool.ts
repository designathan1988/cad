// The measure tool (a tape): two points give a distance, with its run along each axis and its angle.
// Nothing is added to the drawing. A third click starts the next measurement.
//
// In a chain (C switches, phase 9): each click adds a stretch; it reads their sum, the last one and the
// angle between the last two; clicked on its first point it closes, and reads the area and the
// perimeter; Enter ends it open.
//
// | state    | event   | next     | effect                                      |
// |----------|---------|----------|---------------------------------------------|
// | idle     | click p | from p   | the tape starts at p                        |
// | from a   | click p | done a–p | the measurement stays on screen             |
// | done     | click p | from p   | a new tape from p                           |
// | from     | escape  | idle     | the tape is dropped                         |
// | done     | escape  | idle     | the measurement is cleared                  |
// | idle     | escape  | idle     | (the app leaves the tool)                   |

import { distance, signedTwiceArea, type Point2 } from '../../model/vector';

export type MeasureState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'from'; readonly a: Point2 }
  | { readonly kind: 'done'; readonly a: Point2; readonly b: Point2 }
  | { readonly kind: 'chain'; readonly points: readonly Point2[] }
  | { readonly kind: 'chainDone'; readonly points: readonly Point2[]; readonly closed: boolean };

export type MeasureEvent = { readonly kind: 'click'; readonly point: Point2 } | { readonly kind: 'enter' } | { readonly kind: 'escape' };

export type MeasureMode = 'distance' | 'chain';

export const MEASURE_IDLE: MeasureState = { kind: 'idle' };

export function measureTransition(state: MeasureState, event: MeasureEvent, mode: MeasureMode = 'distance'): MeasureState {
  if (event.kind === 'escape') return MEASURE_IDLE;
  if (event.kind === 'enter') return state.kind === 'chain' && state.points.length >= 2 ? { kind: 'chainDone', points: state.points, closed: false } : state;
  if (mode === 'chain') {
    if (state.kind !== 'chain') return { kind: 'chain', points: [event.point] };
    const first = state.points[0]!;
    // Back on its first point, three corners or more: closed, an area.
    if (state.points.length >= 3 && distance(first, event.point) < 1e-9) return { kind: 'chainDone', points: state.points, closed: true };
    // The same point twice adds nothing.
    if (distance(state.points.at(-1)!, event.point) < 1e-9) return state;
    return { kind: 'chain', points: [...state.points, event.point] };
  }
  return state.kind === 'from' ? { kind: 'done', a: state.a, b: event.point } : { kind: 'from', a: event.point };
}

/** A chain's sum of stretches, open or closed back to its first point. */
export function chainLength(points: readonly Point2[], closed: boolean): number {
  const run = points.slice(1).reduce((t, p, i) => t + distance(points[i]!, p), 0);
  return closed && points.length >= 3 ? run + distance(points.at(-1)!, points[0]!) : run;
}

/** The area inside a closed chain (m²), whatever way round it goes. */
export const chainArea = (points: readonly Point2[]): number => Math.abs(signedTwiceArea(points)) / 2;

/** The angle at b between the stretches to a and to c (0–180°); null when one has no length. */
export function angleAt(a: Point2, b: Point2, c: Point2): number | null {
  const u = { x: a.x - b.x, y: a.y - b.y };
  const v = { x: c.x - b.x, y: c.y - b.y };
  const lu = Math.hypot(u.x, u.y);
  const lv = Math.hypot(v.x, v.y);
  if (lu < 1e-9 || lv < 1e-9) return null;
  return (Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / (lu * lv)))) * 180) / Math.PI;
}

/** What a tape from a to b reads: its length, its run along x and y, and its angle (0–360°, from +x). */
export function reading(a: Point2, b: Point2): { length: number; dx: number; dy: number; angle: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  return { length: distance(a, b), dx, dy, angle };
}
