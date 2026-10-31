// A roof's faces. Each sloped side i is a plane rising from its side's line at the eaves height:
// h_i(p) = base + g_i · (distance of p inside that line). On a convex outline the roof is the lowest of
// those planes (a hip at every corner): the face of side i is where its plane is the lowest, the outline
// cut by the half-planes h_i ≤ h_j, exact (convex.ts). That is the outline's straight skeleton.
// On an outline with re-entrant corners (an L, a T, a U) a corner going in is a valley, where the roof is
// the higher of its two sides' planes: a side's plane counts only in front of its line and, at a corner
// going in, only where it is above its neighbour's. The outline is cut along every side's line and every
// valley's into convex cells, where which planes count is fixed, and each cell's faces are found as on a
// convex outline; a side's pieces are joined into its face. For such outlines with the same slope all
// round (the usual L, T and U plans) that is their straight skeleton too: built flat before, with a note.
// Overhangs push each side's edge out, the plane going on down past the wall line. Sides without a slope
// are gables: a vertical infill from the eaves up to the roof. A flat roof is one face at the eaves, with
// its parapet. Pure.

import { union } from 'polyclip-ts';
import { type ConvexPolygon, clipHalfPlane, signedArea } from '../wall/geometry/convex';
import type { Point2 } from '../../model/vector';
import type { Roof } from './schema';

export interface RoofFace {
  /** In plan, counter-clockwise. */
  readonly polygon: readonly Point2[];
  /** Its height at p (m): a plane. */
  readonly z: (p: Point2) => number;
  /** Its slope (rise per run), for the build-up square to it. */
  readonly grade: number;
}

export interface RoofSolid {
  readonly roof: Roof;
  /** The eaves' outline in plan: the sides pushed out by their overhangs. */
  readonly outline: readonly Point2[];
  readonly faces: readonly RoofFace[];
  /** Gable infills: vertical polygons, (x, y, z), from the eaves up to the roof. */
  readonly gables: readonly (readonly { x: number; y: number; z: number }[])[];
  /** A flat roof's parapet: a band per side, bottom and top heights. */
  readonly parapets: readonly { readonly polygon: readonly Point2[]; readonly bottom: number; readonly top: number }[];
  /** The eaves' height (m). */
  readonly base: number;
  readonly top: number;
  /** Sloped sides on an outline whose roof could not be found: built flat, and said. */
  readonly notConvex: boolean;
}

