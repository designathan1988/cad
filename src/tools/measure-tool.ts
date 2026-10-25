// The measure tool (a tape): two points give a distance, with its run along each axis and its angle.
// Nothing is added to the drawing. A third click starts the next measurement.
//
// | state    | event   | next     | effect                                      |
// |----------|---------|----------|---------------------------------------------|
// | idle     | click p | from p   | the tape starts at p                        |
// | from a   | click p | done a–p | the measurement stays on screen             |
// | done     | click p | from p   | a new tape from p                           |
// | from     | escape  | idle     | the tape is dropped                         |
// | done     | escape  | idle     | the measurement is cleared                  |
// | idle     | escape  | idle     | (the app leaves the tool)                   |

import { distance, type Point2 } from '../core/vector';

export type MeasureState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'from'; readonly a: Point2 }
  | { readonly kind: 'done'; readonly a: Point2; readonly b: Point2 };

export type MeasureEvent = { readonly kind: 'click'; readonly point: Point2 } | { readonly kind: 'escape' };

export const MEASURE_IDLE: MeasureState = { kind: 'idle' };

export function measureTransition(state: MeasureState, event: MeasureEvent): MeasureState {
  if (event.kind === 'escape') return MEASURE_IDLE;
  return state.kind === 'from' ? { kind: 'done', a: state.a, b: event.point } : { kind: 'from', a: event.point };
}

/** What a tape from a to b reads: its length, its run along x and y, and its angle (0–360°, from +x). */
export function reading(a: Point2, b: Point2): { length: number; dx: number; dy: number; angle: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  return { length: distance(a, b), dx, dy, angle };
}
