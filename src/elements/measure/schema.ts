// Dimensions other than straight lengths (docs/plano-de-escopo.md, phase 10: "cotas angulares, de raio, de
// arco e por coordenada"): the angle between two arms from a vertex; the radius, the diameter or the arc's
// length of an arc wall, held by that wall (its face or its reference line) and redrawn as it changes; and a
// point's coordinates in the plan. Kept with the project, on a level.

import type { Point2 } from '../../model/vector';
import type { LevelId } from '../../project/doc';

export const MEASURE_PREFIX = 'meas';

/** What an arc wall's dimension says, and at which of its lines. */
export type ArcMeasure = 'radius' | 'diameter' | 'arc';
export const ARC_MEASURES: readonly ArcMeasure[] = ['radius', 'diameter', 'arc'];
export type ArcFace = 'exterior' | 'reference' | 'interior';
export const ARC_FACES: readonly ArcFace[] = ['exterior', 'reference', 'interior'];

interface Base {
  readonly id: string;
  readonly levelId: LevelId;
}

/** The angle from the vertex between the arms through `a` and `b` (the smaller, up to 180°), its arc at `radius` (m). */
export interface AngleMeasure extends Base {
  readonly type: 'angle';
  readonly vertex: Point2;
  readonly a: Point2;
  readonly b: Point2;
  readonly radius: number;
}

/** An arc wall's radius, diameter or length, at one of its lines; the leader meets the arc `t` of the way along it (0 to 1). */
export interface WallArcMeasure extends Base {
  readonly type: ArcMeasure;
  readonly wallId: string;
  readonly face: ArcFace;
  readonly t: number;
}

/** A point's coordinates (x, y from the project's origin), written at `label`. */
export interface CoordMeasure extends Base {
  readonly type: 'coord';
  readonly at: Point2;
  readonly label: Point2;
}

export type Measure = AngleMeasure | WallArcMeasure | CoordMeasure;

export const isMeasureId = (id: string): boolean => id.startsWith(`${MEASURE_PREFIX}_`);

export const isArcMeasure = (m: Measure): m is WallArcMeasure => m.type === 'radius' || m.type === 'diameter' || m.type === 'arc';

/** The angle between two arms from a vertex, in degrees (0 to 180); 0 when an arm has no length. */
export function angleBetween(vertex: Point2, a: Point2, b: Point2): number {
  const u = { x: a.x - vertex.x, y: a.y - vertex.y };
  const v = { x: b.x - vertex.x, y: b.y - vertex.y };
  const lu = Math.hypot(u.x, u.y);
  const lv = Math.hypot(v.x, v.y);
  if (lu < 1e-9 || lv < 1e-9) return 0;
  const c = Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / (lu * lv)));
  return (Math.acos(c) * 180) / Math.PI;
}
