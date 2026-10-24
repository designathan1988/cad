// Independent oracle. Shares no geometry code with the engine: its own vector math, its own
// face construction, ray-crossing containment. The spec constants are written here on purpose,
// so loosening src/core/tolerance.ts without updating the spec breaks these tests.

import { computeWallGeometry } from '../../../src/elements/wall/geometry/footprint';
import type { Wall, WallEnd } from '../../../src/elements/wall/schema';

const SPEC_COLLINEAR_DEG = 0.6;
const SPEC_MITER_LIMIT = 10;

export interface P {
  readonly x: number;
  readonly y: number;
}
const pt = (x: number, y: number): P => ({ x, y });
const plus = (a: P, b: P) => pt(a.x + b.x, a.y + b.y);
const minus = (a: P, b: P) => pt(a.x - b.x, a.y - b.y);
const times = (a: P, s: number) => pt(a.x * s, a.y * s);
const dotp = (a: P, b: P) => a.x * b.x + a.y * b.y;
const norm = (a: P) => Math.sqrt(a.x * a.x + a.y * a.y);
const unit = (a: P) => times(a, 1 / norm(a));
const mid = (a: P, b: P) => pt((a.x + b.x) / 2, (a.y + b.y) / 2);

export function frameOf(w: Wall) {
  const span = minus(w.end, w.start);
  const d = unit(span);
  const n = pt(-d.y, d.x);
  const t = w.thickness;
  const [o0, o1] =
    w.referenceLine === 'centerline' ? [-t / 2, t / 2] : w.referenceLine === 'exteriorFace' ? [0, t] : [-t, 0];
  return { d, n, o0: o0!, o1: o1!, len: norm(span) };
}

/** Point on the line p + s·u where it meets q + r·w (Cramer). */
function meet(p: P, u: P, q: P, w: P): P | null {
  const det = u.x * -w.y - u.y * -w.x;
  if (Math.abs(det) < 1e-300) return null;
  const rx = q.x - p.x;
  const ry = q.y - p.y;
  const s = (rx * -w.y - ry * -w.x) / det;
  return pt(p.x + u.x * s, p.y + u.y * s);
}

export function shoelace(poly: readonly P[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** Even-odd ray crossing. */
export function inside(poly: readonly P[], p: P): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

function segDistance(p: P, a: P, b: P): number {
  const ab = minus(b, a);
  const l2 = dotp(ab, ab);
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, dotp(minus(p, a), ab) / l2));
  return norm(minus(p, plus(a, times(ab, t))));
}

const edgesOf = (poly: readonly P[]): [P, P][] => poly.map((a, i) => [a, poly[(i + 1) % poly.length]!]);

export interface Region {
  readonly area: number;
  readonly contains: (p: P) => boolean;
  readonly edges: readonly [P, P][];
}

const polygonRegion = (poly: readonly P[]): Region => ({
  area: shoelace(poly),
  contains: (p) => inside(poly, p),
  edges: edgesOf(poly),
});

const disjointUnion = (...rs: Region[]): Region => ({
  area: rs.reduce((s, r) => s + r.area, 0),
  contains: (p) => rs.some((r) => r.contains(p)),
  edges: rs.flatMap((r) => r.edges),
});

export const into = (w: Wall, end: WallEnd) => times(frameOf(w).d, end === 'start' ? 1 : -1);
const at = (w: Wall, end: WallEnd) => (end === 'start' ? w.start : w.end);
const far = (w: Wall, end: WallEnd) => (end === 'start' ? w.end : w.start);
const onFace = (w: Wall, base: P, offset: number) => plus(base, times(frameOf(w).n, offset));
const faceMeets = (w: Wall, offset: number, q: P, dir: P) =>
  meet(onFace(w, w.start, offset), frameOf(w).d, q, dir);

export type CornerKind = 'miter' | 'bevel' | 'shared' | 'overlap';

