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
