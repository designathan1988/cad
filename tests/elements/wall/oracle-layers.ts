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
  if (seqA.length !== seqB.length || seqA.some((l, i) => Math.abs(l.thickness - seqB[i]!.thickness) > 1e-12)) {
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

/** First and last core layer: first to last structure layer, or every layer without one. */
export function coreLayersOf(w: Wall): [number, number] {
  const idx = w.layers.flatMap((l, i) => (l.function === 'structure' ? [i] : []));
  return idx.length > 0 ? [idx[0]!, idx[idx.length - 1]!] : [0, w.layers.length - 1];
}

/** Host faces a T meets: its near face, and its core face on the same side. */
function tFaces(abutting: Wall, end: WallEnd, host: Wall) {
  const fh = frameOf(host);
  const into = times(frameOf(abutting).d, end === 'start' ? 1 : -1);
  const positive = dotp(fh.n, into) > 0;
  const offs = layerOffsetsOf(host);
  const [c0, c1] = coreLayersOf(host);
  return { fh, positive, near: positive ? fh.o1 : fh.o0, coreFace: positive ? offs[c1 + 1]! : offs[c0]! };
}

/**
 * I6 by layer: in a T, the abutting core layers stop at the host's core face and the other layers at
 * its near face. Returns the deepest penetration past those limits (≤ 0 means none).
 */
export function abutmentPenetration(abutting: Wall, end: WallEnd, host: Wall, walls: readonly Wall[]): number {
  const { pieces } = geometry(walls);
  const { fh, positive, near, coreFace } = tFaces(abutting, end, host);
  const [a0, a1] = coreLayersOf(abutting);
  let worst = -Infinity;
  for (const piece of pieces.get(abutting.id) ?? []) {
    const limit = piece.layerIndex >= a0 && piece.layerIndex <= a1 ? coreFace : near;
    for (const v of piece.polygon) {
      const o = dotp(fh.n, minus(v, host.start));
      worst = Math.max(worst, positive ? limit - o : o - limit);
    }
  }
  return worst;
}

/**
 * I10: between the host's near face and core face, inside the abutting wall's strip, a point is
 * covered by an abutting core layer where the core passes and by the host everywhere else.
 */
export function notchFill(
  abutting: Wall,
  end: WallEnd,
  host: Wall,
  walls: readonly Wall[],
  seed: number,
): { checked: number; bad: number } {
  const { fh, near, coreFace } = tFaces(abutting, end, host);
  if (Math.abs(near - coreFace) < 1e-9) return { checked: 0, bad: 0 };
  const { pieces } = geometry(walls);
  const fa = frameOf(abutting);
  const aOffs = layerOffsetsOf(abutting);
  const [a0, a1] = coreLayersOf(abutting);
  const coreLo = aOffs[a0]!;
  const coreHi = aOffs[a1 + 1]!;
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
  for (let i = 0; i < 400; i++) {
    const o = lo + (hi - lo) * rnd();
    const p = plus(plus(host.start, times(fh.d, s0 + reach * (2 * rnd() - 1))), times(fh.n, o));
    const ao = dotp(fa.n, minus(p, abutting.start));
    if (o - lo < eps || hi - o < eps || ao < fa.o0 + eps || ao > fa.o1 - eps) continue;
    // Past the free end the abutting wall is gone, even inside its strip: that stays host.
    const freeEnd = end === 'start' ? abutting.end : abutting.start;
    const pastFree = dotp(minus(p, freeEnd), times(fa.d, end === 'start' ? 1 : -1));
    const nearEdge = Math.abs(ao - coreLo) < eps || Math.abs(ao - coreHi) < eps || Math.abs(pastFree) < eps;
    if (nearEdge) continue;
    checked++;
    const inCore = ao > coreLo && ao < coreHi && pastFree < 0;
    const owner = walls.find((w) => (pieces.get(w.id) ?? []).some((piece) => inside(piece.polygon, p)));
    const ownerPiece = owner && (pieces.get(owner.id) ?? []).find((piece) => inside(piece.polygon, p));
    const ok = inCore
      ? owner?.id === abutting.id && ownerPiece!.layerIndex >= a0 && ownerPiece!.layerIndex <= a1
      : owner?.id === host.id;
    if (!ok) bad++;
  }
  return { checked, bad };
}
