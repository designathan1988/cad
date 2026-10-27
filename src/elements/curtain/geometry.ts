// A curtain wall as built: its outline in plan, and its mullions, transoms and panels as boxes in plan
// (a rectangle along it) between two heights. Mullions run its full height at each vertical line;
// transoms run between them at each horizontal line; a panel fills each cell inside its frame. Pure.

import { add, distance, normalize, perp, type Point2, scale, sub } from '../../core/vector';
import { type Curtain, gridLines } from './schema';

export interface CurtainBox {
  /** In plan, counter-clockwise. */
  readonly polygon: readonly Point2[];
  readonly bottom: number;
  readonly top: number;
}

export interface CurtainSolid {
  readonly curtain: Curtain;
  readonly outline: readonly Point2[];
  readonly bottom: number;
  readonly top: number;
  readonly length: number;
  /** Along it, where its vertical lines are (m from its start), and up it, its horizontal ones (m from its foot). */
  readonly verticals: readonly number[];
  readonly horizontals: readonly number[];
  readonly frame: readonly CurtainBox[];
  readonly panels: readonly CurtainBox[];
}

/** Glass a pane's thickness (m); an opaque panel's. */
const PANE = 0.024;
const OPAQUE = 0.04;

/** `levelHeight`: how tall when it sets none; `floor`: its level's floor. */
export function curtainSolid(c: Curtain, levelHeight: number, floor: number): CurtainSolid {
  const length = distance(c.start, c.end);
  const u = length > 0 ? normalize(sub(c.end, c.start)) : { x: 1, y: 0 };
  const n = perp(u);
  const bottom = floor + c.baseOffset;
  const height = Math.max(0.1, c.height ?? levelHeight);
  const top = bottom + height;
  const box = (t0: number, t1: number, across: number, z0: number, z1: number): CurtainBox => {
    const a = add(c.start, scale(u, t0));
    const b = add(c.start, scale(u, t1));
    const h = scale(n, across / 2);
    return { polygon: [sub(a, h), sub(b, h), add(b, h), add(a, h)], bottom: z0, top: z1 };
  };
  const verticals = gridLines(c.vertical, length);
  const horizontals = gridLines(c.horizontal, height);
  const m = Math.min(c.mullion, length / 4);
  const half = m / 2;
  // A mullion centred on each line, kept inside the ends.
  const at = (x: number) => Math.min(Math.max(x - half, 0), length - m);
  const frame: CurtainBox[] = verticals.map((x) => box(at(x), at(x) + m, c.depth, bottom, top));
  const panels: CurtainBox[] = [];
  for (let i = 0; i + 1 < verticals.length; i++) {
    const x0 = at(verticals[i]!) + m;
    const x1 = at(verticals[i + 1]!);
    if (x1 - x0 < 1e-4) continue;
    // Transoms between the mullions, kept inside the foot and the head.
    const zs = horizontals.map((z) => Math.min(Math.max(z - half, 0), height - m));
    for (const z of zs) frame.push(box(x0, x1, c.depth * 0.8, bottom + z, bottom + z + m));
    for (let j = 0; j + 1 < zs.length; j++) {
      const z0 = zs[j]! + m;
      const z1 = zs[j + 1]!;
      if (z1 - z0 > 1e-4) panels.push(box(x0, x1, c.panel === 'glass' ? PANE : OPAQUE, bottom + z0, bottom + z1));
    }
  }
  const h = scale(n, c.depth / 2);
  const outline = [sub(c.start, h), sub(c.end, h), add(c.end, h), add(c.start, h)];
  return { curtain: c, outline, bottom, top, length, verticals, horizontals, frame, panels };
}
