// Placing a guide (pure): set off from a straight wall's face, or from another guide, by the distance
// the pointer sets (on the 5 cm grid with snaps on) or a typed one. Measured from the face on the
// pointer's side, so the value is the clear space: a guide 1.20 m off a wall's face, and a wall drawn
// with that face as its reference line, leave a corridor 1.20 m wide. The gesture (Alt over the wall
// or guide) is input.ts's; what guides are, elements/guide/schema.ts.

import type { Doc } from '../../project/doc';
import { add, cross, distance, dot, perp, type Point2, scale, sub } from '../../model/vector';
import type { Guide } from './schema';
import { faceOffsets, wallDirection, wallNormal } from '../wall/geometry/offset';
import { shapeOf } from '../wall/geometry/shape';
import { GRID_STEP } from '../../model/tolerance';
import type { LevelId } from '../../project/doc';

/** What a guide is set off from: a line, and the band its body takes across it (a wall's faces). */
export interface GuideBase {
  readonly point: Point2;
  /** Unit direction; across it is perp(dir). */
  readonly dir: Point2;
  /** The faces' offsets across the line, the smaller first; [0, 0] for a guide, which has no body. */
  readonly faces: readonly [number, number];
  readonly wallId?: string;
  readonly guideId?: string;
}

export interface GuideDraft {
  readonly base: GuideBase;
  /** The face it is set off from: +1 the one along perp(dir), −1 the other. */
  readonly side: 1 | -1;
  /** From that face (m). */
  readonly offset: number;
  /** Where along the base the pointer is (m from its point): where the distance is drawn. */
  readonly along: number;
}

/** Within this many pixels of a wall's body or of a guide, the pointer is on it. */
export const GUIDE_PX = 6;

/**
 * The straight wall whose body is under the pointer (the nearest), or else the guide within reach of
 * it; null over neither (an arc has no face to keep parallel to). Hidden walls or guides are skipped.
 */
export function guideBaseAt(doc: Doc, levelId: LevelId, p: Point2, mpp: number, shown: { walls: boolean; guides: boolean } = { walls: true, guides: true }): GuideBase | null {
  const r = GUIDE_PX * mpp;
  const types = new Map(doc.wallTypes.map((t) => [t.id, t]));
  let wall: { base: GuideBase; off: number } | null = null;
  for (const w of shown.walls ? doc.walls : []) {
    if (w.levelId !== levelId || w.bulge) continue;
    const shape = shapeOf(w, types.get(w.wallTypeId));
    if (typeof shape === 'string') continue;
    const d = wallDirection(shape);
    const [f0, f1] = faceOffsets(shape);
    const v = sub(p, w.start);
    const s = dot(v, d);
    const c = dot(v, wallNormal(shape));
    if (s < -r || s > distance(w.start, w.end) + r) continue;
    const off = c < f0 ? f0 - c : c > f1 ? c - f1 : 0;
    if (off <= r && (!wall || off < wall.off)) wall = { base: { point: w.start, dir: d, faces: [f0, f1], wallId: w.id }, off };
  }
  if (wall) return wall.base;
  let guide: { base: GuideBase; off: number } | null = null;
  for (const g of shown.guides ? doc.guides : []) {
    // A point or a circle is no line to set a guide off.
    if (g.levelId !== levelId || g.shape) continue;
    const off = Math.abs(cross(g.dir, sub(p, g.point)));
    if (off <= r && (!guide || off < guide.off)) guide = { base: { point: g.point, dir: g.dir, faces: [0, 0], guideId: g.id }, off };
  }
  return guide?.base ?? null;
}

/** The guide the pointer at p sets: off the face on its side, by its distance from that face. */
export function draftAt(base: GuideBase, p: Point2, grid: boolean): GuideDraft {
  const v = sub(p, base.point);
  const c = dot(v, perp(base.dir));
  const [f0, f1] = base.faces;
  const side = c >= (f0 + f1) / 2 ? 1 : -1;
  const raw = side > 0 ? Math.max(0, c - f1) : Math.max(0, f0 - c);
  return { base, side, offset: grid ? Math.round(raw / GRID_STEP) * GRID_STEP : raw, along: dot(v, base.dir) };
}

const faceOf = (d: GuideDraft): number => (d.side > 0 ? d.base.faces[1] : d.base.faces[0]);

/** The guide's line: the base's direction, `offset` (the draft's own unless given) off its face. */
export function guideLine(d: GuideDraft, offset = d.offset): { point: Point2; dir: Point2 } {
  return { point: add(d.base.point, scale(perp(d.base.dir), faceOf(d) + d.side * offset)), dir: d.base.dir };
}

/** The distance as a dimension: from the face to the guide, across them where the pointer is. */
export function guideMeasure(d: GuideDraft, offset = d.offset): { a: Point2; b: Point2 } {
  const n = perp(d.base.dir);
  const a = add(d.base.point, add(scale(d.base.dir, d.along), scale(n, faceOf(d))));
  return { a, b: add(a, scale(n, d.side * offset)) };
}

export function newGuide(id: string, levelId: LevelId, d: GuideDraft, offset = d.offset): Guide {
  return { id, levelId, ...guideLine(d, offset) };
}