const cross = (o: Point2, a: Point2, b: Point2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

export function isConvex(poly: readonly Point2[]): boolean {
  const n = poly.length;
  if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const c = cross(poly[i]!, poly[(i + 1) % n]!, poly[(i + 2) % n]!);
    if (Math.abs(c) < 1e-12) continue;
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

/** Where the lines a + s·u and b + t·v cross, or null when parallel. */
function crossing(a: Point2, u: Point2, b: Point2, v: Point2): Point2 | null {
  const d = u.x * v.y - u.y * v.x;
  if (Math.abs(d) < 1e-12) return null;
  const s = ((b.x - a.x) * v.y - (b.y - a.y) * v.x) / d;
  return { x: a.x + u.x * s, y: a.y + u.y * s };
}

/** `levelTop`: the top of the roof's level, the eaves sitting there plus the roof's base offset. */
export function roofSolid(roof: Roof, levelTop: number): RoofSolid {
  const raw = roof.outline;
  const ccw = signedArea(raw) < 0;
  const poly = ccw ? [...raw].reverse() : [...raw];
  // The sides follow the outline as stored; reversed, side i is the old side n − 2 − i.
  const n = poly.length;
  const edgeOf = (i: number) => roof.edges[ccw ? (2 * n - 2 - i) % n : i] ?? { grade: null, overhang: 0 };
  const base = levelTop + roof.baseOffset;
  const sides = poly.map((a, i) => {
    const b = poly[(i + 1) % n]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const u = { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
    // Inside is to the left of a counter-clockwise side.
    const inward = { x: -u.y, y: u.x };
    const e = edgeOf(i);
    return { a, b, u, inward, grade: e.grade !== null && e.grade > 0 ? e.grade / 100 : null, overhang: Math.max(0, e.overhang) };
  });
  // The eaves: each side's line pushed out by its overhang, corner to corner.
  const outline = sides.map((s, i) => {
    const prev = sides[(i + n - 1) % n]!;
    const pa = { x: prev.a.x - prev.inward.x * prev.overhang, y: prev.a.y - prev.inward.y * prev.overhang };
    const sa = { x: s.a.x - s.inward.x * s.overhang, y: s.a.y - s.inward.y * s.overhang };
    return crossing(pa, prev.u, sa, s.u) ?? sa;
  });
  const sloped = sides.map((s, i) => ({ ...s, i })).filter((s) => s.grade !== null);
  const plane = (s: Sloped) => (p: Point2) => base + s.grade! * ((p.x - s.a.x) * s.inward.x + (p.y - s.a.y) * s.inward.y);
  const flatFace = (): RoofFace => ({ polygon: outline, z: () => base, grade: 0 });
  const convex = isConvex(poly);
  // Re-entrant corners: corner i (between side i − 1 and side i) turns right on a counter-clockwise outline.
  const reflex = poly.map((_, i) => cross(poly[(i + n - 1) % n]!, poly[i]!, poly[(i + 1) % n]!) < -1e-12);
  const concaveFaces = sloped.length > 0 && !convex ? valleyFaces(outline, sloped, sides, reflex, plane) : null;
  const notConvex = sloped.length > 0 && !convex && concaveFaces === null;
  if (sloped.length === 0 || notConvex) {
    // A parapet on the walls' line, inward by the roof's thickness, on a flat roof.
    const ph = roof.parapet ?? 0;
    const t = 0.15;
    const parapets =
      ph > 0
        ? sides.map((s) => ({
            polygon: [s.a, s.b, { x: s.b.x + s.inward.x * t, y: s.b.y + s.inward.y * t }, { x: s.a.x + s.inward.x * t, y: s.a.y + s.inward.y * t }],
            bottom: base,
            top: base + roof.thickness + ph,
          }))
        : [];
    return { roof, outline, faces: [flatFace()], gables: [], parapets, base, top: base + roof.thickness + ph, notConvex };
  }
  const faces: RoofFace[] = concaveFaces ?? lowestFaces(outline, sloped, plane);
  // Its height at p: the lowest of the planes that count there (all of them on a convex outline).
  const counts = counting(sloped, sides, reflex, plane, base);
  const zAt = (p: Point2) => {
    const heights = sloped.filter((s) => convex || counts(s, p)).map((s) => plane(s)(p));
    return heights.length > 0 ? Math.min(...heights) : base;
  };
  // Gables: along each side with no slope, from the eaves up to the roof, broken where the lowest plane changes.
  const gables = sides
    .filter((s) => s.grade === null)
    .map((s) => {
      const ts = new Set([0, 1]);
      const len = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
      const at = (t: number) => ({ x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t });
      for (const p of sloped)
        for (const q of sloped) {
          if (p === q) continue;
          // h_p(at(t)) = h_q(at(t)), linear in t.
          const f0 = plane(p)(at(0)) - plane(q)(at(0));
          const f1 = plane(p)(at(1)) - plane(q)(at(1));
          if (Math.abs(f1 - f0) > 1e-12) {
            const t = f0 / (f0 - f1);
            if (t > 0 && t < 1) ts.add(t);
          }
        }
      const profile = [...ts].sort((a, b) => a - b).map((t) => ({ ...at(t), z: Math.max(base, zAt(at(t))) }));
      return len > 0 ? [{ ...s.a, z: base }, ...profile, { ...s.b, z: base }] : [];
    })
    .filter((g) => g.length >= 3 && g.some((v) => v.z > base + 1e-6));
  const top = Math.max(base, ...faces.flatMap((f) => f.polygon.map((p) => f.z(p)))) + roof.thickness;
  return { roof, outline, faces, gables, parapets: [], base, top, notConvex: false };
}

interface Side {
  readonly a: Point2;
  readonly b: Point2;
  readonly u: Point2;
  readonly inward: Point2;
  readonly grade: number | null;
}
type Sloped = Side & { readonly i: number };

/** Where h_s ≤ h_o, a half-plane: (g_s·n_s − g_o·n_o)·p ≤ g_s·n_s·a_s − g_o·n_o·a_o; null when the planes are parallel. */
function lowerThan(s: Sloped, o: Sloped): { normal: Point2; offset: number } | null {
  const normal = { x: s.grade! * s.inward.x - o.grade! * o.inward.x, y: s.grade! * s.inward.y - o.grade! * o.inward.y };
  if (Math.hypot(normal.x, normal.y) < 1e-12) return null;
  const offset = s.grade! * (s.inward.x * s.a.x + s.inward.y * s.a.y) - o.grade! * (o.inward.x * o.a.x + o.inward.y * o.a.y);
  return { normal, offset };
}

/** Each side's face in a convex region where all of `sloped` count: where its plane is the lowest. */
function lowestFaces(region: ConvexPolygon, sloped: readonly Sloped[], plane: (s: Sloped) => (p: Point2) => number): (RoofFace & { readonly side: Sloped })[] {
  const faces: (RoofFace & { readonly side: Sloped })[] = [];
  for (const s of sloped) {
    let face: ConvexPolygon = region;
    for (const o of sloped) {
      if (o === s) continue;
      const half = lowerThan(s, o);
      if (!half) continue;
      face = clipHalfPlane(face, half);
      if (face.length < 3) break;
    }
    if (face.length >= 3 && Math.abs(signedArea(face)) > 1e-9) faces.push({ polygon: face, z: plane(s), grade: s.grade!, side: s });
  }
  return faces;
}

/**
 * Whether side s's plane counts at p: in front of its line (not below the eaves), and at each of its ends
 * that is a corner going in, not below the neighbouring side's plane there (the valley is the higher).
 */
function counting(sloped: readonly Sloped[], sides: readonly Side[], reflex: readonly boolean[], plane: (s: Sloped) => (p: Point2) => number, base: number) {
  const n = sides.length;
  const byIndex = new Map(sloped.map((s) => [s.i, s]));
  return (s: Sloped, p: Point2): boolean => {
    const h = plane(s)(p);
    if (h < base - 1e-9) return false;
    // Its start is corner s.i (after side s.i − 1), its end corner s.i + 1 (before side s.i + 1).
    for (const [corner, other] of [[s.i, (s.i + n - 1) % n], [(s.i + 1) % n, (s.i + 1) % n]] as const) {
      const o = byIndex.get(other);
      if (reflex[corner] && o && h < plane(o)(p) - 1e-9) return false;
    }
    return true;
  };
}

/**
 * The faces of a roof on an outline with corners going in: the outline cut along every side's line and
 * every valley's into convex cells, each cell's faces those of the planes that count there, and a side's
 * pieces joined. Null when no face is found.
 */
function valleyFaces(outline: readonly Point2[], sloped: readonly Sloped[], sides: readonly Side[], reflex: readonly boolean[], plane: (s: Sloped) => (p: Point2) => number): RoofFace[] | null {
  const n = sides.length;
  const base = plane(sloped[0]!)(sloped[0]!.a);
  // The lines: each side's, and at each corner going in between two sloped sides, where their planes meet.
  const lines: { normal: Point2; offset: number }[] = sides.map((s) => ({ normal: s.inward, offset: s.inward.x * s.a.x + s.inward.y * s.a.y }));
  const byIndex = new Map(sloped.map((s) => [s.i, s]));
  for (let corner = 0; corner < n; corner++) {
    if (!reflex[corner]) continue;
    const before = byIndex.get((corner + n - 1) % n);
    const after = byIndex.get(corner);
    const line = before && after ? lowerThan(before, after) : null;
    if (line) lines.push(line);
  }
  // The convex cells of the box round the outline cut by every line; those inside the outline kept.
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  const pad = 1 + Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const box: ConvexPolygon = [
    { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad },
    { x: Math.max(...xs) + pad, y: Math.min(...ys) - pad },
    { x: Math.max(...xs) + pad, y: Math.max(...ys) + pad },
    { x: Math.min(...xs) - pad, y: Math.max(...ys) + pad },
  ];
  let cells: ConvexPolygon[] = [box];
  for (const l of lines) {
    const flip = { normal: { x: -l.normal.x, y: -l.normal.y }, offset: -l.offset };
    cells = cells.flatMap((c) => [clipHalfPlane(c, l), clipHalfPlane(c, flip)]).filter((c) => c.length >= 3 && Math.abs(signedArea(c)) > 1e-9);
  }
  const centre = (c: ConvexPolygon) => ({ x: c.reduce((s, p) => s + p.x, 0) / c.length, y: c.reduce((s, p) => s + p.y, 0) / c.length });
  const counts = counting(sloped, sides, reflex, plane, base);
  const pieces = new Map<Sloped, ConvexPolygon[]>();
  for (const cell of cells) {
    const mid = centre(cell);
    if (!insideRing(outline, mid)) continue;
    const active = sloped.filter((s) => counts(s, mid));
    for (const f of lowestFaces(cell, active, plane)) pieces.set(f.side, [...(pieces.get(f.side) ?? []), f.polygon]);
  }
  // A side's pieces joined into its face (one polygon or more), counter-clockwise.
  const faces: RoofFace[] = [];
  for (const [s, polys] of pieces) {
    const [first, ...rest] = polys.map((p) => [p.map((q): [number, number] => [q.x, q.y])]);
    if (!first) continue;
    for (const poly of union(first, ...rest)) {
      const ring = poly[0]!.map(([x, y]) => ({ x, y }));
      if (ring.length > 1 && ring[0]!.x === ring.at(-1)!.x && ring[0]!.y === ring.at(-1)!.y) ring.pop();
      if (ring.length >= 3) faces.push({ polygon: signedArea(ring) < 0 ? ring.reverse() : ring, z: plane(s), grade: s.grade! });
    }
  }
  return faces.length > 0 ? faces : null;
}

/** Whether p is inside a ring (even–odd). */
function insideRing(ring: readonly Point2[], p: Point2): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
