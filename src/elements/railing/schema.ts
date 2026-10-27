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
  /**
   * Round a stair's well, on the floor it reaches: its path follows the well (all but the side the
   * stair arrives at), the stored `points` being only what it had last.
   */
  readonly host?: { readonly stairId: string };
}

export const isRailingId = (id: string): boolean => id.startsWith(`${RAILING_PREFIX}_`);

export const railingLength = (r: { readonly points: readonly Point2[] }): number => r.points.slice(1).reduce((s, p, i) => s + distance(r.points[i]!, p), 0);

/**
 * The path round a stair's well (counter-clockwise), open where the stair arrives: the top step's edge
 * a–b, on the side of the well nearest to it. The rest of that side is guarded too: in a U the other
 * half of it is over the first flight's start, a drop.
 */
export function wellPath(well: readonly Point2[], a: Point2, b: Point2): Point2[] {
  const n = well.length;
  if (n < 3) return [];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const along = (p: Point2, q: Point2, v: Point2) => {
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    return ((v.x - p.x) * dx + (v.y - p.y) * dy) / (dx * dx + dy * dy || 1);
  };
  const off = (p: Point2, q: Point2, v: Point2) => {
    const t = Math.max(0, Math.min(1, along(p, q, v)));
    return Math.hypot(v.x - (p.x + (q.x - p.x) * t), v.y - (p.y + (q.y - p.y) * t));
  };
  let k = 0;
  for (let i = 1; i < n; i++) if (off(well[i]!, well[(i + 1) % n]!, mid) < off(well[k]!, well[(k + 1) % n]!, mid)) k = i;
  const p = well[k]!;
  const q = well[(k + 1) % n]!;
  const at = (t: number) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const [t0, t1] = [along(p, q, a), along(p, q, b)].map((t) => Math.max(0, Math.min(1, t))).sort((x, y) => x - y) as [number, number];
  const eps = 1e-6;
  // From the open stretch's end to q, round the well, back to p and on to the stretch's start.
  return [
    ...(t1 < 1 - eps ? [at(t1)] : []),
    ...Array.from({ length: n }, (_, j) => well[(k + 1 + j) % n]!),
    ...(t0 > eps ? [at(t0)] : []),
  ];
}

/** Where its posts stand: its corners, and between them as evenly as POST_SPACING allows. */
export function postsOf(r: { readonly points: readonly Point2[] }): Point2[] {
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
