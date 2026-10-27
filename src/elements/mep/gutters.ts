// The roofs' eave gutters (docs/plano-de-escopo.md, phase 13: "calhas da pluvial"), from the roofs as they
// are: each sloped face drains to its eaves, the edges at its lowest. Its contribution area is NBR 10844
// (1989) 5.2's for an inclined surface, A = (a + h/2)·b on a rectangular face: here its plan area and half
// its upright projection on its eaves' line, the same for that face and true for a triangular hip end; its
// design flow Q = I·A/60 (5.3.1); its gutter the least semicircular one of table 3 (n = 0.011, the water at
// half the diameter) at the least fall, 0.5 % (5.5.2). Pure.

import type { Point2 } from '../../core/vector';

/** NBR 10844 (1989) table 3: a semicircular gutter's inner diameter (m) and its flow (L/min) at 0.5, 1 and 2 %. */
export const GUTTER_CAPACITY: readonly (readonly [number, readonly [number, number, number]])[] = [
  [0.1, [130, 183, 256]],
  [0.125, [236, 333, 466]],
  [0.15, [384, 541, 757]],
  [0.2, [829, 1167, 1634]],
];
/** NBR 10844 5.5.2: an eave gutter's least fall (%); 5.6.3: a round downpipe's least inner diameter (m). */
export const GUTTER_FALL = 0.5;
export const DOWNPIPE_LEAST = 0.07;

export interface Gutter {
  readonly roofId: string;
  /** The face's place among its roof's, from 1. */
  readonly face: number;
  /** The eaves' length (m), the face's plan area and its contribution area (m²). */
  readonly eaves: number;
  readonly plan: number;
  readonly area: number;
  /** L/min. */
  readonly flow: number;
  /** The least gutter of table 3 at 0.5 % (m); null past it. */
  readonly diameter: number | null;
}

const shoelace = (pts: readonly { x: number; y: number }[]) => Math.abs(pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % pts.length]!.y - pts[(i + 1) % pts.length]!.x * p.y, 0)) / 2;

/** Each sloped face's gutter, `intensity` the design rain (mm/h). A flat roof drains by its outlets, not here. */
export function gutters(roofs: readonly { readonly roof: { readonly id: string }; readonly faces: readonly { readonly polygon: readonly Point2[]; readonly z: (p: Point2) => number; readonly grade: number }[] }[], intensity: number): Gutter[] {
  const out: Gutter[] = [];
  for (const r of roofs) {
    r.faces.forEach((f, i) => {
      if (f.grade <= 1e-6 || f.polygon.length < 3) return;
      const zs = f.polygon.map((p) => f.z(p));
      const low = Math.min(...zs);
      const high = Math.max(...zs);
      // The eaves: the edges at its lowest.
      const n = f.polygon.length;
      let eaves = 0;
      let along: Point2 | null = null;
      let from: Point2 | null = null;
      for (let k = 0; k < n; k++) {
        const a = f.polygon[k]!;
        const b = f.polygon[(k + 1) % n]!;
        if (Math.abs(zs[k]! - low) > 1e-3 || Math.abs(zs[(k + 1) % n]! - low) > 1e-3) continue;
        const l = Math.hypot(b.x - a.x, b.y - a.y);
        if (l < 1e-6) continue;
        eaves += l;
        if (!along) {
          along = { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
          from = a;
        }
      }
      if (!along || !from || high - low < 1e-6) return;
      const plan = shoelace(f.polygon);
      // Its upright projection on the eaves' line: (along it, height) for each corner.
      const upright = shoelace(f.polygon.map((p, k) => ({ x: (p.x - from!.x) * along!.x + (p.y - from!.y) * along!.y, y: zs[k]! - low })));
      const area = plan + upright / 2;
      const flow = (intensity * area) / 60;
      const diameter = GUTTER_CAPACITY.find(([, q]) => q[0] >= flow - 1e-9)?.[0] ?? null;
      out.push({ roofId: r.roof.id, face: i + 1, eaves, plan, area, flow, diameter });
    });
  }
  return out;
}
