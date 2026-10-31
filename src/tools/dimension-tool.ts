// The dimension tool: two points, then where its line goes; the dimension is kept, held by what the
// points were put on (elements/dimension/anchor.ts). A fourth click starts the next one.
//
// | state      | event   | next       | effect                                  |
// |------------|---------|------------|-----------------------------------------|
// | idle       | click p | from p     | its first end                           |
// | from a     | click p | placing a–p| its second end (p not a)                |
// | placing    | click p | idle       | the dimension is made, its line through p |
// | from       | escape  | idle       | dropped                                 |
// | placing    | escape  | from a     | the second end taken back               |
// | idle       | escape  | idle       | (the app leaves the tool)               |

import { distance, type Point2 } from '../model/vector';

export type DimensionToolState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'from'; readonly a: Point2 }
  | { readonly kind: 'placing'; readonly a: Point2; readonly b: Point2 };

export type DimensionToolEvent = { readonly kind: 'click'; readonly point: Point2 } | { readonly kind: 'escape' };

export const DIMENSION_IDLE: DimensionToolState = { kind: 'idle' };

/** Two ends closer than this (m) measure nothing. */
const TOO_SHORT = 1e-4;

/** The next state, and the dimension to make (its ends and the point its line goes through), if any. */
export function dimensionTransition(
  state: DimensionToolState,
  event: DimensionToolEvent,
): { state: DimensionToolState; make?: { a: Point2; b: Point2; through: Point2 } } {
  if (event.kind === 'escape') return { state: state.kind === 'placing' ? { kind: 'from', a: state.a } : DIMENSION_IDLE };
  const p = event.point;
  if (state.kind === 'idle') return { state: { kind: 'from', a: p } };
  if (state.kind === 'from') return distance(state.a, p) < TOO_SHORT ? { state } : { state: { kind: 'placing', a: state.a, b: p } };
  return { state: DIMENSION_IDLE, make: { a: state.a, b: state.b, through: p } };
}
