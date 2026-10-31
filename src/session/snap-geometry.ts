import { add, distance, dot, normalize, type Point2, scale, sub, vec } from '../model/vector';
import type { GuideLine, Snap, SnapInput } from './snap-types';
import { GRID_STEP } from '../model/tolerance';
import { type Arc, pointAt } from '../elements/wall/geometry/arc';

/** Shift: straight across or up from `from`; stopped on a guide it crosses near the cursor. */
export function orthogonal(cursor: Point2, from: Point2, grid: boolean, guides: readonly GuideLine[], r: number): Snap {
  const d = sub(cursor, from);
  const u = Math.abs(d.x) >= Math.abs(d.y) ? vec(Math.sign(d.x) || 1, 0) : vec(0, Math.sign(d.y) || 1);
  const raw = dot(d, u);
  const len = grid ? Math.round(raw / GRID_STEP) * GRID_STEP : raw;
  const point = add(from, scale(u, len));
  for (const g of grid ? guides : []) {
    const p = lineCrossing(from, u, g.point, g.dir);
    if (p && dot(sub(p, from), u) > 0 && Math.abs(dot(sub(p, from), u) - raw) <= r) return { point: p, kind: 'onGuide' };
  }
  return { point, kind: 'angle' };
}

/**
 * Held to a direction from `from`: the pointer's foot on that line, its distance on the 5 cm grid, or
 * where the line crosses a straight wall or a guide within reach of that point.
 */
export function locked(cursor: Point2, from: Point2, dir: Point2, grid: boolean, guides: readonly GuideLine[], segments: SnapInput['segments'], r: number): Snap {
  const raw = dot(sub(cursor, from), dir);
  const point = add(from, scale(dir, grid ? Math.round(raw / GRID_STEP) * GRID_STEP : raw));
  if (grid) {
    const crossings = [
      ...segments.flatMap((s) => {
        if (s.bulge || distance(s.start, s.end) === 0) return [];
        const p = lineCrossing(from, dir, s.start, sub(s.end, s.start));
        return p && dot(sub(p, s.start), sub(p, s.end)) <= 1e-12 ? [p] : [];
      }),
      ...guides.flatMap((g) => lineCrossing(from, dir, g.point, g.dir) ?? []),
    ].filter((p) => Math.abs(dot(sub(p, from), dir) - raw) <= r && distance(p, from) > MIN_SNAP_RUN);
    const near = crossings.sort((a, b) => distance(a, cursor) - distance(b, cursor))[0];
    if (near) return { point: near, kind: 'locked', guideFrom: from };
  }
  return { point, kind: 'locked', guideFrom: from };
}

export const perpOf = (u: Point2): Point2 => vec(-u.y, u.x);

/**
 * The point of the arc at p's angle about its centre, strictly within its sweep; with a step, its
 * length along the arc from the start rounded to it (away from the ends). Null outside the sweep.
 */
export function arcFoot(arc: Arc, p: Point2, step: number): Point2 | null {
  const dir = Math.sign(arc.sweep);
  const span = Math.abs(arc.sweep);
  const a = Math.atan2(p.y - arc.center.y, p.x - arc.center.x);
  const delta = ((((a - arc.startAngle) * dir) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (delta <= 1e-9 || delta >= span - 1e-9) return null;
  let along = delta * arc.radius;
  const len = span * arc.radius;
  if (step > 0 && along > step && along < len - step) along = Math.round(along / step) * step;
  return pointAt(arc, arc.startAngle + (dir * along) / arc.radius);
}

/** Where the line through p along u (unit) cuts the arc's circle: none, one or two points. */
export function circleCrossings(arc: Arc, p: Point2, u: Point2): Point2[] {
  const w = sub(p, arc.center);
  const b = dot(u, w);
  const c = dot(w, w) - arc.radius * arc.radius;
  const disc = b * b - c;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  return [-b - s, -b + s].map((t) => add(p, scale(u, t)));
}

/** Where the line through p along u meets the line through q along v; null when they are parallel. */
export function lineCrossing(p: Point2, u: Point2, q: Point2, v: Point2): Point2 | null {
  const den = u.x * v.y - u.y * v.x;
  if (Math.abs(den) < 1e-9 * Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)) return null;
  const w = sub(q, p);
  return add(p, scale(u, (w.x * v.y - w.y * v.x) / den));
}

export const onGrid = (p: Point2): Point2 =>
  vec(Math.round(p.x / GRID_STEP) * GRID_STEP, Math.round(p.y / GRID_STEP) * GRID_STEP);

/** The nearest point within r (plus, per point, its reach: d − reach is what is compared), of those `ok` takes. */
export function closest(points: readonly Point2[], p: Point2, r: number, reaches: readonly number[] = [], ok: (q: Point2) => boolean = () => true): Point2 | null {
  let best: Point2 | null = null;
  let bestD = r;
  points.forEach((q, i) => {
    if (!ok(q)) return;
    const d = distance(p, q) - (reaches[i] ?? 0);
    if (d <= bestD) {
      best = q;
      bestD = d;
    }
  });
  return best;
}

/** The foot of p on ab, strictly inside it; with a step, its distance from a rounded to that step. */
export function projectOnSegment(p: Point2, a: Point2, b: Point2, step = 0): Point2 | null {
  const len = distance(a, b);
  if (len === 0) return null;
  const u = normalize(sub(b, a));
  const raw = dot(sub(p, a), u);
  const t = step > 0 && raw > step && raw < len - step ? Math.round(raw / step) * step : raw;
  return t > 0 && t < len ? add(a, scale(u, t)) : null;
}

/** Where the ray from `from` along `u` crosses ab, strictly inside it, ahead of `from`. */
export function rayOnSegment(from: Point2, u: Point2, a: Point2, b: Point2): Point2 | null {
  const e = sub(b, a);
  const den = u.x * e.y - u.y * e.x;
  if (Math.abs(den) < 1e-12) return null;
  const w = sub(a, from);
  const t = (w.x * e.y - w.y * e.x) / den;
  const s = (w.x * u.y - w.y * u.x) / den;
  return t > 0 && s > 0 && s < 1 ? add(from, scale(u, t)) : null;
}

/** A perpendicular foot this near the last point is the point itself, not a snap. */
export const MIN_SNAP_RUN = 0.01;
