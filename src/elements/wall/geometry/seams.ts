// Lines between layers in plan: where a piece of one layer meets a piece of another (a different
// function or material), along the side they share. Between pieces of the same layer there is none,
// so a core running on through a joint reads as one, as Revit cleans joins up. Pure, and derived once
// per geometry, not on every drawing.

import type { Point2 } from '../../../model/vector';
import { SEAM_TOL } from '../../../model/tolerance';

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


/** The lines, each given to the wall of the first piece of its pair. */
export function layerSeams(pieces: readonly SeamPiece[]): Map<string, Seam[]> {
  const boxes = pieces.map((p) => {
    const xs = p.polygon.map((v) => v.x);
    const ys = p.polygon.map((v) => v.y);
    return { x0: Math.min(...xs) - SEAM_TOL, y0: Math.min(...ys) - SEAM_TOL, x1: Math.max(...xs) + SEAM_TOL, y1: Math.max(...ys) + SEAM_TOL };
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

/**
 * The outline of the pieces taken together: every part of a side that no other piece shares, with
 * the parts of one line that touch joined into one. What a tape measures to: a wall's finished face,
 * not the line between its plaster and its core, which is a side of two pieces.
 */
export function outerSides(polygons: readonly (readonly Point2[])[]): Seam[] {
  const boxes = polygons.map((p) => {
    const xs = p.map((v) => v.x);
    const ys = p.map((v) => v.y);
    return { x0: Math.min(...xs) - SEAM_TOL, y0: Math.min(...ys) - SEAM_TOL, x1: Math.max(...xs) + SEAM_TOL, y1: Math.max(...ys) + SEAM_TOL };
  });
  // Each free part as its line (a unit direction and a point) and its span along it.
  const parts: { a: Point2; u: Point2; lo: number; hi: number }[] = [];
  polygons.forEach((p, i) => {
    const m = boxes[i]!;
    p.forEach((a, k) => {
      const b = p[(k + 1) % p.length]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < SEAM_TOL) return;
      const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
      const off = (v: Point2) => (v.x - a.x) * -u.y + (v.y - a.y) * u.x;
      const at = (v: Point2) => (v.x - a.x) * u.x + (v.y - a.y) * u.y;
      const covered: [number, number][] = [];
      polygons.forEach((q, j) => {
        const n = boxes[j]!;
        if (j === i || m.x1 < n.x0 || n.x1 < m.x0 || m.y1 < n.y0 || n.y1 < m.y0) return;
        q.forEach((c, l) => {
          const d = q[(l + 1) % q.length]!;
          if (Math.abs(off(c)) > SEAM_TOL || Math.abs(off(d)) > SEAM_TOL) return;
          const lo = Math.max(0, Math.min(at(c), at(d)));
          const hi = Math.min(len, Math.max(at(c), at(d)));
          if (hi - lo > SEAM_TOL) covered.push([lo, hi]);
        });
      });
      covered.sort((x, y) => x[0] - y[0]);
      let t = 0;
      for (const [lo, hi] of covered) {
        if (lo > t + SEAM_TOL) parts.push({ a, u, lo: t, hi: lo });
        t = Math.max(t, hi);
      }
      if (len > t + SEAM_TOL) parts.push({ a, u, lo: t, hi: len });
    });
  });
  // Parts of one line that touch or overlap are one side: a face is not cut where two pieces meet it.
  const ends = parts.map((s) => [
    { x: s.a.x + s.u.x * s.lo, y: s.a.y + s.u.y * s.lo },
    { x: s.a.x + s.u.x * s.hi, y: s.a.y + s.u.y * s.hi },
  ]);
  const used = parts.map(() => false);
  const out: Seam[] = [];
  parts.forEach((s, i) => {
    if (used[i]) return;
    used[i] = true;
    const at = (v: Point2) => (v.x - s.a.x) * s.u.x + (v.y - s.a.y) * s.u.y;
    const onLine = (v: Point2) => Math.abs((v.x - s.a.x) * -s.u.y + (v.y - s.a.y) * s.u.x) <= SEAM_TOL;
    let lo = s.lo;
    let hi = s.hi;
    for (let grew = true; grew; ) {
      grew = false;
      parts.forEach((_, j) => {
        if (used[j]) return;
        const [p, q] = ends[j]!;
        if (!onLine(p!) || !onLine(q!)) return;
        const [a, b] = [at(p!), at(q!)].sort((x, y) => x - y) as [number, number];
        if (a > hi + SEAM_TOL || b < lo - SEAM_TOL) return;
        used[j] = true;
        lo = Math.min(lo, a);
        hi = Math.max(hi, b);
        grew = true;
      });
    }
    out.push({ a: { x: s.a.x + s.u.x * lo, y: s.a.y + s.u.y * lo }, b: { x: s.a.x + s.u.x * hi, y: s.a.y + s.u.y * hi } });
  });
  return out;
}

/** Where a side of `p` and a side of `q` lie on one line and overlap by more than a point. */
function sharedSides(p: readonly Point2[], q: readonly Point2[]): Seam[] {
  const out: Seam[] = [];
  p.forEach((a, i) => {
    const b = p[(i + 1) % p.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < SEAM_TOL) return;
    const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const off = (v: Point2) => (v.x - a.x) * -u.y + (v.y - a.y) * u.x;
    const at = (v: Point2) => (v.x - a.x) * u.x + (v.y - a.y) * u.y;
    q.forEach((c, k) => {
      const d = q[(k + 1) % q.length]!;
      if (Math.abs(off(c)) > SEAM_TOL || Math.abs(off(d)) > SEAM_TOL) return;
      const lo = Math.max(0, Math.min(at(c), at(d)));
      const hi = Math.min(len, Math.max(at(c), at(d)));
      if (hi - lo <= SEAM_TOL) return;
      out.push({ a: { x: a.x + u.x * hi, y: a.y + u.y * hi }, b: { x: a.x + u.x * lo, y: a.y + u.y * lo } });
    });
  });
  return out;
}
