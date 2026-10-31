// Snaps for drawing: the cursor jumps to what the user most likely means. Distances are in screen
// pixels (converted by the caller's metres-per-pixel), so snapping feels the same at any zoom.

import { add, distance, dot, normalize, type Point2, scale, sub, vec } from '../model/vector';
import { GRID_STEP } from '../model/tolerance';
import { type Arc, arcOf, pointAt } from '../elements/wall/geometry/arc';
import { arcMiddle } from '../elements/wall/arc-edit';
import type { Snap, SnapInput, SnapKind } from './snap-types';
import { arcFoot, circleCrossings, closest, lineCrossing, locked, MIN_SNAP_RUN, onGrid, orthogonal, perpOf, projectOnSegment, rayOnSegment } from './snap-geometry';
import type { WallId } from '../elements/wall/schema';

export { GRID_STEP };

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

export function snap(input: SnapInput): Snap {
  const { cursor, mpp, from } = input;
  const r = RADIUS_PX * mpp;
  const guides = input.guides ?? [];
  if (from && input.lock) return locked(cursor, from, input.lock, input.enabled, guides, input.segments, r);
  if (from && input.orthogonal) return orthogonal(cursor, from, input.enabled, guides, r);
  if (!input.enabled) return { point: cursor, kind: 'none' };
  // What Tab has already offered here is passed over: the next candidate, in the same order.
  const skip = input.skip ?? [];
  const fresh = (p: Point2) => skip.every((q) => distance(p, q) > 1e-6);

  if (input.chainStart && from && distance(cursor, input.chainStart) <= r && fresh(input.chainStart)) return { point: input.chainStart, kind: 'start' };
  const ends = input.segments.flatMap((s) => [s.start, s.end]);
  // Which wall an end (index in `ends`) or a middle (index in `mids`) belongs to.
  const of = (i: number): { wallId?: WallId } => {
    const id = input.segments[i]?.id;
    return id === undefined ? {} : { wallId: id };
  };
  // The corners of the end's square of body are reach·√2 from it, at any angle of the wall.
  const reaches = input.segments.flatMap((s) => [(s.reach ?? 0) * Math.SQRT2, (s.reach ?? 0) * Math.SQRT2]);
  const nearEnd = closest(ends, cursor, r, reaches, fresh);
  if (nearEnd) {
    const i = Math.floor(ends.indexOf(nearEnd) / 2);
    return { point: nearEnd, kind: input.segments[i]?.face ? 'corner' : 'endpoint', ...of(i) };
  }
  // The elements' points, and an arc wall's centre: as strong as a wall's end.
  const marks = [
    ...(input.points ?? []),
    ...input.segments.flatMap((s) => {
      const arc = s.bulge ? arcOf({ start: s.start, end: s.end, bulge: s.bulge }) : null;
      return arc ? [{ point: arc.center, kind: 'center' as const }] : [];
    }),
  ];
  const nearMark = closest(
    marks.map((m) => m.point),
    cursor,
    r,
    [],
    fresh,
  );
  if (nearMark) return { point: nearMark, kind: marks.find((m) => m.point === nearMark)!.kind };
  // Where a guide crosses another guide or a wall's line: what guides are set for (a corridor's wall
  // starts where its guide meets the wall across).
  const crossings: Point2[] = guides.flatMap((g, k) => [
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
  // A circle guide where it crosses a line guide or a straight wall.
  for (const c of input.circles ?? []) {
    const circle = { center: c.center, radius: c.radius } as Arc;
    for (const g of guides) crossings.push(...circleCrossings(circle, g.point, g.dir));
    for (const s of input.segments) {
      if (s.bulge || distance(s.start, s.end) === 0) continue;
      for (const p of circleCrossings(circle, s.start, normalize(sub(s.end, s.start)))) if (dot(sub(p, s.start), sub(p, s.end)) <= 1e-12) crossings.push(p);
    }
  }
  const nearCross = closest(crossings, cursor, r, [], fresh);
  if (nearCross) return { point: nearCross, kind: 'guideCross' };
  // Where two walls' lines cross near the cursor, on them or on their extensions (Revit's SI): a wall
  // drawn to where two others would meet. Straight walls whose lines pass within reach of the cursor.
  const straight = input.segments.map((s, i) => ({ s, i })).filter(({ s }) => !s.face && !s.bulge && distance(s.start, s.end) > 0);
  const nearLine = straight.filter(({ s }) => Math.abs(dot(sub(cursor, s.start), perpOf(normalize(sub(s.end, s.start))))) <= r + (s.reach ?? 0));
  for (let a = 0; a < nearLine.length; a++) {
    for (let b = a + 1; b < nearLine.length; b++) {
      const p = lineCrossing(nearLine[a]!.s.start, normalize(sub(nearLine[a]!.s.end, nearLine[a]!.s.start)), nearLine[b]!.s.start, normalize(sub(nearLine[b]!.s.end, nearLine[b]!.s.start)));
      if (p && distance(p, cursor) <= r && fresh(p)) return { point: p, kind: 'intersection', ...of(nearLine[a]!.i) };
    }
  }
  // The crossing of the axes drawn on the plan: where a project is usually started.
  if (distance(cursor, ORIGIN) <= r && fresh(ORIGIN)) return { point: ORIGIN, kind: 'origin' };
  // A face's edges are pieces of a wall's body, cut where other walls and openings meet it: their
  // middles mean nothing, and would catch the tape halfway across a room.
  const mids = input.segments.flatMap((s, i) => (s.face ? [] : [{ i, p: s.bulge ? arcMiddle(s.start, s.end, s.bulge) : scale(add(s.start, s.end), 0.5) }]));
  const nearMid = closest(
    mids.map((m) => m.p),
    cursor,
    r,
    [],
    fresh,
  );
  if (nearMid) return { point: nearMid, kind: 'midpoint', ...of(mids.find((m) => m.p === nearMid)!.i) };
  // A segment divided into parts (thirds unless said otherwise), its middle being the one above.
  const n = Math.max(2, Math.round(input.parts ?? 3));
  const divisions = input.segments.flatMap((s, i) => {
    if (s.face) return [];
    const arc = s.bulge ? arcOf({ start: s.start, end: s.end, bulge: s.bulge }) : null;
    const at = (t: number) => (arc ? pointAt(arc, arc.startAngle + arc.sweep * t) : add(s.start, scale(sub(s.end, s.start), t)));
    return Array.from({ length: n - 1 }, (_, k) => k + 1)
      .filter((k) => 2 * k !== n)
      .map((k) => ({ i, p: at(k / n) }));
  });
  const nearDivision = closest(
    divisions.map((d) => d.p),
    cursor,
    r,
    [],
    fresh,
  );
  if (nearDivision) return { point: nearDivision, kind: 'division', ...of(divisions.find((d) => d.p === nearDivision)!.i) };
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
      if (d <= r && fresh(foot) && (near === null || d < near.d)) near = { foot, d, i };
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
      const q = cut ?? arcFoot(arc, cursor, GRID_STEP)!;
      if (!fresh(q)) continue;
      return { point: q, kind: 'onWall', ...of(i) };
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
    if (!fresh(p)) continue;
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
    const q = onRay ?? add(g.point, scale(g.dir, along));
    if (!fresh(q)) continue;
    return { point: q, kind: 'onGuide' };
  }

  // On a circle guide: the cursor's foot on it.
  for (const c of input.circles ?? []) {
    const d = distance(cursor, c.center);
    if (d < 1e-9 || Math.abs(d - c.radius) > r) continue;
    const q = add(c.center, scale(sub(cursor, c.center), c.radius / d));
    if (!fresh(q)) continue;
    return { point: q, kind: 'onGuide' };
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
    if (!fresh(p)) continue;
    return { point: p, kind: 'extension', guideFrom: end, ...of(i) };
  }

  // Aligned with another wall end, horizontally or vertically, within the radius. On a snapped
  // direction the point slides along that direction to the line, so it never leaves the angle.
  const dir = best && from ? normalize(sub(best.point, from)) : null;
  // The origin last: the axes it stands for are a weaker guide than the walls' own ends.
  const targets = [...ends, ...(input.chainStart ? [input.chainStart] : []), ...(input.acquired ?? []), ORIGIN];
  // Slid along a snapped direction no farther from the pointer than the other snaps on a ray go: on a
  // steep direction the point leapt many times the radius to an end's x (or y).
  const slack = from ? r + distance(cursor, from) * Math.tan((ANGLE_TOL_DEG * Math.PI) / 180) : r;
  const near = (p: Point2 | null) => (p && (!dir || distance(p, cursor) <= slack) ? p : null);
  for (const [k, e] of targets.entries()) {
    const base = best?.point ?? cursor;
    if (distance(e, cursor) <= r) continue;
    const wall = k < ends.length ? of(Math.floor(k / 2)) : {};
    const kind: SnapKind = k === targets.length - 1 ? 'axis' : 'aligned';
    if (Math.abs(base.x - e.x) <= r) {
      const p = near(dir && from ? (Math.abs(dir.x) > 1e-9 ? add(from, scale(dir, (e.x - from.x) / dir.x)) : null) : vec(e.x, base.y));
      if (p && fresh(p)) return { point: p, kind, guideFrom: e, ...wall };
    }
    if (Math.abs(base.y - e.y) <= r) {
      const p = near(dir && from ? (Math.abs(dir.y) > 1e-9 ? add(from, scale(dir, (e.y - from.y) / dir.y)) : null) : vec(base.x, e.y));
      if (p && fresh(p)) return { point: p, kind, guideFrom: e, ...wall };
    }
  }
  if (best && fresh(best.point)) return best;
  return { point: onGrid(cursor), kind: 'grid' };
}
