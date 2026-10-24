// Lines between layers in plan: where a piece of one layer meets a piece of another (a different
// function or material), along the side they share. Between pieces of the same layer there is none,
// so a core running on through a joint reads as one, as Revit cleans joins up. Pure, and derived once
// per geometry, not on every drawing.

import type { Point2 } from '../../../core/vector';

export interface SeamPiece {
  readonly wallId: string;
  readonly polygon: readonly Point2[];
  /** Pieces with the same key are the same layer: no line between them. */
  readonly key: string;
}

export interface Seam {
  readonly a: Point2;
  readonly b: Point2;
}

const TOL = 1e-7;

/** The lines, each given to the wall of the first piece of its pair. */
export function layerSeams(pieces: readonly SeamPiece[]): Map<string, Seam[]> {
  const boxes = pieces.map((p) => {
    const xs = p.polygon.map((v) => v.x);
    const ys = p.polygon.map((v) => v.y);
    return { x0: Math.min(...xs) - TOL, y0: Math.min(...ys) - TOL, x1: Math.max(...xs) + TOL, y1: Math.max(...ys) + TOL };
  });
  const out = new Map<string, Seam[]>();
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const [p, q] = [pieces[i]!, pieces[j]!];
      const [m, n] = [boxes[i]!, boxes[j]!];
      if (p.key === q.key || m.x1 < n.x0 || n.x1 < m.x0 || m.y1 < n.y0 || n.y1 < m.y0) continue;
      for (const s of sharedSides(p.polygon, q.polygon)) out.set(p.wallId, [...(out.get(p.wallId) ?? []), s]);
    }
  }
  return out;
}

/** Where a side of `p` and a side of `q` lie on one line and overlap by more than a point. */
function sharedSides(p: readonly Point2[], q: readonly Point2[]): Seam[] {
  const out: Seam[] = [];
  p.forEach((a, i) => {
    const b = p[(i + 1) % p.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < TOL) return;
    const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const off = (v: Point2) => (v.x - a.x) * -u.y + (v.y - a.y) * u.x;
    const at = (v: Point2) => (v.x - a.x) * u.x + (v.y - a.y) * u.y;
    q.forEach((c, k) => {
      const d = q[(k + 1) % q.length]!;
      if (Math.abs(off(c)) > TOL || Math.abs(off(d)) > TOL) return;
      const lo = Math.max(0, Math.min(at(c), at(d)));
      const hi = Math.min(len, Math.max(at(c), at(d)));
      if (hi - lo <= TOL) return;
      out.push({ a: { x: a.x + u.x * hi, y: a.y + u.y * hi }, b: { x: a.x + u.x * lo, y: a.y + u.y * lo } });
    });
  });
  return out;
}
