// A dimension's ends: what holds a point put on the plan (anchorAt), and where a held point is now
// (resolve). Read against the walls' chords, so an arc's ends hold, and a point along it is taken on its
// chord. Pure.

import type { Doc } from '../../project/doc';
import type { DerivedGeometry } from '../../project/derive';
import { add, distance, dot, normalize, perp, type Point2, scale, sub } from '../../model/vector';

/** How far p is from the segment a–b (model/vector's; kept as anchor's API for the kinds). */
export { segmentDistance } from '../../model/vector';
import type { DimAnchor, Dimension } from './schema';
import type { WallId } from '../wall/schema';
import type { LevelId } from '../../project/doc';

/** Points this near (m) are the same point: a jamb, a face. */
const SAME = 1e-4;
/** How far past a wall's body (m) a point still belongs to it: a corner snapped on its face. */
const SLACK = 0.01;

const axes = (start: Point2, end: Point2) => {
  const dir = normalize(sub(end, start));
  return { dir, normal: perp(dir), length: distance(start, end) };
};

/** What holds a point put at p on the level: a jamb, a wall, or nothing. */
export function anchorAt(doc: Doc, g: DerivedGeometry, levelId: LevelId, p: Point2): DimAnchor {
  const walls = new Map(doc.walls.filter((w) => w.levelId === levelId).map((w) => [w.id, w]));
  const thick = (id: WallId) => g.solids.get(id)?.layers.reduce((t, l) => t + l.thickness, 0) ?? 0;
  // A jamb first: a point on it is the door's, so it follows the door along its wall.
  for (const o of g.openings.values()) {
    const w = walls.get(o.opening.wallId);
    if (!w || w.bulge || !o.valid) continue;
    const { dir, normal } = axes(w.start, w.end);
    const station = dot(dir, sub(p, w.start));
    const offset = dot(normal, sub(p, w.start));
    if (Math.abs(offset) > thick(w.id) + SLACK) continue;
    if (Math.abs(station - o.start) < SAME) return { kind: 'opening', openingId: o.opening.id, jamb: 'start', offset };
    if (Math.abs(station - o.end) < SAME) return { kind: 'opening', openingId: o.opening.id, jamb: 'end', offset };
  }
  // The wall whose body is nearest (inside it: none nearer), from its nearer end.
  let best: { a: DimAnchor; d: number } | null = null;
  for (const w of walls.values()) {
    const { dir, normal, length } = axes(w.start, w.end);
    if (length === 0) continue;
    const t = thick(w.id);
    const station = dot(dir, sub(p, w.start));
    const offset = dot(normal, sub(p, w.start));
    const outAlong = Math.max(0, -t - station, station - length - t);
    const outAcross = Math.max(0, Math.abs(offset) - t);
    const out = Math.hypot(outAlong, outAcross);
    if (out > SLACK) continue;
    // At a T, the end of the wall that stops lies in the body of the wall that goes on: the point is the
    // end's (it moves with that wall), so of the walls it is in, the one whose end it is nearest wins.
    const fromEnd = Math.min(Math.abs(station), Math.abs(station - length));
    const d = out + fromEnd * 1e-3;
    if (best && d >= best.d) continue;
    // An arc's points are held only at its ends; between them, the chord is not where the arc is.
    if (w.bulge && fromEnd > t + SLACK) continue;
    const fromStart = station <= length / 2;
    best = { a: { kind: 'wall', wallId: w.id, end: fromStart ? 'start' : 'end', along: fromStart ? station : length - station, offset }, d };
  }
  return best?.a ?? { kind: 'point', at: { x: p.x, y: p.y } };
}

/** Where a held point is now; null when what held it is gone (deleted, or an opening with no place). */
export function resolve(doc: Doc, g: Pick<DerivedGeometry, 'openings'>, a: DimAnchor): Point2 | null {
  if (a.kind === 'point') return a.at;
  if (a.kind === 'wall') {
    const w = doc.walls.find((x) => x.id === a.wallId);
    if (!w) return null;
    const { dir, normal } = axes(w.start, w.end);
    const from = a.end === 'start' ? w.start : w.end;
    const into = a.end === 'start' ? dir : scale(dir, -1);
    return add(add(from, scale(into, a.along)), scale(normal, a.offset));
  }
  const o = g.openings.get(a.openingId);
  const w = o && doc.walls.find((x) => x.id === o.opening.wallId);
  if (!o || !w) return null;
  const { dir, normal } = axes(w.start, w.end);
  return add(add(w.start, scale(dir, a.jamb === 'start' ? o.start : o.end)), scale(normal, a.offset));
}

/** A dimension where it is now: its two points, its line (off them by its offset) and its length. */
export function placeDimension(doc: Doc, g: Pick<DerivedGeometry, 'openings'>, d: Dimension): { a: Point2; b: Point2; la: Point2; lb: Point2; length: number } | null {
  const a = resolve(doc, g, d.a);
  const b = resolve(doc, g, d.b);
  if (!a || !b || distance(a, b) < 1e-9) return null;
  const n = scale(perp(normalize(sub(b, a))), d.offset);
  return { a, b, la: add(a, n), lb: add(b, n), length: distance(a, b) };
}

/** The offset that puts a dimension from a to b through p: p's distance from the line, to its left. */
export const offsetThrough = (a: Point2, b: Point2, p: Point2): number => dot(perp(normalize(sub(b, a))), sub(p, a));


