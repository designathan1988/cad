// Snaps for drawing: the cursor jumps to what the user most likely means. Distances are in screen
// pixels (converted by the caller's metres-per-pixel), so snapping feels the same at any zoom.

import { add, distance, dot, normalize, type Point2, scale, sub, vec } from '../core/vector';
import type { MessageKey } from '../ui/i18n';

export type SnapKind = 'endpoint' | 'start' | 'midpoint' | 'onWall' | 'aligned' | 'angle' | 'grid' | 'none';

export interface Snap {
  readonly point: Point2;
  readonly kind: SnapKind;
  /** Dashed guide from another point to the snapped one (alignment). */
  readonly guideFrom?: Point2;
}

export interface SnapInput {
  readonly cursor: Point2;
  /** Metres per screen pixel at the cursor. */
  readonly mpp: number;
  readonly segments: readonly { readonly start: Point2; readonly end: Point2 }[];
  /** The point being drawn from, if any. */
  readonly from: Point2 | null;
  /** The first point of the chain: clicking it closes the outline. */
  readonly chainStart: Point2 | null;
  readonly enabled: boolean;
  /** Shift: only right angles from `from`. */
  readonly orthogonal: boolean;
}

export const GRID_STEP = 0.05;
const RADIUS_PX = 10;
const ANGLE_STEP = 15;
const ANGLE_TOL_DEG = 3;

export const snapLabel: Readonly<Record<SnapKind, MessageKey | null>> = {
  endpoint: 'snap.endpoint',
  start: 'snap.start',
  midpoint: 'snap.midpoint',
  onWall: 'snap.onWall',
  aligned: 'snap.alignedX',
  angle: null,
  grid: null,
  none: null,
};

export function snap(input: SnapInput): Snap {
  const { cursor, mpp, from } = input;
  if (from && input.orthogonal) return orthogonal(cursor, from, input.enabled);
  if (!input.enabled) return { point: cursor, kind: 'none' };
  const r = RADIUS_PX * mpp;

  if (input.chainStart && from && distance(cursor, input.chainStart) <= r) return { point: input.chainStart, kind: 'start' };
  const ends = input.segments.flatMap((s) => [s.start, s.end]);
  const nearEnd = closest(ends, cursor, r);
  if (nearEnd) return { point: nearEnd, kind: 'endpoint' };
  const mids = input.segments.map((s) => scale(add(s.start, s.end), 0.5));
  const nearMid = closest(mids, cursor, r);
  if (nearMid) return { point: nearMid, kind: 'midpoint' };

  // Angle from the last point in 15° steps, with the length on the 5 cm grid.
  let best: Snap | null = null;
  if (from && distance(cursor, from) > r) {
    const d = sub(cursor, from);
    const deg = (Math.atan2(d.y, d.x) * 180) / Math.PI;
    const snapped = Math.round(deg / ANGLE_STEP) * ANGLE_STEP;
    if (Math.abs(deg - snapped) <= ANGLE_TOL_DEG) {
      const u = vec(Math.cos((snapped * Math.PI) / 180), Math.sin((snapped * Math.PI) / 180));
      const len = Math.max(GRID_STEP, Math.round(dot(d, u) / GRID_STEP) * GRID_STEP);
      best = { point: add(from, scale(u, len)), kind: 'angle' };
    }
  }

  // Aligned with another wall end, horizontally or vertically, within the radius.
  for (const e of [...ends, ...(input.chainStart ? [input.chainStart] : [])]) {
    const base = best?.point ?? cursor;
    if (Math.abs(base.x - e.x) <= r && distance(e, cursor) > r) return { point: vec(e.x, base.y), kind: 'aligned', guideFrom: e };
    if (Math.abs(base.y - e.y) <= r && distance(e, cursor) > r) return { point: vec(base.x, e.y), kind: 'aligned', guideFrom: e };
  }
  if (best) return best;

  for (const s of input.segments) {
    const p = projectOnSegment(cursor, s.start, s.end);
    if (p && distance(p, cursor) <= r) return { point: p, kind: 'onWall' };
  }
  return { point: onGrid(cursor), kind: 'grid' };
}

function orthogonal(cursor: Point2, from: Point2, grid: boolean): Snap {
  const d = sub(cursor, from);
  const u = Math.abs(d.x) >= Math.abs(d.y) ? vec(Math.sign(d.x) || 1, 0) : vec(0, Math.sign(d.y) || 1);
  const raw = dot(d, u);
  const len = grid ? Math.round(raw / GRID_STEP) * GRID_STEP : raw;
  return { point: add(from, scale(u, len)), kind: 'angle' };
}

export const onGrid = (p: Point2): Point2 =>
  vec(Math.round(p.x / GRID_STEP) * GRID_STEP, Math.round(p.y / GRID_STEP) * GRID_STEP);

function closest(points: readonly Point2[], p: Point2, r: number): Point2 | null {
  let best: Point2 | null = null;
  let bestD = r;
  for (const q of points) {
    const d = distance(p, q);
    if (d <= bestD) {
      best = q;
      bestD = d;
    }
  }
  return best;
}

function projectOnSegment(p: Point2, a: Point2, b: Point2): Point2 | null {
  const len = distance(a, b);
  if (len === 0) return null;
  const u = normalize(sub(b, a));
  const t = dot(sub(p, a), u);
  return t > 0 && t < len ? add(a, scale(u, t)) : null;
}
