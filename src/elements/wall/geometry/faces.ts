// Which faces of the walls' 3D blocks show (spec §8, "faces de corte"). The blocks are disjoint
// prisms; where two touch, the faces between them are inside the solid and are not drawn: a join
// between walls, the line between two layers, a slice or an opening band on top of another. What is
// left is the outside: a wall's faces, its free ends with their layers, the jambs and heads of
// openings, and the part of a joined end that stands above a lower neighbour (§7.5).
//
// Decided by the geometry alone, not by tags from the joins: a side face is hidden exactly where
// another block's side lies on the same plane, facing it, over the same heights; a top or a bottom
// where another block's bottom or top lies on it.

import { AREA_EPSILON } from '../../../model/tolerance';
import { FACE_TOUCH, LENGTH_EPS } from '../../../model/tolerance';
import type { Point2 } from '../../../model/vector';
import { area, clipOut, type ConvexPolygon, halfPlaneThrough, type HalfPlane } from './convex';

export interface Prism {
  readonly polygon: ConvexPolygon;
  readonly bottom: number;
  readonly top: number;
}

/** Part of a side face: along its edge from the edge's first vertex (m), and in height. */
export interface FaceRect {
  readonly t0: number;
  readonly t1: number;
  readonly z0: number;
  readonly z1: number;
}

export interface PrismFaces {
  /** Per edge of the polygon (edge i runs from vertex i to i + 1): the parts of its side that show. */
  readonly sides: readonly (readonly FaceRect[])[];
  /** The parts of the top and of the bottom that show, convex. */
  readonly top: readonly ConvexPolygon[];
  readonly bottom: readonly ConvexPolygon[];
}

/** Two faces closer than this, on planes this close in angle, touch (m; about 0.1 mm over 1 m). */

const regionOf = (poly: ConvexPolygon): HalfPlane[] =>
  poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    return halfPlaneThrough(p, { x: -(q.y - p.y), y: q.x - p.x });
  });

/** The rectangle less the rectangles cut from it, as rectangles: cells of the grid of their edges. */
function subtract(whole: FaceRect, cuts: readonly FaceRect[]): FaceRect[] {
  if (cuts.length === 0) return [whole];
  const ts = [...new Set([whole.t0, whole.t1, ...cuts.flatMap((c) => [c.t0, c.t1])])].filter((t) => t >= whole.t0 && t <= whole.t1).sort((a, b) => a - b);
  const zs = [...new Set([whole.z0, whole.z1, ...cuts.flatMap((c) => [c.z0, c.z1])])].filter((z) => z >= whole.z0 && z <= whole.z1).sort((a, b) => a - b);
  const out: FaceRect[] = [];
  for (let j = 0; j + 1 < zs.length; j++) {
    const z0 = zs[j]!;
    const z1 = zs[j + 1]!;
    if (z1 - z0 < LENGTH_EPS) continue;
    let run: FaceRect | null = null;
    for (let i = 0; i + 1 < ts.length; i++) {
      const t0 = ts[i]!;
      const t1 = ts[i + 1]!;
      if (t1 - t0 < LENGTH_EPS) continue;
      const tm = (t0 + t1) / 2;
      const zm = (z0 + z1) / 2;
      const covered = cuts.some((c) => c.t0 <= tm && c.t1 >= tm && c.z0 <= zm && c.z1 >= zm);
      if (covered) {
        if (run) out.push(run);
        run = null;
      } else run = run ? { t0: run.t0, t1, z0: run.z0, z1: run.z1 } : { t0, t1, z0, z1 };
    }
    if (run) out.push(run);
  }
  // Rows with the same span, one above the other, are one rectangle.
  const merged: FaceRect[] = [];
  for (const r of out) {
    const below = merged.find((m) => Math.abs(m.t0 - r.t0) < LENGTH_EPS && Math.abs(m.t1 - r.t1) < LENGTH_EPS && Math.abs(m.z1 - r.z0) < LENGTH_EPS);
    if (below) merged[merged.indexOf(below)] = { ...below, z1: r.z1 };
    else merged.push(r);
  }
  return merged;
}

