// Layer invariants I8 and I9 for the oracle. Same independence rule: no engine geometry code.

import type { WallEnd } from '../../../src/elements/wall/schema';
import { geometry, type TestWall as Wall } from './fixtures';
import { cornerSpec, frameOf, inside, type P } from './oracle';

const pt = (x: number, y: number): P => ({ x, y });
const plus = (a: P, b: P) => pt(a.x + b.x, a.y + b.y);
const minus = (a: P, b: P) => pt(a.x - b.x, a.y - b.y);
const times = (a: P, s: number) => pt(a.x * s, a.y * s);
const dotp = (a: P, b: P) => a.x * b.x + a.y * b.y;
const norm = (a: P) => Math.sqrt(a.x * a.x + a.y * a.y);
const unit = (a: P) => times(a, 1 / norm(a));
const far = (w: Wall, end: WallEnd) => (end === 'start' ? w.end : w.start);

/** Layer boundaries along the wall's normal, exterior face first, from the oracle's own frame. */
export function layerOffsetsOf(w: Wall): number[] {
  const out = [frameOf(w).o0];
  for (const l of w.layers) out.push(out[out.length - 1]! + l.thickness);
  return out;
}

/** I8: every vertex of every layer piece lies inside that layer's band, to float rounding. */
export function layerContainmentViolations(walls: readonly Wall[]): number {
  const { pieces } = geometry(walls);
  let bad = 0;
  for (const w of walls) {
    const f = frameOf(w);
    const offs = layerOffsetsOf(w);
    for (const piece of pieces.get(w.id) ?? []) {
      const lo = offs[piece.layerIndex]!;
      const hi = offs[piece.layerIndex + 1]!;
      for (const v of piece.polygon) {
        const o = dotp(f.n, minus(v, w.start));
        if (o < lo - 1e-12 || o > hi + 1e-12) bad++;
      }
    }
  }
  return bad;
}

/**
 * I9: across a miter between walls whose layers, read from the corner's outer face, are the same,
 * layer k of one meets layer k of the other. Null when the corner is not a miter or the layers
 * differ (then nothing is promised).
 */
export function layerContinuity(
  a: Wall,
  aEnd: WallEnd,
  b: Wall,
  bEnd: WallEnd,
  node?: P,
): { checked: number; mismatched: number } | null {
  const c = cornerSpec(a, aEnd, b, bEnd, node);
  if ((c.kind !== 'miter' && c.kind !== 'bevel') || !c.inner || !c.outer) return null;
  const aFromOuter = c.aOuter === frameOf(a).o0;
  const bFromOuter = c.bOuter === frameOf(b).o0;
  const seqA = aFromOuter ? a.layers : [...a.layers].reverse();
  const seqB = bFromOuter ? b.layers : [...b.layers].reverse();
  if (
    seqA.length !== seqB.length ||
    seqA.some((l, i) => Math.abs(l.thickness - seqB[i]!.thickness) > 1e-12 || l.function !== seqB[i]!.function)
  ) {
    return null;
  }
  const rank = (w: Wall, fromOuter: boolean, k: number) => (fromOuter ? k : w.layers.length - 1 - k);
  const { pieces } = geometry([a, b]);
  const coverOf = (w: Wall, p: P) => (pieces.get(w.id) ?? []).find((piece) => inside(piece.polygon, p));
  const seg = minus(c.inner, c.outer);
  const len = norm(seg);
  const across = unit(pt(-seg.y, seg.x));
  const towardA = dotp(across, minus(far(a, aEnd), c.outer)) > 0 ? across : times(across, -1);
  const total = seqA.reduce((s, l) => s + l.thickness, 0);
  const marks: number[] = [];
  seqA.reduce((s, l) => (marks.push(s / total), s + l.thickness), 0);
  marks.push(1);
  let checked = 0;
  let mismatched = 0;
  for (let i = 1; i < 200; i++) {
    const t = i / 200;
    if (marks.some((m) => Math.abs(t - m) * len < 1e-6)) continue;
    const p = plus(c.outer, times(seg, t));
    const pa = coverOf(a, plus(p, times(towardA, 1e-7)));
    const pb = coverOf(b, minus(p, times(towardA, 1e-7)));
    if (!pa || !pb) continue;
    checked++;
    if (rank(a, aFromOuter, pa.layerIndex) !== rank(b, bFromOuter, pb.layerIndex)) mismatched++;
  }
  return { checked, mismatched };
}

