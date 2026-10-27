// Hatching as lines (phase 11: DXF "hachuras"): parallel lines across closed outlines, kept where they
// are inside (even-odd: a hole stays clear), as a CAD program draws a hatch pattern. A pattern per cut
// material: brick 45° single, concrete 45° crossed, wood along, insulation and solid none here (R12 has
// no HATCH entity; the outline says them). Pure.

import type { Point2 } from '../core/vector';
import type { CutPattern } from '../elements/material/schema';

/** Lines at `angle` (radians), `spacing` apart (m), inside the outlines. */
export function hatchLines(loops: readonly (readonly Point2[])[], angle: number, spacing: number): [Point2, Point2][] {
  const pts = loops.flat();
  if (pts.length < 3 || !(spacing > 0)) return [];
  // In a frame where the lines run along u: v is across them.
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const uv = (p: Point2) => ({ u: p.x * c + p.y * s, v: -p.x * s + p.y * c });
  const xy = (u: number, v: number): Point2 => ({ x: u * c - v * s, y: u * s + v * c });
  const vs = pts.map((p) => uv(p).v);
  const lo = Math.min(...vs);
  // Strictly inside: a line on the outline's lowest edge would draw that edge twice.
  let v0 = Math.ceil(lo / spacing) * spacing;
  if (v0 - lo < 1e-9) v0 += spacing;
  const v1 = Math.max(...vs);
  const edges = loops.flatMap((l) => l.map((p, i) => [uv(p), uv(l[(i + 1) % l.length]!)] as const));
  const out: [Point2, Point2][] = [];
  for (let v = v0; v <= v1 + 1e-12; v += spacing) {
    const at: number[] = [];
    for (const [a, b] of edges) {
      // Half-open, so a vertex on the line counts once.
      if ((a.v <= v) !== (b.v <= v)) at.push(a.u + ((v - a.v) / (b.v - a.v)) * (b.u - a.u));
    }
    at.sort((p, q) => p - q);
    for (let i = 0; i + 1 < at.length; i += 2) if (at[i + 1]! - at[i]! > 1e-9) out.push([xy(at[i]!, v), xy(at[i + 1]!, v)]);
  }
  return out;
}

/** A cut material's hatch: its angles and spacing (m), none for those drawn plain. */
export function patternOf(cut: CutPattern): { angles: number[]; spacing: number } | null {
  switch (cut) {
    case 'brick':
      return { angles: [Math.PI / 4], spacing: 0.04 };
    case 'concrete':
      return { angles: [Math.PI / 4, -Math.PI / 4], spacing: 0.06 };
    case 'wood':
      return { angles: [0], spacing: 0.02 };
    default:
      return null;
  }
}
