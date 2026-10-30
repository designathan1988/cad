// Arc walls as chains of straight segments (spec §5.2, ADR 0001).
//
// The chords of concentric circles between the same two angles are parallel, at distance R·cos(Δ/2)
// from the centre. So each angular segment of an arc wall is exactly a straight wall whose layer
// offsets are the arc's scaled by cos(Δ/2), and two neighbouring segments meet on the radial line:
// the join engine's own miter between them falls on it, and the chain tiles the arc with no gap. The
// segment count depends only on the wall (ARC_SAG), never on the view.

import { ARC_SAG } from '../../../model/tolerance';
import { add, distance, dot, normalize, perp, type Point2, scale, sub, vec } from '../../../model/vector';
import { type HalfPlane, halfPlaneThrough } from './convex';
import type { WallShape } from './shape';

const MAX_SEGMENTS = 2048;

export interface Arc {
  readonly center: Point2;
  /** Radius of the reference line. */
  readonly radius: number;
  readonly startAngle: number;
  /** Signed sweep: positive counter-clockwise. */
  readonly sweep: number;
  /** +1 counter-clockwise, −1 clockwise: offset o along the wall's left normal is radius r − turn·o. */
  readonly turn: 1 | -1;
}

/** The circle through the wall's ends with its bulge, or null for a straight wall. */
export function arcOf(w: Pick<WallShape, 'start' | 'end' | 'bulge'>): Arc | null {
  const c = distance(w.start, w.end);
  if (w.bulge === 0 || c === 0) return null;
  const d = normalize(sub(w.end, w.start));
  const left = perp(d);
  const mid = scale(add(w.start, w.end), 0.5);
  const s = (w.bulge * c) / 2; // signed sagitta
  const radius = (c * c) / 4 / (2 * Math.abs(s)) + Math.abs(s) / 2;
  // A positive bulge runs counter-clockwise and bulges to the right of the chord, centre on the left.
  const arcMid = sub(mid, scale(left, s));
  const center = add(arcMid, scale(left, Math.sign(w.bulge) * radius));
  return {
    center,
    radius,
    startAngle: Math.atan2(w.start.y - center.y, w.start.x - center.x),
    sweep: 4 * Math.atan(w.bulge),
    turn: w.bulge > 0 ? 1 : -1,
  };
}

export const pointAt = (a: Arc, angle: number, radius = a.radius): Point2 =>
  add(a.center, vec(radius * Math.cos(angle), radius * Math.sin(angle)));

/** Unit tangent in the drawing direction at an angle. */
export const tangentAt = (a: Arc, angle: number): Point2 => scale(vec(-Math.sin(angle), Math.cos(angle)), a.turn);

/** Face radii from the wall's offsets: offset o along the left normal is radius r − turn·o. */
export const radiusOf = (a: Arc, offset: number): number => a.radius - a.turn * offset;

export function segmentCount(a: Arc, faceOffsets: readonly number[]): number {
  const rMax = Math.max(...faceOffsets.map((o) => radiusOf(a, o)));
  const step = 2 * Math.acos(Math.max(-1, 1 - ARC_SAG / rMax));
  return Math.min(MAX_SEGMENTS, Math.max(1, Math.ceil(Math.abs(a.sweep) / step)));
}

export interface ArcChain {
  readonly arc: Arc;
  /** Straight segments in drawing order; ids `${wall}#${k}`. */
  readonly segments: readonly WallShape[];
  /** Radial cuts at the chain's two free ends, keeping the wall's side. */
  readonly startCap: HalfPlane;
  readonly endCap: HalfPlane;
}

export const SEGMENT_MARK = '#';
export const parentOf = (id: string): string => {
  const k = id.lastIndexOf(SEGMENT_MARK);
  return k === -1 ? id : id.slice(0, k);
};

/** The chain, or 'arcTooTight' when a face would have a radius of zero or less. */
export function expandArc(w: WallShape): ArcChain | 'arcTooTight' {
  const a = arcOf(w);
  if (a === null) throw new Error(`expandArc called on a straight wall ${w.id}`);
  if (Math.min(...w.layerOffsets.map((o) => radiusOf(a, o))) <= 0) return 'arcTooTight';
  const n = segmentCount(a, w.layerOffsets);
  const step = a.sweep / n;
  const k = Math.cos(step / 2);
  const angle = (i: number) => a.startAngle + step * i;
  const segments: WallShape[] = [];
  for (let i = 0; i < n; i++) {
    segments.push({
      ...w,
      id: `${w.id}${SEGMENT_MARK}${i}`,
      bulge: 0,
      // The chain's ends are the wall's own points, exactly: joins at them must meet other ends.
      start: i === 0 ? w.start : pointAt(a, angle(i)),
      end: i === n - 1 ? w.end : pointAt(a, angle(i + 1)),
      thickness: w.thickness * k,
      layerOffsets: w.layerOffsets.map((o) => o * k),
      core: [w.core[0] * k, w.core[1] * k],
    });
  }
  const end = angle(n);
  return {
    arc: a,
    segments,
    startCap: halfPlaneThrough(a.center, tangentAt(a, a.startAngle)),
    endCap: halfPlaneThrough(a.center, scale(tangentAt(a, end), -1)),
  };
}

/** The radial half-planes bounding segment `i` of a chain: its angular sector. */
export function sectorOf(chain: ArcChain, i: number): readonly HalfPlane[] {
  const { arc } = chain;
  const step = arc.sweep / chain.segments.length;
  const a0 = arc.startAngle + step * i;
  const a1 = a0 + step;
  return [halfPlaneThrough(arc.center, tangentAt(arc, a0)), halfPlaneThrough(arc.center, scale(tangentAt(arc, a1), -1))];
}

export const inSector = (planes: readonly HalfPlane[], p: Point2, slack = 1e-9): boolean =>
  planes.every((h) => dot(h.normal, p) <= h.offset + slack);