const SPEC_POINT_TOL = 1e-3;

/**
 * The spec's corner choice (§7.1): the same layer sequence read from the corner's outer face (same
 * functions, thicknesses within 1 mm) is mitered; anything else is a butt.
 */
export function sameSequence(a: Wall, aEnd: WallEnd, b: Wall, bEnd: WallEnd, node?: P): boolean {
  const c = cornerSpec(a, aEnd, b, bEnd, node);
  const seqA = c.aOuter === frameOf(a).o0 ? a.layers : [...a.layers].reverse();
  const seqB = c.bOuter === frameOf(b).o0 ? b.layers : [...b.layers].reverse();
  return (
    seqA.length === seqB.length &&
    seqA.every((l, i) => l.function === seqB[i]!.function && Math.abs(l.thickness - seqB[i]!.thickness) <= SPEC_POINT_TOL)
  );
}

/** First and last core layer: first to last structure layer, or every layer without one. */
export function coreLayersOf(w: Wall): [number, number] {
  const idx = w.layers.flatMap((l, i) => (l.function === 'structure' ? [i] : []));
  return idx.length > 0 ? [idx[0]!, idx[idx.length - 1]!] : [0, w.layers.length - 1];
}

/** Revit's priority by function, written here again on purpose: 1 is the highest. */
const SPEC_PRIORITY = { structure: 1, substrate: 2, thermal: 3, finish1: 4, finish2: 5 } as const;

/**
 * Host faces a T meets: its near face, its core face on the same side, and where each abutting layer
 * stops. A core layer stops on the host core face. Any other layer walks into the host from the near
 * face through layers of strictly lower priority, and stops on the first of equal or higher priority
 * (the host core at the latest).
 */
export function tFaces(abutting: Wall, end: WallEnd, host: Wall) {
  const fh = frameOf(host);
  const into = times(frameOf(abutting).d, end === 'start' ? 1 : -1);
  const positive = dotp(fh.n, into) > 0;
  const offs = layerOffsetsOf(host);
  const [c0, c1] = coreLayersOf(host);
  const coreFace = positive ? offs[c1 + 1]! : offs[c0]!;
  // Host layers outside its core on the near side, from the near face inward, with the face each one
  // shows toward the abutting wall.
  const walk: { priority: number; face: number }[] = [];
  if (positive) for (let i = host.layers.length - 1; i > c1; i--) walk.push({ priority: SPEC_PRIORITY[host.layers[i]!.function], face: offs[i + 1]! });
  else for (let i = 0; i < c0; i++) walk.push({ priority: SPEC_PRIORITY[host.layers[i]!.function], face: offs[i]! });
  const [a0, a1] = coreLayersOf(abutting);
  const stops = abutting.layers.map((l, k) => {
    if (k >= a0 && k <= a1) return coreFace;
    const p = SPEC_PRIORITY[l.function];
    return walk.find((h) => h.priority <= p)?.face ?? coreFace;
  });
  return { fh, positive, near: positive ? fh.o1 : fh.o0, coreFace, stops };
}

/**
 * I6 by layer: in a T, each abutting layer stops where the priority rule says (tFaces). Returns the
 * deepest penetration past those limits (≤ 0 means none).
 */
