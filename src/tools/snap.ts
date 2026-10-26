// Snaps for drawing: the cursor jumps to what the user most likely means. Distances are in screen
// pixels (converted by the caller's metres-per-pixel), so snapping feels the same at any zoom.

import { add, distance, dot, normalize, type Point2, scale, sub, vec } from '../core/vector';
import { type Arc, arcOf, pointAt } from '../elements/wall/geometry/arc';
import { arcMiddle } from './arc-edit';
import type { MessageKey } from '../ui/i18n';

export type SnapKind =
  | 'endpoint'
  | 'corner'
  | 'start'
  | 'guideCross'
  | 'intersection'
  | 'origin'
  | 'midpoint'
  | 'onWall'
  | 'onFace'
  | 'onGuide'
  | 'perpendicular'
  | 'extension'
  | 'parallel'
  | 'aligned'
  | 'axis'
  | 'angle'
  | 'grid'
  | 'none';

export interface Snap {
  readonly point: Point2;
  readonly kind: SnapKind;
  /** Dashed guide from another point to the snapped one (alignment). */
  readonly guideFrom?: Point2;
  /** The wall the snap comes from (its end, middle, body, or the end it aligns with), when it has an id. */
  readonly wallId?: string;
}

export interface SnapInput {
  readonly cursor: Point2;
  /** Metres per screen pixel at the cursor. */
  readonly mpp: number;
  /**
   * `reach`: how far from its axis the wall's body goes (half its thickness, m). Its ends are taken
   * from anywhere on that body near them: the corner one sees is the faces', not the axis's. `face`:
   * an edge of a wall's drawn body (the measure tool): its ends are corners, its points on the face.
   */
  readonly segments: readonly {
    readonly id?: string;
    readonly start: Point2;
    readonly end: Point2;
    readonly reach?: number;
    readonly face?: boolean;
    /** An arc wall's bulge: its middle and its body are on the arc, not on the chord. */
    readonly bulge?: number;
  }[];
  /** The point being drawn from, if any. */
  readonly from: Point2 | null;
  /** The first point of the chain: clicking it closes the outline. */
  readonly chainStart: Point2 | null;
  readonly enabled: boolean;
  /** Shift: only right angles from `from`. */
  readonly orthogonal: boolean;
  /**
   * Guides (elements/guide/schema.ts): lines without ends, `dir` a unit vector. The pointer takes the
   * point where one crosses another or a wall's line, and else the guide itself.
   */
  readonly guides?: readonly GuideLine[];
}

/** A line without ends: a point of it and its unit direction. */
export interface GuideLine {
  readonly point: Point2;
  readonly dir: Point2;
}

export const GRID_STEP = 0.05;
const RADIUS_PX = 10;
const ORIGIN = vec(0, 0);
const ANGLE_STEP = 15;
/**
 * How far off a 15° step (or a wall's direction) the pointer may be and still be taken onto it. At 3°
 * a wall drawn by hand along a house front, 13 px off level over 190 px, came out at 4°, askew.
 */
const ANGLE_TOL_DEG = 5;
/** How far past a wall's end its extension catches the cursor (m). */
const EXTENSION_REACH = 8;
/** A perpendicular foot this near the last point is the point itself, not a snap. */
const MIN_SNAP_RUN = 0.01;

export const snapLabel: Readonly<Record<SnapKind, MessageKey | null>> = {
  endpoint: 'snap.endpoint',
  corner: 'snap.corner',
  start: 'snap.start',
  guideCross: 'snap.guideCross',
  intersection: 'snap.intersection',
  perpendicular: 'snap.perpendicular',
  extension: 'snap.extension',
  parallel: 'snap.parallel',
  origin: 'snap.origin',
  midpoint: 'snap.midpoint',
  onWall: 'snap.onWall',
  onFace: 'snap.onFace',
  onGuide: 'snap.onGuide',
  aligned: 'snap.alignedX',
  axis: 'snap.axis',
  angle: null,
  grid: null,
  none: null,
};

