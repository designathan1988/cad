// Room separators (phase 6): a line on a level that bounds rooms where there is no wall (a living room
// open to the kitchen), as Revit's room separation lines. Nothing is built from it: rooms read it as a
// wall of no thickness (room/derive.ts), and the plan draws it thin.

import { add, normalize, perp, type Point2, scale, sub } from '../../core/vector';

export const SEPARATOR_PREFIX = 'sep';

export interface Separator {
  readonly id: string;
  readonly levelId: string;
  readonly start: Point2;
  readonly end: Point2;
}

/** Half the width rooms see it as (m): thin enough to take no area that shows, enough to cut a space in two. */
export const SEPARATOR_HALF = 0.001;

/** The strip rooms see it as, counter-clockwise, a little past each end so it meets a wall's face. */
export function separatorStrip(s: Separator): Point2[] {
  const d = normalize(sub(s.end, s.start));
  const n = scale(perp(d), SEPARATOR_HALF);
  const a = sub(s.start, scale(d, 0.005));
  const b = add(s.end, scale(d, 0.005));
  return [sub(a, n), sub(b, n), add(b, n), add(a, n)];
}
