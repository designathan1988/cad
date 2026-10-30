// Smart guides while dragging (phase 9; Figma's smart selection): the box of what is moved snaps to the
// edges and centres of the boxes around it, across and up, a dashed line showing each alignment; and,
// between two neighbours on one side and the other, to the place with equal gaps, the gaps marked.
// Pure: the move's offset in, the offset kept and what to draw out.

import type { Point2 } from '../model/vector';
import type { Box } from './arrange';

export interface Segment {
  readonly a: Point2;
  readonly b: Point2;
}

export interface SmartGuides {
  readonly delta: Point2;
  /** Alignments: a line through the aligned edges or centres, across both boxes. */
  readonly lines: readonly Segment[];
  /** Equal gaps: the two gaps, each from one box to the other. */
  readonly gaps: readonly Segment[];
}

const moved = (b: Box, d: Point2): Box => ({ min: { x: b.min.x + d.x, y: b.min.y + d.y }, max: { x: b.max.x + d.x, y: b.max.y + d.y } });
const marks = (b: Box, axis: 'x' | 'y') => [b.min[axis], (b.min[axis] + b.max[axis]) / 2, b.max[axis]];
const overlap = (a: Box, b: Box, axis: 'x' | 'y') => Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);

/** Within `r` (m) of an alignment or of equal gaps, the offset is taken onto it; the nearest wins on each axis. */
export function smartGuides(box: Box, others: readonly Box[], delta: Point2, r: number): SmartGuides {
  const d = { ...delta };
  const lines: Segment[] = [];
  const gaps: Segment[] = [];
  for (const axis of ['x', 'y'] as const) {
    const across = axis === 'x' ? 'y' : 'x';
    const now = moved(box, d);
    // The nearest alignment of an edge or the centre with another box's.
    let best: { diff: number } | null = null;
    for (const o of others) for (const m of marks(now, axis)) for (const t of marks(o, axis)) if (Math.abs(t - m) <= r && (!best || Math.abs(t - m) < Math.abs(best.diff))) best = { diff: t - m };
    // Equal gaps between the nearest neighbour on each side (lying across from it).
    const side = others.filter((o) => overlap(o, now, across) > 0);
    const before = side.filter((o) => o.max[axis] <= now.min[axis] + r).sort((a, b) => b.max[axis] - a.max[axis])[0];
    const after = side.filter((o) => o.min[axis] >= now.max[axis] - r).sort((a, b) => a.min[axis] - b.min[axis])[0];
    let spread: { diff: number; lo: Box; hi: Box } | null = null;
    if (before && after) {
      const size = now.max[axis] - now.min[axis];
      const gap = (after.min[axis] - before.max[axis] - size) / 2;
      const diff = before.max[axis] + gap - now.min[axis];
      if (gap > 0 && Math.abs(diff) <= r) spread = { diff, lo: before, hi: after };
    }
    // Equal gaps over an alignment when nearer (they are what was aimed at between two).
    const take = spread && (!best || Math.abs(spread.diff) <= Math.abs(best.diff)) ? spread.diff : best?.diff;
    if (take === undefined) continue;
    d[axis] += take;
    const at = moved(box, d);
    if (spread && take === spread.diff) {
      const lo = spread.lo;
      const hi = spread.hi;
      const mid = (b: Box) => (Math.max(b.min[across], at.min[across]) + Math.min(b.max[across], at.max[across])) / 2;
      const seg = (from: number, to: number, c: number): Segment => (axis === 'x' ? { a: { x: from, y: c }, b: { x: to, y: c } } : { a: { x: c, y: from }, b: { x: c, y: to } });
      gaps.push(seg(lo.max[axis], at.min[axis], mid(lo)), seg(at.max[axis], hi.min[axis], mid(hi)));
      continue;
    }
    // Every box aligned with it now, on each line it shares.
    for (const v of marks(at, axis)) {
      const with_ = others.filter((o) => marks(o, axis).some((t) => Math.abs(t - v) < 1e-9));
      if (with_.length === 0) continue;
      const lo = Math.min(at.min[across], ...with_.map((o) => o.min[across]));
      const hi = Math.max(at.max[across], ...with_.map((o) => o.max[across]));
      lines.push(axis === 'x' ? { a: { x: v, y: lo }, b: { x: v, y: hi } } : { a: { x: lo, y: v }, b: { x: hi, y: v } });
    }
  }
  return { delta: d, lines, gaps };
}
