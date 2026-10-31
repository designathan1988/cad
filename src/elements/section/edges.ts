// The lines of a section: a mesh's feature edges, rings and segments clipped to the cut, and the
// outline and loops a set of segments makes.

import type { Point3 } from '../../model/section-box';
import type { Point2 } from '../../model/vector';

/** Keys to a tenth of a millimetre: the same point read twice is one. */
export const Q = 1e4;

export const key3 = (p: Point3) => `${Math.round(p.x * Q)},${Math.round(p.y * Q)},${Math.round(p.z * Q)}`;

export const sub3 = (a: Point3, b: Point3): Point3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

export const dot3 = (a: Point3, b: Point3) => a.x * b.x + a.y * b.y + a.z * b.z;

export const cross3 = (a: Point3, b: Point3): Point3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

export const unit3 = (a: Point3): Point3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

/** Smoother than this turn (cos 20°) is one face. */
export const SMOOTH = Math.cos((20 * Math.PI) / 180);

/**
 * The parts of each triangle's edges that are lines: of an edge, what no other face of its group goes on
 * from (a face beyond it, its other side within 20°). Per triangle, per edge, the stretches [t0, t1] of
 * it (0 at its start, 1 at its end).
 */
export function featureEdges(tris: readonly (readonly [Point3, Point3, Point3])[]): (readonly (readonly [number, number])[])[][] {
  // Each edge as a stretch of a line: its line's key, its interval along it, and the way into its face.
  type Occ = { tri: number; edge: number; t0: number; t1: number; flip: boolean; into: Point3 };
  const lines = new Map<string, Occ[]>();
  const result: (readonly (readonly [number, number])[])[][] = tris.map(() => [[], [], []]);
  tris.forEach((t, ti) => {
    const normal = cross3(sub3(t[1], t[0]), sub3(t[2], t[0]));
    if (Math.hypot(normal.x, normal.y, normal.z) < 1e-12) return;
    for (let e = 0; e < 3; e++) {
      const a = t[e]!;
      const b = t[(e + 1) % 3]!;
      const c = t[(e + 2) % 3]!;
      let d = sub3(b, a);
      const len = Math.hypot(d.x, d.y, d.z);
      if (len < 1e-9) continue;
      d = unit3(d);
      // The line's direction one way round, whichever way the edge runs.
      const flip = d.x < -1e-9 || (Math.abs(d.x) <= 1e-9 && (d.y < -1e-9 || (Math.abs(d.y) <= 1e-9 && d.z < 0)));
      const u = flip ? { x: -d.x, y: -d.y, z: -d.z } : d;
      const foot = sub3(a, { x: u.x * dot3(a, u), y: u.y * dot3(a, u), z: u.z * dot3(a, u) });
      const k = `${Math.round(u.x * Q)},${Math.round(u.y * Q)},${Math.round(u.z * Q)}|${key3(foot)}`;
      const ta = dot3(a, u);
      const tb = dot3(b, u);
      // Into the face: square to the edge, toward its third corner.
      const ac = sub3(c, a);
      const into = unit3(sub3(ac, { x: d.x * dot3(ac, d), y: d.y * dot3(ac, d), z: d.z * dot3(ac, d) }));
      const list = lines.get(k) ?? [];
      list.push({ tri: ti, edge: e, t0: Math.min(ta, tb), t1: Math.max(ta, tb), flip: ta > tb, into });
      lines.set(k, list);
    }
  });
  for (const list of lines.values()) {
    for (const o of list) {
      // What goes on from it: faces on the line whose way in is (nearly) the opposite of its own.
      const covers = list.filter((x) => x !== o && dot3(x.into, o.into) < -SMOOTH && x.t1 > o.t0 && x.t0 < o.t1).map((x) => [Math.max(x.t0, o.t0), Math.min(x.t1, o.t1)] as const);
      covers.sort((p, q) => p[0] - q[0]);
      const free: [number, number][] = [];
      let at = o.t0;
      for (const [c0, c1] of covers) {
        if (c0 > at + 1e-7) free.push([at, c0]);
        at = Math.max(at, c1);
      }
      if (o.t1 > at + 1e-7) free.push([at, o.t1]);
      // As fractions of the edge from its own start.
      const span = o.t1 - o.t0;
      result[o.tri]![o.edge] = free.map(([p, q]) => {
        const f0 = (p - o.t0) / span;
        const f1 = (q - o.t0) / span;
        return o.flip ? ([1 - f1, 1 - f0] as const) : ([f0, f1] as const);
      });
    }
  }
  return result;
}

/** A vertex in the drawing's frame: along the line, beyond it, up. */
export type V = { readonly s: number; readonly d: number; readonly z: number };

/** A clipped polygon's vertices, each with what the edge from it is: 0 nothing, 1 an edge of the face, 2 the cut. */
export type Ring = { v: V; f: 0 | 1 | 2 }[];