interface Edge {
  readonly prism: number;
  readonly index: number;
  readonly a: Point2;
  readonly dir: Point2;
  readonly length: number;
}

export function visibleFaces(prisms: readonly Prism[]): PrismFaces[] {
  // Edges bucketed by their line, so only edges that can lie on the same plane are compared: the
  // line's direction (folded to half a turn: facing edges run opposite ways) and its distance from
  // the origin, each rounded, with the neighbouring buckets looked at too.
  const ANGLE_BIN = 1e-3;
  const OFFSET_BIN = 1e-3;
  const edges: Edge[] = [];
  const buckets = new Map<string, Edge[]>();
  const keyOf = (e: Edge, da = 0, dob = 0) => {
    let ang = Math.atan2(e.dir.y, e.dir.x);
    let off = e.dir.x * e.a.y - e.dir.y * e.a.x;
    if (ang < 0) {
      ang += Math.PI;
      off = -off;
    }
    if (ang >= Math.PI - ANGLE_BIN / 2) {
      ang -= Math.PI;
      off = -off;
    }
    return `${Math.round(ang / ANGLE_BIN) + da}|${Math.round(off / OFFSET_BIN) + dob}`;
  };
  prisms.forEach((p, k) =>
    p.polygon.forEach((a, i) => {
      const b = p.polygon[(i + 1) % p.polygon.length]!;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < LENGTH_EPS) return;
      const e: Edge = { prism: k, index: i, a, dir: { x: (b.x - a.x) / length, y: (b.y - a.y) / length }, length };
      edges.push(e);
      const key = keyOf(e);
      buckets.set(key, [...(buckets.get(key) ?? []), e]);
    }),
  );
  const sides: FaceRect[][][] = prisms.map((p) => p.polygon.map(() => []));
  for (const e of edges) {
    const me = prisms[e.prism]!;
    const cuts: FaceRect[] = [];
    const seen = new Set<Edge>();
    for (const da of [-1, 0, 1])
      for (const dob of [-1, 0, 1])
        for (const o of buckets.get(keyOf(e, da, dob)) ?? []) {
          if (seen.has(o) || o.prism === e.prism) continue;
          seen.add(o);
          // Facing: opposite directions, on the same line.
          if (e.dir.x * o.dir.x + e.dir.y * o.dir.y > -1 + FACE_TOUCH) continue;
          const rel = { x: o.a.x - e.a.x, y: o.a.y - e.a.y };
          if (Math.abs(e.dir.x * rel.y - e.dir.y * rel.x) > FACE_TOUCH) continue;
          const s0 = e.dir.x * rel.x + e.dir.y * rel.y;
          const s1 = s0 - o.length;
          const t0 = Math.max(0, Math.min(s0, s1));
          const t1 = Math.min(e.length, Math.max(s0, s1));
          const other = prisms[o.prism]!;
          const z0 = Math.max(me.bottom, other.bottom);
          const z1 = Math.min(me.top, other.top);
          if (t1 - t0 > LENGTH_EPS && z1 - z0 > LENGTH_EPS) cuts.push({ t0, t1, z0, z1 });
        }
    sides[e.prism]![e.index] = subtract({ t0: 0, t1: e.length, z0: me.bottom, z1: me.top }, cuts);
  }
  // Tops and bottoms: less every block whose bottom (or top) is at this height.
  const caps = (k: number, z: number, touching: (q: Prism) => number) => {
    let parts: ConvexPolygon[] = [prisms[k]!.polygon];
    prisms.forEach((q, j) => {
      if (j === k || Math.abs(touching(q) - z) > FACE_TOUCH) return;
      const region = regionOf(q.polygon);
      parts = parts.flatMap((p) => clipOut(p, region));
    });
    return parts.filter((p) => area(p) > AREA_EPSILON);
  };
  return prisms.map((p, k) => ({ sides: sides[k]!, top: caps(k, p.top, (q) => q.bottom), bottom: caps(k, p.bottom, (q) => q.top) }));
}
