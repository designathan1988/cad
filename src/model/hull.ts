// The convex hull of a planar point set (Andrew's monotone chain): the one copy for the app's drag and
// collision code. The two near-copies elsewhere are not this: import-mesh's dedupes coordinates at five
// decimals (imported mesh vertices repeat), object/evaluate's pops collinear points past 1e-12 (an
// object's pieces are derived from formulas, not measured) — their tie rules are their domains'.

import type { Point2 } from './vector';

export function hull(pts: readonly Point2[]): Point2[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Point2, a: Point2, b: Point2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Point2[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
