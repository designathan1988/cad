// Walls standing on a wall of the level just below, along it, whose exterior faces do not line up:
// the step shows on the façade (a 15 cm wall on the axis of a 20 cm one, 2.5 cm in from its face).
// Chief Architect says so and offers Align With Wall Below; so does this, with the shift that aligns
// them. Pure: from the document.

import { POINT_TOLERANCE } from '../model/tolerance';
import { add, cross, dot, type Point2, scale, sub } from '../model/vector';
import { faceOffsets, wallDirection, wallLength, wallNormal } from '../elements/wall/geometry/offset';
import { shapeOf, type WallShape } from '../elements/wall/geometry/shape';
import type { WallId } from '../elements/wall/schema';
import type { Doc } from '../project/doc';
import type { LevelId } from '../project/doc';

export interface StackedStep {
  /** The wall standing on the other, and the wall below it. */
  readonly upperId: WallId;
  readonly lowerId: WallId;
  /** How far apart the two exterior faces are, and the move that puts the upper one's on the lower's. */
  readonly size: number;
  readonly shift: Point2;
}

/** Sine of the largest angle two walls may make and still be one over the other (0.6°, the engine's in line). */
const PARALLEL = Math.sin((0.6 * Math.PI) / 180);
/** How much of the shorter wall must lie over the other: half of it, and at least 20 cm. */
const OVERLAP = 0.5;
const MIN_OVERLAP = 0.2;

export function stackedSteps(doc: Doc): StackedStep[] {
  const types = new Map(doc.wallTypes.map((t) => [t.id, t]));
  const shapes = new Map<WallId, { shape: WallShape; levelId: LevelId }>();
  for (const w of doc.walls) {
    if (w.bulge) continue;
    const s = shapeOf(w, types.get(w.wallTypeId));
    if (typeof s !== 'string' && wallLength(s) > POINT_TOLERANCE) shapes.set(w.id, { shape: s, levelId: w.levelId });
  }
  const levels = [...doc.levels].sort((a, b) => a.elevation - b.elevation);
  const below = new Map(levels.map((l, i) => [l.id, i > 0 ? levels[i - 1]!.id : null]));
  const steps: StackedStep[] = [];
  for (const [upperId, up] of shapes) {
    const lowerLevel = below.get(up.levelId);
    if (!lowerLevel) continue;
    let best: StackedStep | null = null;
    let bestOverlap = 0;
    for (const [lowerId, low] of shapes) {
      if (low.levelId !== lowerLevel) continue;
      const u = up.shape;
      const w = low.shape;
      const dw = wallDirection(w);
      if (Math.abs(cross(wallDirection(u), dw)) > PARALLEL) continue;
      // Along the lower wall: how much of the upper one lies over it.
      const a = dot(sub(u.start, w.start), dw);
      const b = dot(sub(u.end, w.start), dw);
      const overlap = Math.min(Math.max(a, b), wallLength(w)) - Math.max(Math.min(a, b), 0);
      if (overlap < Math.max(MIN_OVERLAP, OVERLAP * Math.min(wallLength(u), wallLength(w)))) continue;
      // Across it: the upper wall's faces, along the lower wall's normal, against the lower wall's.
      const nw = wallNormal(w);
      const nu = wallNormal(u);
      const along = (o: number) => dot(sub(add(u.start, scale(nu, o)), w.start), nw);
      const [u0, u1] = faceOffsets(u).map(along) as [number, number];
      const [w0, w1] = faceOffsets(w);
      // Standing on it: the two bands overlap.
      if (Math.max(u0, u1) <= w0 + POINT_TOLERANCE || Math.min(u0, u1) >= w1 - POINT_TOLERANCE) continue;
      if (overlap <= bestOverlap) continue;
      // The lower wall's exterior face (its right, the smaller offset): the façade the step shows on.
      const delta = Math.min(u0, u1) - w0;
      bestOverlap = overlap;
      best = Math.abs(delta) > POINT_TOLERANCE ? { upperId, lowerId, size: Math.abs(delta), shift: scale(nw, -delta) } : null;
    }
    if (best) steps.push(best);
  }
  return steps;
}