export function abutmentPenetration(
  abutting: Wall,
  end: WallEnd,
  host: Wall,
  walls: readonly Wall[],
  keep: (polygon: readonly P[]) => boolean = () => true,
): number {
  const { pieces } = geometry(walls);
  const { fh, positive, stops } = tFaces(abutting, end, host);
  let worst = -Infinity;
  for (const piece of (pieces.get(abutting.id) ?? []).filter((x) => keep(x.polygon))) {
    const limit = stops[piece.layerIndex]!;
    for (const v of piece.polygon) {
      const o = dotp(fh.n, minus(v, host.start));
      worst = Math.max(worst, positive ? limit - o : o - limit);
    }
  }
  return worst;
}

/**
 * I10: between the host's near face and core face, along the host, inside the abutting wall's strip
 * and short of its free end, a point in abutting layer k is covered by layer k where k has passed (between the near
 * face and k's stop) and by the host everywhere else.
 */
export function notchFill(
  abutting: Wall,
  end: WallEnd,
  host: Wall,
  walls: readonly Wall[],
  seed: number,
  /** Walls that count as the host: a passage of two walls in line is one host. */
  hostIds: readonly string[] = [host.id],
): { checked: number; bad: number; passedOutsideCore: number } {
  const { fh, near, coreFace, stops } = tFaces(abutting, end, host);
  if (Math.abs(near - coreFace) < 1e-9) return { checked: 0, bad: 0, passedOutsideCore: 0 };
  const [a0, a1] = coreLayersOf(abutting);
  const { pieces } = geometry(walls);
  const fa = frameOf(abutting);
  const aOffs = layerOffsetsOf(abutting);
  const hOffs = layerOffsetsOf(host);
  const joint = end === 'start' ? abutting.start : abutting.end;
  const s0 = dotp(fh.d, minus(joint, host.start));
  const sin = Math.abs(fa.d.x * fh.d.y - fa.d.y * fh.d.x);
  const reach = (abutting.thickness + host.thickness) / sin + 0.01;
  const lo = Math.min(near, coreFace);
  const hi = Math.max(near, coreFace);
  const eps = 1e-6;
  let r = seed >>> 0 || 1;
  const rnd = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
  let checked = 0;
  let bad = 0;
  let passedOutsideCore = 0;
  for (let i = 0; i < 400; i++) {
    const o = lo + (hi - lo) * rnd();
    const p = plus(plus(host.start, times(fh.d, s0 + reach * (2 * rnd() - 1))), times(fh.n, o));
    const ao = dotp(fa.n, minus(p, abutting.start));
    if (o - lo < eps || hi - o < eps || ao < fa.o0 + eps || ao > fa.o1 - eps) continue;
    // Past the free end the abutting wall is gone, even inside its strip: that stays host.
    const freeEnd = end === 'start' ? abutting.end : abutting.start;
    const pastFree = dotp(minus(p, freeEnd), times(fa.d, end === 'start' ? 1 : -1));
    const nearEdge =
      aOffs.some((b) => Math.abs(ao - b) < eps) || hOffs.some((b) => Math.abs(o - b) < eps) || Math.abs(pastFree) < eps;
    if (nearEdge) continue;
    // Only along the host: in a butt the host is the through wall and can be short. Past its end
    // nothing may be (the region check sees to that), so the rule below does not apply there.
    const hs = dotp(fh.d, minus(p, host.start));
    if (hs < eps || hs > fh.len - eps) continue;
    checked++;
    const k = aOffs.findIndex((b, i) => i + 1 < aOffs.length && ao > b && ao < aOffs[i + 1]!);
    const stop = stops[k]!;
    const passed = pastFree < 0 && Math.min(near, stop) < o && o < Math.max(near, stop);
    if (passed && (k < a0 || k > a1)) passedOutsideCore++;
    const owner = walls.find((w) => (pieces.get(w.id) ?? []).some((piece) => inside(piece.polygon, p)));
    const ownerPiece = owner && (pieces.get(owner.id) ?? []).find((piece) => inside(piece.polygon, p));
    const ok = passed ? owner?.id === abutting.id && ownerPiece!.layerIndex === k : owner !== undefined && hostIds.includes(owner.id);
    if (!ok) bad++;
  }
  return { checked, bad, passedOutsideCore };
}
