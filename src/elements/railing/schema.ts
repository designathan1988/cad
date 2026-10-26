// Guardrails (ref/chat.txt:92, 137): along a path on a level (a balcony's edge, a slab's, a void's), a
// top rail at its height, a mid rail, and posts at its corners and at most POST_SPACING apart. A stair's
// and a ramp's handrails are their own (elements/stair).

import { distance, type Point2 } from '../../core/vector';

export const RAILING_PREFIX = 'railing';
/** A guardrail's height (m): 1.10 m, as NBR 9077 asks of a balcony's. */
export const RAILING_HEIGHT = 1.1;
/** Posts at most this far apart (m). */
export const POST_SPACING = 1.2;

export interface Railing {
  readonly id: string;
  readonly levelId: string;
  /** Its path, two points or more. */
  readonly points: readonly Point2[];
  readonly height: number;
  /** Its foot above (+) or below (−) its level's floor (m): on a slab's edge, a terrace's. */
  readonly baseOffset: number;
}

export const isRailingId = (id: string): boolean => id.startsWith(`${RAILING_PREFIX}_`);

export const railingLength = (r: Railing): number => r.points.slice(1).reduce((s, p, i) => s + distance(r.points[i]!, p), 0);

/** Where its posts stand: its corners, and between them as evenly as POST_SPACING allows. */
export function postsOf(r: Railing): Point2[] {
  const out: Point2[] = [];
  for (let i = 0; i + 1 < r.points.length; i++) {
    const a = r.points[i]!;
    const b = r.points[i + 1]!;
    const n = Math.max(1, Math.ceil(distance(a, b) / POST_SPACING));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  if (r.points.length > 0) out.push(r.points.at(-1)!);
  return out;
}