export function snap(input: SnapInput): Snap {
  const { cursor, mpp, from } = input;
  const r = RADIUS_PX * mpp;
  const guides = input.guides ?? [];
  if (from && input.orthogonal) return orthogonal(cursor, from, input.enabled, guides, r);
  if (!input.enabled) return { point: cursor, kind: 'none' };

  if (input.chainStart && from && distance(cursor, input.chainStart) <= r) return { point: input.chainStart, kind: 'start' };
  const ends = input.segments.flatMap((s) => [s.start, s.end]);
  // Which wall an end (index in `ends`) or a middle (index in `mids`) belongs to.
  const of = (i: number): { wallId?: string } => {
    const id = input.segments[i]?.id;
    return id === undefined ? {} : { wallId: id };
  };
  // The corners of the end's square of body are reach·√2 from it, at any angle of the wall.
  const reaches = input.segments.flatMap((s) => [(s.reach ?? 0) * Math.SQRT2, (s.reach ?? 0) * Math.SQRT2]);
  const nearEnd = closest(ends, cursor, r, reaches);
  if (nearEnd) {
    const i = Math.floor(ends.indexOf(nearEnd) / 2);
    return { point: nearEnd, kind: input.segments[i]?.face ? 'corner' : 'endpoint', ...of(i) };
  }
  // Where a guide crosses another guide or a wall's line: what guides are set for (a corridor's wall
  // starts where its guide meets the wall across).
  const crossings = guides.flatMap((g, k) => [
    ...guides.slice(k + 1).flatMap((h) => lineCrossing(g.point, g.dir, h.point, h.dir) ?? []),
    // A guide meets an arc wall where it cuts the circle, within its sweep.
    ...input.segments.flatMap((s) => {
      const arc = s.bulge ? arcOf({ start: s.start, end: s.end, bulge: s.bulge }) : null;
      if (arc) return circleCrossings(arc, g.point, g.dir).filter((p) => arcFoot(arc, p, 0) !== null);
      const p = lineCrossing(g.point, g.dir, s.start, sub(s.end, s.start));
      // On the segment, ends included (a guide through a wall's end crosses it there).
      return p && dot(sub(p, s.start), sub(p, s.end)) <= 1e-12 ? [p] : [];
    }),
  ]);
  const nearCross = closest(crossings, cursor, r);
  if (nearCross) return { point: nearCross, kind: 'guideCross' };
  // Where two walls' lines cross near the cursor, on them or on their extensions (Revit's SI): a wall
  // drawn to where two others would meet. Straight walls whose lines pass within reach of the cursor.
  const straight = input.segments.map((s, i) => ({ s, i })).filter(({ s }) => !s.face && !s.bulge && distance(s.start, s.end) > 0);
  const nearLine = straight.filter(({ s }) => Math.abs(dot(sub(cursor, s.start), perpOf(normalize(sub(s.end, s.start))))) <= r + (s.reach ?? 0));
  for (let a = 0; a < nearLine.length; a++) {
    for (let b = a + 1; b < nearLine.length; b++) {
      const p = lineCrossing(nearLine[a]!.s.start, normalize(sub(nearLine[a]!.s.end, nearLine[a]!.s.start)), nearLine[b]!.s.start, normalize(sub(nearLine[b]!.s.end, nearLine[b]!.s.start)));
      if (p && distance(p, cursor) <= r) return { point: p, kind: 'intersection', ...of(nearLine[a]!.i) };
    }
  }
  // The crossing of the axes drawn on the plan: where a project is usually started.
  if (distance(cursor, ORIGIN) <= r) return { point: ORIGIN, kind: 'origin' };
  // A face's edges are pieces of a wall's body, cut where other walls and openings meet it: their
  // middles mean nothing, and would catch the tape halfway across a room.
  const mids = input.segments.flatMap((s, i) => (s.face ? [] : [{ i, p: s.bulge ? arcMiddle(s.start, s.end, s.bulge) : scale(add(s.start, s.end), 0.5) }]));
  const nearMid = closest(
    mids.map((m) => m.p),
    cursor,
    r,
  );
  if (nearMid) return { point: nearMid, kind: 'midpoint', ...of(mids.find((m) => m.p === nearMid)!.i) };
  // Angle from the last point in 15° steps, or along a wall's own direction (parallel to it, or square
  // to it, as SketchUp's and ArchiCAD's do), whichever is nearest; the length on the 5 cm grid.
  let best: Snap | null = null;
  let ray: Point2 | null = null;
  if (from && distance(cursor, from) > r) {
    const d = sub(cursor, from);
    const deg = (Math.atan2(d.y, d.x) * 180) / Math.PI;
    const off = (a: number) => Math.abs(((((deg - a) % 180) + 270) % 180) - 90);
    const step = Math.round(deg / ANGLE_STEP) * ANGLE_STEP;
    let pick: { deg: number; kind: SnapKind; wall?: number } | null = Math.abs(deg - step) <= ANGLE_TOL_DEG ? { deg: step, kind: 'angle' } : null;
    for (const { s, i } of straight) {
      const w = (Math.atan2(s.end.y - s.start.y, s.end.x - s.start.x) * 180) / Math.PI;
      // A wall at a multiple of 15° adds nothing the steps do not give.
      if (Math.abs(w / ANGLE_STEP - Math.round(w / ANGLE_STEP)) * ANGLE_STEP < 1e-6) continue;
      for (const a of [w, w + 90]) {
        const e = off(a);
        if (e > ANGLE_TOL_DEG || (pick && e >= off(pick.deg))) continue;
        // The direction a takes nearest the pointer's, along it or against it.
        const along = Math.abs(((((deg - a) % 360) + 540) % 360) - 180) <= 90 ? a : a + 180;
        pick = { deg: along, kind: 'parallel', wall: i };
      }
    }
    if (pick) {
      ray = vec(Math.cos((pick.deg * Math.PI) / 180), Math.sin((pick.deg * Math.PI) / 180));
      const len = Math.max(GRID_STEP, Math.round(dot(d, ray) / GRID_STEP) * GRID_STEP);
      best = { point: add(from, scale(ray, len)), kind: pick.kind, ...(pick.wall !== undefined ? of(pick.wall) : {}) };
    }
  }

  // Square to a wall from the last point (Revit's SP): the foot of the point on the wall's line, when
  // the cursor is near it; the nearest such foot, and on a face too (the tape). The first wall in the
  // list won before: measuring a room from its face, the tape ended on the far wall's axis, 7,5 cm
  // past its face, since the axis came first and lay within reach.
  if (from) {
    let near: { foot: Point2; d: number; i: number } | null = null;
    for (const [i, s] of input.segments.entries()) {
      if (s.bulge || distance(s.start, s.end) === 0) continue;
      const u = normalize(sub(s.end, s.start));
      const foot = add(s.start, scale(u, dot(sub(from, s.start), u)));
      const t = dot(sub(foot, s.start), u);
      if (t <= 0 || t >= distance(s.start, s.end) || distance(foot, from) < MIN_SNAP_RUN) continue;
      const d = distance(foot, cursor);
      if (d <= r && (near === null || d < near.d)) near = { foot, d, i };
    }
    if (near) return { point: near.foot, kind: 'perpendicular', ...of(near.i) };
  }

  // On the body of a wall: before alignment, which every wall's own ends would otherwise always win.
  // Drawing on a snapped angle, the point is where that direction meets the wall, so a partition
  // ended on a wall stays square. Otherwise the foot of the cursor, its distance along the wall on
  // the 5 cm grid.
  for (const [i, s] of input.segments.entries()) {
    const arc = s.bulge ? arcOf({ start: s.start, end: s.end, bulge: s.bulge }) : null;
    if (arc) {
      // An arc wall: the cursor's foot on the arc, its distance along it on the 5 cm grid; on a
      // snapped angle, where that direction cuts the arc.
      if (Math.abs(distance(cursor, arc.center) - arc.radius) > r + (s.reach ?? 0) || !arcFoot(arc, cursor, 0)) continue;
      const slack = from ? r + distance(cursor, from) * Math.tan((ANGLE_TOL_DEG * Math.PI) / 180) : r;
      const cut =
        ray && from
          ? circleCrossings(arc, from, ray)
              .filter((p) => dot(sub(p, from), ray!) > 0 && arcFoot(arc, p, 0) !== null && distance(p, cursor) <= slack)
              .sort((a, b) => distance(a, cursor) - distance(b, cursor))[0]
          : undefined;
      return { point: cut ?? arcFoot(arc, cursor, GRID_STEP)!, kind: 'onWall', ...of(i) };
    }
    // Anywhere on its drawn body (half its thickness each side of the axis) plus the radius.
    const foot = projectOnSegment(cursor, s.start, s.end);
    if (!foot || distance(foot, cursor) > r + (s.reach ?? 0)) continue;
    // No farther from the cursor than the angle snap itself would move it (a wall almost along the
    // ray would otherwise pull the point far down that wall).
    const slack = from ? r + distance(cursor, from) * Math.tan((ANGLE_TOL_DEG * Math.PI) / 180) : r;
    const crossing = ray && from ? rayOnSegment(from, ray, s.start, s.end) : null;
    const onRay = crossing && distance(crossing, cursor) <= slack ? crossing : null;
    const p = onRay ?? projectOnSegment(cursor, s.start, s.end, GRID_STEP) ?? foot;
    return { point: p, kind: s.face ? 'onFace' : 'onWall', ...of(i) };
  }

  // On a guide: where the snapped direction meets it (a partition drawn square to a wall stops on the
  // guide), else the foot of the cursor, its distance along the guide on the 5 cm grid.
  for (const g of guides) {
    const off = dot(sub(cursor, g.point), perpOf(g.dir));
    if (Math.abs(off) > r) continue;
    const slack = from ? r + distance(cursor, from) * Math.tan((ANGLE_TOL_DEG * Math.PI) / 180) : r;
    const crossing = ray && from ? lineCrossing(from, ray, g.point, g.dir) : null;
    const onRay = crossing && dot(sub(crossing, from!), ray!) > 0 && distance(crossing, cursor) <= slack ? crossing : null;
    const along = Math.round(dot(sub(cursor, g.point), g.dir) / GRID_STEP) * GRID_STEP;
    return { point: onRay ?? add(g.point, scale(g.dir, along)), kind: 'onGuide' };
  }

  // On a wall's line past its end (SketchUp's extension, ArchiCAD's): within the radius of it and a
  // few metres of the end, the dashed line from the end showing it. On a snapped direction, where that
  // direction meets the extension.
  for (const { s, i } of straight) {
    const u = normalize(sub(s.end, s.start));
    const len = distance(s.start, s.end);
    const t = dot(sub(cursor, s.start), u);
    const beyond = t > len ? t - len : t < 0 ? -t : 0;
    if (beyond <= r || beyond > EXTENSION_REACH) continue;
    if (Math.abs(dot(sub(cursor, s.start), perpOf(u))) > r) continue;
    const end = t > len ? s.end : s.start;
    const cut = ray && from ? lineCrossing(from, ray, s.start, u) : null;
    const slack = from ? r + distance(cursor, from) * Math.tan((ANGLE_TOL_DEG * Math.PI) / 180) : r;
    const p = cut && distance(cut, cursor) <= slack ? cut : add(s.start, scale(u, Math.round(t / GRID_STEP) * GRID_STEP));
    return { point: p, kind: 'extension', guideFrom: end, ...of(i) };
  }

  // Aligned with another wall end, horizontally or vertically, within the radius. On a snapped
  // direction the point slides along that direction to the line, so it never leaves the angle.
  const dir = best && from ? normalize(sub(best.point, from)) : null;
  // The origin last: the axes it stands for are a weaker guide than the walls' own ends.
  const targets = [...ends, ...(input.chainStart ? [input.chainStart] : []), ORIGIN];
  for (const [k, e] of targets.entries()) {
    const base = best?.point ?? cursor;
    if (distance(e, cursor) <= r) continue;
    const wall = k < ends.length ? of(Math.floor(k / 2)) : {};
    const kind: SnapKind = k === targets.length - 1 ? 'axis' : 'aligned';
    if (Math.abs(base.x - e.x) <= r) {
      const p = dir && from ? (Math.abs(dir.x) > 1e-9 ? add(from, scale(dir, (e.x - from.x) / dir.x)) : null) : vec(e.x, base.y);
      if (p) return { point: p, kind, guideFrom: e, ...wall };
    }
    if (Math.abs(base.y - e.y) <= r) {
      const p = dir && from ? (Math.abs(dir.y) > 1e-9 ? add(from, scale(dir, (e.y - from.y) / dir.y)) : null) : vec(base.x, e.y);
      if (p) return { point: p, kind, guideFrom: e, ...wall };
    }
  }
  if (best) return best;
  return { point: onGrid(cursor), kind: 'grid' };
}