export interface CornerSpec {
  readonly kind: CornerKind;
  readonly node: P;
  readonly inner: P | null;
  readonly outer: P | null;
  readonly aOuter: number;
  readonly aInner: number;
  readonly bOuter: number;
  readonly bInner: number;
}

/**
 * Classifies an L exactly as the spec (docs/wall-joins-spec.md §7.1, §10) describes it. `node` is
 * the meeting point: by default the midpoint of the two ends.
 */
export function cornerSpec(a: Wall, aEnd: WallEnd, b: Wall, bEnd: WallEnd, at0?: P): CornerSpec {
  const fa = frameOf(a);
  const fb = frameOf(b);
  const ua = into(a, aEnd);
  const ub = into(b, bEnd);
  const node = at0 ?? mid(at(a, aEnd), at(b, bEnd));
  const angle = (Math.acos(Math.max(-1, Math.min(1, dotp(ua, ub)))) * 180) / Math.PI;
  const bLeft = dotp(fa.n, ub) > 0;
  const aLeft = dotp(fb.n, ua) > 0;
  const base = {
    node,
    aInner: bLeft ? fa.o1 : fa.o0,
    aOuter: bLeft ? fa.o0 : fa.o1,
    bInner: aLeft ? fb.o1 : fb.o0,
    bOuter: aLeft ? fb.o0 : fb.o1,
  };
  if (angle < SPEC_COLLINEAR_DEG) return { ...base, kind: 'overlap', inner: null, outer: null };
  // Ends that overran each other, crossing far from both ends, run side by side: an overlap.
  const reach = SPEC_MITER_LIMIT * Math.max(a.thickness, b.thickness);
  if (at0 && (norm(minus(at(a, aEnd), at0)) > reach || norm(minus(at(b, bEnd), at0)) > reach)) {
    return { ...base, kind: 'overlap', inner: null, outer: null };
  }
  if (angle > 180 - SPEC_COLLINEAR_DEG) return { ...base, kind: 'shared', inner: null, outer: null };
  const inner = meet(onFace(a, a.start, base.aInner), fa.d, onFace(b, b.start, base.bInner), fb.d);
  const outer = meet(onFace(a, a.start, base.aOuter), fa.d, onFace(b, b.start, base.bOuter), fb.d);
  if (!inner || !outer) return { ...base, kind: 'shared', inner: null, outer: null };
  const reachA = dotp(minus(far(a, aEnd), node), ua);
  const reachB = dotp(minus(far(b, bEnd), node), ub);
  const past = (c: P) => dotp(minus(c, node), ua) > reachA || dotp(minus(c, node), ub) > reachB;
  if (past(inner) || past(outer)) return { ...base, kind: 'overlap', inner, outer };
  const limit = SPEC_MITER_LIMIT * Math.max(a.thickness, b.thickness);
  const spread = Math.max(norm(minus(inner, node)), norm(minus(outer, node)));
  if (angle >= 90 && spread > limit) return { ...base, kind: 'shared', inner: null, outer: null };
  return { ...base, kind: norm(minus(outer, node)) > limit ? 'bevel' : 'miter', inner, outer };
}

