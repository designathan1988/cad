// The thin lines the 3D draws over the walls (ref/chat.txt:343): where the surface turns, so walls of
// one colour read apart, and so does the step of a wall standing off the face of the wall below it.
// From the side faces that show (faces.ts): those on one plane are united, and the outline of the union
// is where the surface leaves that plane. A seam inside a plane (two walls joined in line, two layers at
// an end, a face split around another block) is inside the union and draws nothing. Where the surface
// only bends a little (the segments of an arc) the line is left out too.
//
// Tops and bottoms add nothing: the blocks stand upright, so every edge of a top or a bottom that shows
// is the upper or lower edge of a side that shows, the side of its own block or of the block next to it
// that stands higher. United, the 480 tops of 160 walls took 35 ms, and as many the bottoms.

import type { Prism, PrismFaces } from './faces';

export interface Point3 {
  readonly x: number;
  readonly y: number;
  /** Height. */
  readonly z: number;
}

export interface Edge3 {
  readonly a: Point3;
  readonly b: Point3;
}

/** Faces this close in direction and offset (m) are on one plane: faces.ts's TOUCH. */
const TOUCH = 1e-4;
/** A line between two sides that turn less than this (rad, 15°) is left out: an arc's segments. */
const SMOOTH = (15 * Math.PI) / 180;
const LENGTH_EPS = 1e-6;

/** Part of a plane's faces: along the plane from its origin, and in height. */
interface Rect {
  readonly s0: number;
  readonly s1: number;
  readonly z0: number;
  readonly z1: number;
}

/** A vertical plane of side faces: its outward normal, offset from the origin, and the faces on it. */
interface Plane {
  readonly n: { readonly x: number; readonly y: number };
  readonly offset: number;
  readonly rects: Rect[];
}

/**
 * The lines to draw, from blocks and the faces of them that show (visibleFaces, in the same order).
 * Blocks on different levels should go in separate calls: each level is drawn lifted on its own.
 */
export function featureEdges(prisms: readonly Prism[], faces: readonly PrismFaces[]): Edge3[] {
  const planes: Plane[] = [];
  // Planes bucketed by rounded normal and offset, the neighbouring buckets looked at too.
  const BIN = 1e-3;
  const buckets = new Map<string, Plane[]>();
  const keyOf = (nx: number, ny: number, d: number) => `${Math.round(nx / BIN)}|${Math.round(ny / BIN)}|${Math.round(d / BIN)}`;
  const planeFor = (n: { x: number; y: number }, offset: number): Plane => {
    for (const dx of [-BIN, 0, BIN])
      for (const dy of [-BIN, 0, BIN])
        for (const dd of [-BIN, 0, BIN])
          for (const p of buckets.get(keyOf(n.x + dx, n.y + dy, offset + dd)) ?? [])
            if (Math.hypot(p.n.x - n.x, p.n.y - n.y) <= TOUCH && Math.abs(p.offset - offset) <= TOUCH) return p;
    const p: Plane = { n, offset, rects: [] };
    const key = keyOf(n.x, n.y, offset);
    buckets.set(key, [...(buckets.get(key) ?? []), p]);
    planes.push(p);
    return p;
  };
  prisms.forEach((prism, k) => {
    const sides = faces[k]?.sides ?? [];
    const poly = prism.polygon;
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const rects = sides[i] ?? [];
      if (len < LENGTH_EPS || rects.length === 0) return;
      const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
      // Counter-clockwise blocks: outward is on the right of each edge.
      const plane = planeFor({ x: u.y, y: -u.x }, u.y * a.x - u.x * a.y);
      // Along the plane: its normal turned a quarter, from the point of its line nearest the origin.
      const along = { x: -plane.n.y, y: plane.n.x };
      const sAt = (t: number) => (a.x + u.x * t) * along.x + (a.y + u.y * t) * along.y;
      for (const r of rects) {
        const [s0, s1] = [sAt(r.t0), sAt(r.t1)];
        plane.rects.push({ s0: Math.min(s0, s1), s1: Math.max(s0, s1), z0: r.z0, z1: r.z1 });
      }
    });
  });
  const out: Edge3[] = [];
  // Vertical lines by plan point: where two sides that hardly turn meet, an arc's segments.
  const verticals = new Map<string, { plane: Plane; z0: number; z1: number; x: number; y: number }[]>();
  const V = 1e4;
  const vkey = (x: number, y: number, dx = 0, dy = 0) => `${Math.round(x * V) + dx},${Math.round(y * V) + dy}`;
  for (const plane of planes) {
    const along = { x: -plane.n.y, y: plane.n.x };
    const at = (s: number) => ({ x: plane.n.x * plane.offset + along.x * s, y: plane.n.y * plane.offset + along.y * s });
    const { horizontal, vertical } = outline(plane.rects);
    for (const h of horizontal) out.push({ a: { ...at(h.from), z: h.at }, b: { ...at(h.to), z: h.at } });
    for (const v of vertical) {
      const p = at(v.at);
      const k = vkey(p.x, p.y);
      verticals.set(k, [...(verticals.get(k) ?? []), { plane, z0: v.from, z1: v.to, ...p }]);
    }
  }
  for (const list of verticals.values())
    for (const v of list) {
      // The heights where a side that turns less than SMOOTH from this one has its line here too.
      const bends: [number, number][] = [];
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (const w of verticals.get(vkey(v.x, v.y, dx, dy)) ?? []) {
            if (w.plane === v.plane || Math.hypot(w.x - v.x, w.y - v.y) > TOUCH) continue;
            const turn = Math.acos(Math.max(-1, Math.min(1, v.plane.n.x * w.plane.n.x + v.plane.n.y * w.plane.n.y)));
            if (turn < SMOOTH) bends.push([Math.max(v.z0, w.z0), Math.min(v.z1, w.z1)]);
          }
      for (const [z0, z1] of less(v.z0, v.z1, bends)) out.push({ a: { x: v.x, y: v.y, z: z0 }, b: { x: v.x, y: v.y, z: z1 } });
    }
  // A corner's line comes from both its sides: once.
  const R = 1e5;
  const hash = (p: Point3) => `${Math.round(p.x * R)},${Math.round(p.y * R)},${Math.round(p.z * R)}`;
  const once = new Map<string, Edge3>();
  for (const e of out) {
    const [ha, hb] = [hash(e.a), hash(e.b)];
    once.set(ha < hb ? `${ha}_${hb}` : `${hb}_${ha}`, e);
  }
  return [...once.values()];
}