/** Shift: straight across or up from `from`; stopped on a guide it crosses near the cursor. */
function orthogonal(cursor: Point2, from: Point2, grid: boolean, guides: readonly GuideLine[], r: number): Snap {
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

const perpOf = (u: Point2): Point2 => vec(-u.y, u.x);

/**
 * The point of the arc at p's angle about its centre, strictly within its sweep; with a step, its
 * length along the arc from the start rounded to it (away from the ends). Null outside the sweep.
 */
function arcFoot(arc: Arc, p: Point2, step: number): Point2 | null {
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
function circleCrossings(arc: Arc, p: Point2, u: Point2): Point2[] {
  const w = sub(p, arc.center);
  const b = dot(u, w);
  const c = dot(w, w) - arc.radius * arc.radius;
  const disc = b * b - c;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  return [-b - s, -b + s].map((t) => add(p, scale(u, t)));
}

/** Where the line through p along u meets the line through q along v; null when they are parallel. */
function lineCrossing(p: Point2, u: Point2, q: Point2, v: Point2): Point2 | null {
  const den = u.x * v.y - u.y * v.x;
  if (Math.abs(den) < 1e-9 * Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)) return null;
  const w = sub(q, p);
  return add(p, scale(u, (w.x * v.y - w.y * v.x) / den));
}

export const onGrid = (p: Point2): Point2 =>
  vec(Math.round(p.x / GRID_STEP) * GRID_STEP, Math.round(p.y / GRID_STEP) * GRID_STEP);

/** The nearest point within r (plus, per point, its reach: d − reach is what is compared). */
function closest(points: readonly Point2[], p: Point2, r: number, reaches: readonly number[] = []): Point2 | null {
  let best: Point2 | null = null;
  let bestD = r;
  points.forEach((q, i) => {
    const d = distance(p, q) - (reaches[i] ?? 0);
    if (d <= bestD) {
      best = q;
      bestD = d;
    }
  });
  return best;
}

/** The foot of p on ab, strictly inside it; with a step, its distance from a rounded to that step. */
function projectOnSegment(p: Point2, a: Point2, b: Point2, step = 0): Point2 | null {
  const len = distance(a, b);
  if (len === 0) return null;
  const u = normalize(sub(b, a));
  const raw = dot(sub(p, a), u);
  const t = step > 0 && raw > step && raw < len - step ? Math.round(raw / step) * step : raw;
  return t > 0 && t < len ? add(a, scale(u, t)) : null;
}

/** Where the ray from `from` along `u` crosses ab, strictly inside it, ahead of `from`. */
function rayOnSegment(from: Point2, u: Point2, a: Point2, b: Point2): Point2 | null {
  const e = sub(b, a);
  const den = u.x * e.y - u.y * e.x;
  if (Math.abs(den) < 1e-12) return null;
  const w = sub(a, from);
  const t = (w.x * e.y - w.y * e.x) / den;
  const s = (w.x * u.y - w.y * u.x) / den;
  return t > 0 && s > 0 && s < 1 ? add(from, scale(u, t)) : null;
}