/** Exact region an isolated L must cover, or 'overlap' when the spec says it warns instead. */
export function expectedL(a: Wall, aEnd: WallEnd, b: Wall, bEnd: WallEnd, node?: P): Region | 'overlap' {
  const c = cornerSpec(a, aEnd, b, bEnd, node);
  if (c.kind === 'overlap') return 'overlap';
  if (c.kind === 'shared') {
    const across = unit(minus(into(a, aEnd), into(b, bEnd)));
    const along = pt(-across.y, across.x);
    const quad = (w: Wall, end: WallEnd) => {
      const f = frameOf(w);
      return [
        onFace(w, far(w, end), f.o0),
        onFace(w, far(w, end), f.o1),
        faceMeets(w, f.o1, c.node, along)!,
        faceMeets(w, f.o0, c.node, along)!,
      ];
    };
    return disjointUnion(polygonRegion(quad(a, aEnd)), polygonRegion(quad(b, bEnd)));
  }
  let tip: P[] = [c.outer!];
  if (c.kind === 'bevel') {
    const w = unit(minus(c.outer!, c.node));
    const cutAt = plus(c.node, times(w, SPEC_MITER_LIMIT * Math.max(a.thickness, b.thickness)));
    const along = pt(-w.y, w.x);
    tip = [faceMeets(a, c.aOuter, cutAt, along)!, faceMeets(b, c.bOuter, cutAt, along)!];
  }
  return polygonRegion([
    onFace(a, far(a, aEnd), c.aOuter),
    ...tip,
    onFace(b, far(b, bEnd), c.bOuter),
    onFace(b, far(b, bEnd), c.bInner),
    c.inner!,
    onFace(a, far(a, aEnd), c.aInner),
  ]);
}

/** The host face the abutting wall's body leaves through. */
export function nearFace(abutting: Wall, end: WallEnd, host: Wall): { offset: number; inward: P } {
  const fh = frameOf(host);
  const pos = dotp(fh.n, into(abutting, end)) > 0;
  return { offset: pos ? fh.o1 : fh.o0, inward: pos ? fh.n : times(fh.n, -1) };
}

export function rectOf(w: Wall): P[] {
  const f = frameOf(w);
  return [onFace(w, w.start, f.o0), onFace(w, w.end, f.o0), onFace(w, w.end, f.o1), onFace(w, w.start, f.o1)];
}

/** Part of a convex polygon on the side of the line through `through` that `inward` points to. */
function keepSide(poly: readonly P[], through: P, inward: P): P[] {
  const out: P[] = [];
  const d = poly.map((p) => dotp(minus(p, through), inward));
  poly.forEach((p, i) => {
    const j = (i + 1) % poly.length;
    if (d[i]! >= 0) out.push(p);
    if (d[i]! * d[j]! < 0) out.push(plus(p, times(minus(poly[j]!, p), d[i]! / (d[i]! - d[j]!))));
  });
  return out;
}

/**
 * Exact region of an isolated T: the host untouched, the abutting body from the near face on.
 * A short thick wall at a shallow angle can dip a free-end corner past the face, so the body is
 * the wall's strip clipped to the far side of the face, not a quad between the two.
 */
export function expectedT(abutting: Wall, end: WallEnd, host: Wall): Region {
  const fa = frameOf(abutting);
  const face = nearFace(abutting, end, host);
  const back = into(abutting, end === 'start' ? 'end' : 'start');
  const farEnd = far(abutting, end);
  const reach = fa.len + 10;
  const strip = [
    onFace(abutting, farEnd, fa.o0),
    onFace(abutting, farEnd, fa.o1),
    onFace(abutting, plus(farEnd, times(back, reach)), fa.o1),
    onFace(abutting, plus(farEnd, times(back, reach)), fa.o0),
  ];
  const body = keepSide(strip, onFace(host, host.start, face.offset), face.inward);
  return disjointUnion(polygonRegion(rectOf(host)), polygonRegion(body));
}

export interface RoomCorners {
  readonly kinds: CornerKind[];
  readonly outer: P[];
  readonly inner: P[];
}

/** Corner k joins ring[k-1]'s second end to ring[k]'s first end. */
export function roomCorners(ring: readonly Wall[], ringEnds: readonly (readonly [WallEnd, WallEnd])[]): RoomCorners {
  const kinds: CornerKind[] = [];
  const outer: P[] = [];
  const inner: P[] = [];
  for (let k = 0; k < ring.length; k++) {
    const j = (k + ring.length - 1) % ring.length;
    const c = cornerSpec(ring[j]!, ringEnds[j]![1], ring[k]!, ringEnds[k]![0]);
    kinds.push(c.kind);
    if (c.outer) outer.push(c.outer);
    if (c.inner) inner.push(c.inner);
  }
  return { kinds, outer, inner };
}

