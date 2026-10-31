// Where a measure stands now, from the document: an angle's arc, an arc wall's circle at the chosen line
// (gone with the wall, or when it is straight again), a coordinate's point. And the arc wall under a point,
// for the tool. Pure.

import type { Doc } from '../../project/doc';
import type { Point2 } from '../../model/vector';
import { arcOf } from '../wall/geometry/arc';
import { shapeOf } from '../wall/geometry/shape';
import type { DocWall } from '../../project/doc';
import { angleBetween, type ArcFace, type Measure } from './schema';
import type { LevelId } from '../../project/doc';

/** An arc wall's circle at a line: its centre, radius, the angle its start is at and its signed sweep. */
export interface PlacedArc {
  readonly center: Point2;
  readonly radius: number;
  readonly start: number;
  readonly sweep: number;
}

export type Placed =
  | { readonly type: 'angle'; readonly vertex: Point2; readonly radius: number; readonly start: number; readonly sweep: number; readonly value: number; readonly arms: readonly [number, number] }
  | { readonly type: 'radius' | 'diameter' | 'arc'; readonly arc: PlacedArc; readonly at: number; readonly value: number }
  | { readonly type: 'coord'; readonly at: Point2; readonly label: Point2 };

/** The circle of a wall's line: its reference line, or a face (the radius moved by the face's offset). */
export function wallArc(doc: Doc, w: DocWall, face: ArcFace): PlacedArc | null {
  const shape = shapeOf(w, doc.wallTypes.find((x) => x.id === w.wallTypeId));
  if (typeof shape === 'string') return null;
  const arc = arcOf(shape);
  if (!arc) return null;
  const offset = face === 'reference' ? 0 : face === 'exterior' ? shape.layerOffsets[0]! : shape.layerOffsets[shape.layerOffsets.length - 1]!;
  const radius = arc.radius - arc.turn * offset;
  return radius > 1e-6 ? { center: arc.center, radius, start: arc.startAngle, sweep: arc.sweep } : null;
}

/** How far along an arc (0 to 1) the radial line through a point falls; null outside its sweep. */
export function alongArc(a: PlacedArc, p: Point2): number | null {
  const ang = Math.atan2(p.y - a.center.y, p.x - a.center.x);
  const tau = 2 * Math.PI;
  const d = (((a.sweep >= 0 ? ang - a.start : a.start - ang) % tau) + tau) % tau;
  const t = d / Math.abs(a.sweep);
  return t <= 1 + 1e-9 ? Math.min(1, t) : null;
}

export function placeMeasure(doc: Doc, m: Measure): Placed | null {
  if (m.type === 'angle') {
    const value = angleBetween(m.vertex, m.a, m.b);
    if (value <= 1e-6) return null;
    const ua = Math.atan2(m.a.y - m.vertex.y, m.a.x - m.vertex.x);
    const ub = Math.atan2(m.b.y - m.vertex.y, m.b.x - m.vertex.x);
    // The short way from a to b: counter-clockwise when b is within 180° of a that way.
    let sweep = ub - ua;
    while (sweep <= -Math.PI) sweep += 2 * Math.PI;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    const arms: [number, number] = [Math.hypot(m.a.x - m.vertex.x, m.a.y - m.vertex.y), Math.hypot(m.b.x - m.vertex.x, m.b.y - m.vertex.y)];
    return { type: 'angle', vertex: m.vertex, radius: m.radius, start: ua, sweep, value, arms };
  }
  if (m.type === 'coord') return { type: 'coord', at: m.at, label: m.label };
  const w = doc.walls.find((x) => x.id === m.wallId);
  const arc = w ? wallArc(doc, w, m.face) : null;
  if (!arc) return null;
  const value = m.type === 'radius' ? arc.radius : m.type === 'diameter' ? 2 * arc.radius : Math.abs(arc.sweep) * arc.radius;
  return { type: m.type, arc, at: arc.start + Math.max(0, Math.min(1, m.t)) * arc.sweep, value };
}

/**
 * The arc wall on a level under a point (within `near` of its faces), with the line nearest the point and
 * how far along the arc it is; null when there is none.
 */
export function arcWallAt(doc: Doc, levelId: LevelId, p: Point2, near: number): { wallId: string; face: ArcFace; t: number } | null {
  let best: { wallId: string; face: ArcFace; t: number; d: number } | null = null;
  for (const w of doc.walls) {
    if (w.levelId !== levelId || !w.bulge) continue;
    const lines = (['exterior', 'reference', 'interior'] as const).flatMap((face) => {
      const a = wallArc(doc, w, face);
      return a ? [{ face, a }] : [];
    });
    if (lines.length === 0) continue;
    const t = alongArc(lines[0]!.a, p);
    if (t === null) continue;
    const r = Math.hypot(p.x - lines[0]!.a.center.x, p.y - lines[0]!.a.center.y);
    const radii = lines.map((l) => l.a.radius);
    // On the wall: between its faces, or near one.
    if (r < Math.min(...radii) - near || r > Math.max(...radii) + near) continue;
    const nearest = lines.reduce((m, l) => (Math.abs(l.a.radius - r) < Math.abs(m.a.radius - r) ? l : m));
    const d = Math.abs(nearest.a.radius - r);
    if (!best || d < best.d) best = { wallId: w.id, face: nearest.face, t, d };
  }
  return best && { wallId: best.wallId, face: best.face, t: best.t };
}
