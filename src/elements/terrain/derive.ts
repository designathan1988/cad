// The terrain as built (elements/terrain): a grid over its outline, each cell cut to the outline and its
// corners at the ground's height there; the triangles of the surface; and the contour lines, where the
// surface crosses each multiple of the interval (marching squares on the grid, kept inside the outline).
// Pure.

import * as THREE from 'three';
import { intersection } from 'polyclip-ts';
import type { Point2 } from '../../core/vector';
import { insideRing } from '../room/derive';
import { heightAt, type Terrain } from './schema';

export interface TerrainSolid {
  readonly terrain: Terrain;
  /** Its surface's triangles: plan x, y and height z. */
  readonly tris: readonly (readonly [number, number, number, number, number, number, number, number, number])[];
  /** Contour lines: their height and segments. */
  readonly contours: readonly { readonly z: number; readonly segments: readonly (readonly [Point2, Point2])[] }[];
  readonly bottom: number;
  readonly top: number;
}

/** Cells across the larger side: fine enough for a lot, few enough to stay quick. */
const CELLS = 48;
const MAX_CONTOURS = 200;

export function deriveTerrain(t: Terrain): TerrainSolid {
  const xs = t.outline.map((p) => p.x);
  const ys = t.outline.map((p) => p.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0, 1e-6);
  const step = Math.max(0.25, span / CELLS);
  const nx = Math.max(1, Math.ceil((Math.max(...xs) - x0) / step));
  const ny = Math.max(1, Math.ceil((Math.max(...ys) - y0) / step));
  const h = (x: number, y: number) => heightAt(t.spots, { x, y });
  // Heights at the grid's corners.
  const z: number[][] = [];
  for (let j = 0; j <= ny; j++) {
    const row: number[] = [];
    for (let i = 0; i <= nx; i++) row.push(h(x0 + i * step, y0 + j * step));
    z.push(row);
  }
  const ring = t.outline.map((p) => [p.x, p.y] as [number, number]);
  const tris: [number, number, number, number, number, number, number, number, number][] = [];
  const tri = (a: Point2, b: Point2, c: Point2) => tris.push([a.x, a.y, h(a.x, a.y), b.x, b.y, h(b.x, b.y), c.x, c.y, h(c.x, c.y)]);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const cx0 = x0 + i * step;
      const cy0 = y0 + j * step;
      const corners = [
        { x: cx0, y: cy0 },
        { x: cx0 + step, y: cy0 },
        { x: cx0 + step, y: cy0 + step },
        { x: cx0, y: cy0 + step },
      ];
      if (corners.every((c) => insideRing(t.outline, c))) {
        // Wholly inside: two triangles, with their corners' heights from the grid.
        const at = (c: Point2, zz: number) => [c.x, c.y, zz] as const;
        const [a, b, c, d] = [at(corners[0]!, z[j]![i]!), at(corners[1]!, z[j]![i + 1]!), at(corners[2]!, z[j + 1]![i + 1]!), at(corners[3]!, z[j + 1]![i]!)];
        tris.push([...a, ...b, ...c], [...a, ...c, ...d]);
        continue;
      }
      // On the outline: the cell cut to it, the pieces triangulated.
      const cut = intersection([[corners.map((c) => [c.x, c.y] as [number, number])]], [[ring]]);
      for (const poly of cut) {
        const outer = poly[0]!.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y));
        if (outer.length < 3) continue;
        const holes = poly.slice(1).map((r) => r.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)));
        const all = [...outer, ...holes.flat()];
        for (const f of THREE.ShapeUtils.triangulateShape(outer, holes)) tri(all[f[0]!]!, all[f[1]!]!, all[f[2]!]!);
      }
    }
  // Contours by marching squares, each segment kept when its middle is inside.
  const zs = z.flat();
  const lo = Math.min(...zs);
  const hi = Math.max(...zs);
  const contours: { z: number; segments: [Point2, Point2][] }[] = [];
  const first = Math.ceil(lo / t.interval) * t.interval;
  for (let level = first, k = 0; level <= hi + 1e-9 && k < MAX_CONTOURS; level += t.interval, k++) {
    const segments: [Point2, Point2][] = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const c = [
          { x: x0 + i * step, y: y0 + j * step, z: z[j]![i]! },
          { x: x0 + (i + 1) * step, y: y0 + j * step, z: z[j]![i + 1]! },
          { x: x0 + (i + 1) * step, y: y0 + (j + 1) * step, z: z[j + 1]![i + 1]! },
          { x: x0 + i * step, y: y0 + (j + 1) * step, z: z[j + 1]![i]! },
        ];
        const cross: Point2[] = [];
        for (let e = 0; e < 4; e++) {
          const a = c[e]!;
          const b = c[(e + 1) % 4]!;
          if (a.z < level !== b.z < level) {
            const k2 = (level - a.z) / (b.z - a.z);
            cross.push({ x: a.x + (b.x - a.x) * k2, y: a.y + (b.y - a.y) * k2 });
          }
        }
        for (let q = 0; q + 1 < cross.length; q += 2) {
          const a = cross[q]!;
          const b = cross[q + 1]!;
          if (insideRing(t.outline, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })) segments.push([a, b]);
        }
      }
    if (segments.length > 0) contours.push({ z: Math.round(level * 1000) / 1000, segments });
  }
  const heights = tris.flatMap((r) => [r[2], r[5], r[8]]);
  return { terrain: t, tris, contours, bottom: heights.length ? Math.min(...heights) : 0, top: heights.length ? Math.max(...heights) : 0 };
}