/** Exact region of a closed four-wall room with a divider from ring[0] to ring[2]. */
export function expectedRoom(
  ring: readonly Wall[],
  ringEnds: readonly (readonly [WallEnd, WallEnd])[],
  divider: Wall,
  dividerStartHost: Wall,
  dividerEndHost: Wall,
): Region {
  const { outer, inner: innerPoly } = roomCorners(ring, ringEnds);
  const fd = frameOf(divider);
  const s = nearFace(divider, 'start', dividerStartHost);
  const e = nearFace(divider, 'end', dividerEndHost);
  const sp = onFace(dividerStartHost, dividerStartHost.start, s.offset);
  const ep = onFace(dividerEndHost, dividerEndHost.start, e.offset);
  const div = [
    faceMeets(divider, fd.o0, sp, frameOf(dividerStartHost).d)!,
    faceMeets(divider, fd.o1, sp, frameOf(dividerStartHost).d)!,
    faceMeets(divider, fd.o1, ep, frameOf(dividerEndHost).d)!,
    faceMeets(divider, fd.o0, ep, frameOf(dividerEndHost).d)!,
  ];
  return {
    area: shoelace(outer) - shoelace(innerPoly) + shoelace(div),
    contains: (p) => (inside(outer, p) && !inside(innerPoly, p)) || inside(div, p),
    edges: [...edgesOf(outer), ...edgesOf(innerPoly), ...edgesOf(div)],
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Report {
  readonly overlaps: number;
  readonly gaps: number;
  readonly extras: number;
  readonly areaError: number;
  readonly samples: number;
  readonly firstBad: P | null;
}

/** Samples points around every wall and checks: covered by at most one wall, and covered ⟺ in region. */
export function checkAgainst(walls: readonly Wall[], region: Region, seed: number): Report {
  const { pieces } = computeWallGeometry(walls);
  const polys = walls.map((w) => pieces.get(w.id) ?? []);
  const pieceArea = polys.flat().reduce((s, p) => s + shoelace(p), 0);
  const rnd = mulberry32(seed);
  const maxT = Math.max(...walls.map((w) => w.thickness));
  let overlaps = 0;
  let gaps = 0;
  let extras = 0;
  let samples = 0;
  let firstBad: P | null = null;

  const test = (p: P) => {
    if (region.edges.some(([a, b]) => segDistance(p, a, b) < 1e-7)) return;
    samples++;
    const count = polys.filter((ps) => ps.some((poly) => inside(poly, p))).length;
    const want = region.contains(p);
    if (count > 1) overlaps++;
    else if (want && count === 0) gaps++;
    else if (!want && count > 0) extras++;
    else return;
    if (firstBad === null) firstBad = p;
  };

  const reach = 2 * (SPEC_MITER_LIMIT + 1) * maxT;
  for (const w of walls) {
    const f = frameOf(w);
    const box = (s0: number, s1: number, n0: number, n1: number, k: number) => {
      for (let i = 0; i < k; i++) {
        const s = s0 + (s1 - s0) * rnd();
        const n = n0 + (n1 - n0) * rnd();
        test(plus(plus(w.start, times(f.d, s)), times(f.n, n)));
      }
    };
    box(0, f.len, f.o0 - maxT, f.o1 + maxT, 150);
    box(-2 * maxT, 2 * maxT, f.o0 - 2 * maxT, f.o1 + 2 * maxT, 150);
    box(f.len - 2 * maxT, f.len + 2 * maxT, f.o0 - 2 * maxT, f.o1 + 2 * maxT, 150);
    box(-reach, f.len + reach, f.o0 - reach / 4, f.o1 + reach / 4, 100);
  }
  return { overlaps, gaps, extras, areaError: Math.abs(pieceArea - region.area), samples, firstBad };
}