interface Run {
  /** The line's coordinate: a height for a horizontal run, a place along the plane for a vertical one. */
  readonly at: number;
  readonly from: number;
  readonly to: number;
}

/** Coordinates closer than LENGTH_EPS as one, sorted. */
function levels(values: readonly number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.filter((v, i) => i === 0 || v - sorted[i - 1]! > LENGTH_EPS);
}

/**
 * The outline of the union of rectangles, as maximal runs: the edges between a covered cell and an
 * uncovered one of the grid their sides make, joined while they go on in line.
 */
function outline(rects: readonly Rect[]): { horizontal: Run[]; vertical: Run[] } {
  const ss = levels(rects.flatMap((r) => [r.s0, r.s1]));
  const zs = levels(rects.flatMap((r) => [r.z0, r.z1]));
  const covered = (i: number, j: number): boolean => {
    if (i < 0 || j < 0 || i + 1 >= ss.length || j + 1 >= zs.length) return false;
    const s = (ss[i]! + ss[i + 1]!) / 2;
    const z = (zs[j]! + zs[j + 1]!) / 2;
    return rects.some((r) => r.s0 <= s && r.s1 >= s && r.z0 <= z && r.z1 >= z);
  };
  const horizontal: Run[] = [];
  for (let j = 0; j < zs.length; j++) {
    let start: number | null = null;
    for (let i = 0; i <= ss.length - 1; i++) {
      const edge = i + 1 < ss.length && covered(i, j - 1) !== covered(i, j);
      if (edge && start === null) start = ss[i]!;
      if (!edge && start !== null) {
        horizontal.push({ at: zs[j]!, from: start, to: ss[i]! });
        start = null;
      }
    }
  }
  const vertical: Run[] = [];
  for (let i = 0; i < ss.length; i++) {
    let start: number | null = null;
    for (let j = 0; j <= zs.length - 1; j++) {
      const edge = j + 1 < zs.length && covered(i - 1, j) !== covered(i, j);
      if (edge && start === null) start = zs[j]!;
      if (!edge && start !== null) {
        vertical.push({ at: ss[i]!, from: start, to: zs[j]! });
        start = null;
      }
    }
  }
  return { horizontal, vertical };
}

/** [z0, z1] less the intervals in `cuts`, as intervals longer than LENGTH_EPS. */
function less(z0: number, z1: number, cuts: readonly [number, number][]): [number, number][] {
  let parts: [number, number][] = [[z0, z1]];
  for (const [c0, c1] of cuts) {
    if (c1 - c0 < LENGTH_EPS) continue;
    parts = parts.flatMap(([a, b]): [number, number][] => [
      ...(c0 > a ? [[a, Math.min(b, c0)] as [number, number]] : []),
      ...(c1 < b ? [[Math.max(a, c1), b] as [number, number]] : []),
    ]);
  }
  return parts.filter(([a, b]) => b - a > LENGTH_EPS);
}