/** The ring kept where `side(v)` ≥ 0, the new edges along the clip marked `mark`. */
export function clipRing(ring: Ring, side: (v: V) => number, mark: 0 | 2): Ring {
  const out: Ring = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    const sp = side(p.v);
    const sq = side(q.v);
    const inP = sp >= 0;
    const inQ = sq >= 0;
    if (inP) out.push({ v: p.v, f: p.f });
    if (inP !== inQ) {
      const k = sp / (sp - sq);
      const v = { s: p.v.s + (q.v.s - p.v.s) * k, d: p.v.d + (q.v.d - p.v.d) * k, z: p.v.z + (q.v.z - p.v.z) * k };
      out.push({ v, f: inQ ? p.f : mark });
    }
  }
  return out;
}

/** A segment's part where `side` ≥ 0, as fractions [0, 1] of it; null when none. */
export function clipSegment(a: V, b: V, sides: readonly ((v: V) => number)[]): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  for (const side of sides) {
    const sa = side(a);
    const sb = side(b);
    if (sa < 0 && sb < 0) return null;
    if (sa < 0) t0 = Math.max(t0, sa / (sa - sb));
    else if (sb < 0) t1 = Math.min(t1, sa / (sa - sb));
  }
  return t1 - t0 > 1e-9 ? [t0, t1] : null;
}

/**
 * The outline of what is cut: of the cut segments, the stretches only one piece cuts. Where two pieces
 * meet (a wall's layers side by side, its blocks one over another, two walls end to end) both cut the
 * same line, each in stretches of its own (its faces' triangles split it elsewhere): inside the cut, not
 * its outline. Worked out on each line, the stretches counted.
 */
export function outlineOf(segments: readonly (readonly [Point2, Point2])[]): [Point2, Point2][] {
  const lines = new Map<string, { d: Point2; offset: number; spans: [number, number][] }>();
  for (const [a, b] of segments) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-7) continue;
    let d = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    if (d.x < -1e-9 || (Math.abs(d.x) <= 1e-9 && d.y < 0)) d = { x: -d.x, y: -d.y };
    const offset = d.x * a.y - d.y * a.x;
    const k = `${Math.round(d.x * Q)},${Math.round(d.y * Q)},${Math.round(offset * Q)}`;
    const line = lines.get(k) ?? { d, offset, spans: [] };
    const ta = a.x * d.x + a.y * d.y;
    const tb = b.x * d.x + b.y * d.y;
    line.spans.push([Math.min(ta, tb), Math.max(ta, tb)]);
    lines.set(k, line);
  }
  const out: [Point2, Point2][] = [];
  for (const { d, offset, spans } of lines.values()) {
    const at = (t: number): Point2 => ({ x: -d.y * offset + d.x * t, y: d.x * offset + d.y * t });
    const cuts = [...new Set(spans.flat())].sort((p, q) => p - q).filter((t, i, all) => i === 0 || t - all[i - 1]! > 1e-7);
    let from: number | null = null;
    for (let i = 0; i + 1 < cuts.length; i++) {
      const lo = cuts[i]!;
      const hi = cuts[i + 1]!;
      const n = spans.filter(([s0, s1]) => s0 <= lo + 1e-7 && s1 >= hi - 1e-7).length;
      if (n === 1) from ??= lo;
      else if (from !== null) {
        out.push([at(from), at(lo)]);
        from = null;
      }
    }
    if (from !== null) out.push([at(from), at(cuts.at(-1)!)]);
  }
  return out;
}

/** The closed outlines the cut segments make, end to end (an open run left out of the fill). */
export function loopsOf(segments: readonly (readonly [Point2, Point2])[]): Point2[][] {
  const k = (p: Point2) => `${Math.round(p.x * Q)},${Math.round(p.y * Q)}`;
  const from = new Map<string, number[]>();
  segments.forEach(([a, b], i) => {
    for (const p of [a, b]) {
      const list = from.get(k(p)) ?? [];
      list.push(i);
      from.set(k(p), list);
    }
  });
  const used = new Set<number>();
  const loops: Point2[][] = [];
  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const loop: Point2[] = [segments[i]![0], segments[i]![1]];
    const first = k(loop[0]!);
    let closed = false;
    for (let guard = 0; guard < segments.length; guard++) {
      const end = loop.at(-1)!;
      if (k(end) === first) {
        closed = true;
        loop.pop();
        break;
      }
      const next = (from.get(k(end)) ?? []).find((j) => !used.has(j));
      if (next === undefined) break;
      used.add(next);
      const [a, b] = segments[next]!;
      loop.push(k(a) === k(end) ? b : a);
    }
    if (closed && loop.length >= 3) loops.push(loop);
  }
  return loops;
}
