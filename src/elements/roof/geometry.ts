// A roof's faces. Each sloped side i is a plane rising from its side's line at the eaves height:
// h_i(p) = base + g_i · (distance of p inside that line). The roof is the lowest of those planes, so the
// face of side i is where its plane is the lowest: the outline cut by the half-planes h_i ≤ h_j, exact
// (convex.ts). For a convex outline that is the hip roof's straight skeleton. Overhangs push each side's
// edge out, the plane going on down past the wall line. Sides without a slope are gables: a vertical
// infill from the eaves up to the roof. A flat roof is one face at the eaves, with its parapet. Pure.

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
  /** Sloped sides on an outline that is not convex: built flat, and said. */
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
  const notConvex = sloped.length > 0 && !isConvex(poly);
  const plane = (s: (typeof sloped)[number]) => (p: Point2) => base + s.grade! * ((p.x - s.a.x) * s.inward.x + (p.y - s.a.y) * s.inward.y);
  const flatFace = (): RoofFace => ({ polygon: outline, z: () => base, grade: 0 });
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
  const faces: RoofFace[] = [];
  for (const s of sloped) {
    let face: ConvexPolygon = outline;
    for (const o of sloped) {
      if (o === s) continue;
      // h_s − h_o ≤ 0, a half-plane: (g_s·n_s − g_o·n_o)·p ≤ g_s·n_s·a_s − g_o·n_o·a_o.
      const normal = { x: s.grade! * s.inward.x - o.grade! * o.inward.x, y: s.grade! * s.inward.y - o.grade! * o.inward.y };
      const offset = s.grade! * (s.inward.x * s.a.x + s.inward.y * s.a.y) - o.grade! * (o.inward.x * o.a.x + o.inward.y * o.a.y);
      if (Math.hypot(normal.x, normal.y) < 1e-12) continue;
      face = clipHalfPlane(face, { normal, offset });
      if (face.length < 3) break;
    }
    if (face.length >= 3) faces.push({ polygon: face, z: plane(s), grade: s.grade! });
  }
  const zAt = (p: Point2) => Math.min(...sloped.map((s) => plane(s)(p)));
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
