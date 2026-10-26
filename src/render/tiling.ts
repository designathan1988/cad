// A floor's finish laid in pieces (paginação), as plans draw it: the joints between the pieces over the
// floor's box, in the tiling's own frame (turned by its angle about the floor's first corner); the plan
// clips them to the floor. Straight, running bond (each row shifted half a piece), checkerboard (every
// other piece shaded) and herringbone (as plans show it: zigzag rows of pieces at 45°).

import type { Point2 } from '../core/vector';
import type { Tiling } from '../elements/room/schema';

export interface TilingDrawing {
  readonly lines: readonly (readonly Point2[])[];
  /** Pieces shaded (a checkerboard's dark ones). */
  readonly shaded: readonly (readonly Point2[])[];
}

/** Lines enough to cover a floor: more than this and the plan draws none (too fine to see). */
const MOST = 4000;

export function tilingDrawing(t: Tiling, outline: readonly Point2[]): TilingDrawing {
  if (outline.length < 3) return { lines: [], shaded: [] };
  const o = outline[0]!;
  const a = (t.angle * Math.PI) / 180;
  const u = { x: Math.cos(a), y: Math.sin(a) };
  const v = { x: -u.y, y: u.x };
  // The floor in the tiling's frame: its extent along u and v.
  const local = outline.map((p) => ({ s: (p.x - o.x) * u.x + (p.y - o.y) * u.y, r: (p.x - o.x) * v.x + (p.y - o.y) * v.y }));
  const s0 = Math.min(...local.map((p) => p.s));
  const s1 = Math.max(...local.map((p) => p.s));
  const r0 = Math.min(...local.map((p) => p.r));
  const r1 = Math.max(...local.map((p) => p.r));
  const W = t.width + t.joint;
  const L = t.length + t.joint;
  const world = (s: number, r: number): Point2 => ({ x: o.x + u.x * s + v.x * r, y: o.y + u.y * s + v.y * r });
  const lines: Point2[][] = [];
  const shaded: Point2[][] = [];
  const too = (n: number) => n > MOST;
  if (t.pattern === 'herringbone') {
    // Zigzag rows: each piece at 45°, the rows a piece's width apart across.
    const P = (t.length / Math.SQRT2) + t.joint;
    const step = W * Math.SQRT2;
    const rows = Math.ceil((r1 - r0 + 2 * P) / step);
    const cols = Math.ceil((s1 - s0 + 2 * P) / P);
    if (too(rows * cols)) return { lines: [], shaded: [] };
    for (let i = 0; i <= rows; i++) {
      const base = r0 - P + i * step;
      const zig: Point2[] = [];
      for (let c = 0; c <= cols; c++) zig.push(world(s0 - P + c * P, base + (c % 2) * P));
      lines.push(zig);
    }
    // The ends of the pieces: short lines across each zigzag leg.
    for (let i = 0; i <= rows; i++) {
      const base = r0 - P + i * step;
      for (let c = 0; c <= cols; c++) {
        const s = s0 - P + c * P;
        lines.push([world(s, base + (c % 2) * P), world(s, base + (c % 2) * P + step)]);
      }
    }
    return { lines, shaded };
  }
  const nu = Math.ceil((s1 - s0) / W) + 2;
  const nv = Math.ceil((r1 - r0) / L) + 2;
  if (too(nu * nv)) return { lines: [], shaded: [] };
  // Starting from the corner: whole pieces there, cut ones at the far sides.
  const su = Math.floor(s0 / W) * W;
  const sv = Math.floor(r0 / L) * L;
  for (let j = 0; j <= nv; j++) lines.push([world(su, sv + j * L), world(su + nu * W, sv + j * L)]);
  if (t.pattern === 'running') {
    for (let j = 0; j < nv; j++) {
      const shift = j % 2 === 0 ? 0 : W / 2;
      for (let i = -1; i <= nu; i++) lines.push([world(su + i * W + shift, sv + j * L), world(su + i * W + shift, sv + (j + 1) * L)]);
    }
  } else {
    for (let i = 0; i <= nu; i++) lines.push([world(su + i * W, sv), world(su + i * W, sv + nv * L)]);
  }
  if (t.pattern === 'checker') {
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nv; j++) {
        if ((i + j + Math.round(su / W) + Math.round(sv / L)) % 2 !== 0) continue;
        const x = su + i * W;
        const y = sv + j * L;
        shaded.push([world(x, y), world(x + W, y), world(x + W, y + L), world(x, y + L)]);
      }
  }
  return { lines, shaded };
}
