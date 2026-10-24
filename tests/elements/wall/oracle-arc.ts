// Arc checks for the oracle. Own circle, own segmentation (the spec's formula), own trapezoids: no
// engine geometry code. What it checks is coverage, by sampling: no point covered twice, no point of
// a wall's body left uncovered, and nothing drawn outside the bodies except around the joined node.

import type { WallEnd } from '../../../src/elements/wall/schema';
import { geometry, layer, type TestWall as Wall } from './fixtures';
import { expectedL, frameOf, inside, rectOf, type P, type Region } from './oracle';

const SPEC_ARC_SAG = 5e-4;
const pt = (x: number, y: number): P => ({ x, y });

export interface OracleArc {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly a0: number;
  readonly sweep: number;
  /** +1 counter-clockwise: offset o along the left normal is radius r − o; −1: r + o. */
  readonly turn: number;
}

export function circleOf(w: Wall): OracleArc {
  const b = w.bulge!;
  const dx = w.end.x - w.start.x;
  const dy = w.end.y - w.start.y;
  const c = Math.hypot(dx, dy);
  const sweep = 4 * Math.atan(b);
  const r = c / (2 * Math.abs(Math.sin(sweep / 2)));
  // The centre sits on the chord's perpendicular bisector, on the left for a counter-clockwise arc,
  // at distance r·cos(sweep/2) (negative past a semicircle).
  const h = r * Math.cos(sweep / 2) * Math.sign(b);
  const cx = (w.start.x + w.end.x) / 2 - (dy / c) * h;
  const cy = (w.start.y + w.end.y) / 2 + (dx / c) * h;
  return { cx, cy, r, a0: Math.atan2(w.start.y - cy, w.start.x - cx), sweep, turn: Math.sign(b) };
}

/** Outer and inner face radii of the whole wall, from its own frame. */
function faceRadii(w: Wall, a: OracleArc): [number, number] {
  const f = frameOf({ ...w });
  return [a.r - a.turn * f.o0, a.r - a.turn * f.o1];
}

export function segmentsOf(w: Wall): number {
  const a = circleOf(w);
  const rMax = Math.max(...faceRadii(w, a));
  return Math.max(1, Math.ceil(Math.abs(a.sweep) / (2 * Math.acos(1 - SPEC_ARC_SAG / rMax))));
}

/** The arc's body: one trapezoid per segment, vertices on its two face circles. */
export function arcBody(w: Wall): P[][] {
  const a = circleOf(w);
  const [r0, r1] = faceRadii(w, a);
  const n = segmentsOf(w);
  const at = (ang: number, rad: number) => pt(a.cx + rad * Math.cos(ang), a.cy + rad * Math.sin(ang));
  const out: P[][] = [];
  for (let i = 0; i < n; i++) {
    const p = a.a0 + (a.sweep * i) / n;
    const q = a.a0 + (a.sweep * (i + 1)) / n;
    out.push([at(p, r0), at(q, r0), at(q, r1), at(p, r1)]);
  }
  return out;
}

const bodyOf = (w: Wall): P[][] => (w.bulge ? arcBody(w) : [rectOf(w)]);

/** Unit direction into the wall's body from an end: the tangent for an arc. */
export function intoOf(w: Wall, end: WallEnd): P {
  if (!w.bulge) {
    const f = frameOf(w);
    return end === 'start' ? f.d : pt(-f.d.x, -f.d.y);
  }
  const a = circleOf(w);
  const ang = end === 'start' ? a.a0 : a.a0 + a.sweep;
  const t = pt(-Math.sin(ang) * a.turn, Math.cos(ang) * a.turn);
  return end === 'start' ? t : pt(-t.x, -t.y);
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Coverage {
  readonly samples: number;
  readonly overlaps: number;
  readonly gaps: number;
  readonly extras: number;
  readonly firstBad: P | null;
}

/**
 * The region the spec gives an L between an arc's end and a straight wall: the arc joins as its chain
 * of straight segments (spec §5.2), so near the node it is the straight L (oracle.ts, expectedL)
 * between the end segment (the chord of the reference circle, layer offsets × cos(Δ/2)) and the
 * wall. `applies`: where that alone decides: along the end segment, short of its far joint (radial,
 * not square as the straight L's far end), by the thickness times tan(Δ/2). 'overlap' when the spec
 * says that L warns.
 */
export function arcCorner(arc: Wall, arcEnd: WallEnd, straight: Wall, straightEnd: WallEnd): { region: Region; applies: (p: P) => boolean } | 'overlap' {
  const c = circleOf(arc);
  const n = segmentsOf(arc);
  const d = c.sweep / n;
  const ang = arcEnd === 'start' ? c.a0 + d : c.a0 + c.sweep - d;
  const p = pt(c.cx + c.r * Math.cos(ang), c.cy + c.r * Math.sin(ang));
  const k = Math.cos(d / 2);
  const ls = arc.layers.map((l) => layer(l.thickness * k, l.function));
  const node = arcEnd === 'start' ? arc.start : arc.end;
  const seg: Wall = { ...arc, id: `${arc.id}#end`, start: arcEnd === 'start' ? node : p, end: arcEnd === 'start' ? p : node, layers: ls, thickness: arc.thickness * k };
  delete (seg as { bulge?: number }).bulge;
  const region = expectedL(seg, arcEnd, straight, straightEnd);
  if (region === 'overlap') return 'overlap';
  const len = Math.hypot(p.x - node.x, p.y - node.y);
  const dir = pt((p.x - node.x) / len, (p.y - node.y) / len);
  const short = len - arc.thickness * Math.abs(Math.tan(d / 2)) - 1e-6;
  return { region, applies: (q) => (q.x - node.x) * dir.x + (q.y - node.y) * dir.y <= short };
}

/**
 * Samples around every body and the node. Overlap: two pieces. Gap: a body point no piece covers.
 * Extra: a covered point outside every body, farther than `tip` from the node (the miter's outer tip
 * and the end the corner fills lie within it). With `corner` (arcCorner), points near the node where it
 * applies must be covered once exactly where its region is, and nowhere else: an acute L trims the
 * end of a body that would stick out past the other wall's outer face.
 */
export function coverage(walls: readonly Wall[], node: P | null, tip: number, seed: number, corner?: { region: Region; applies: (p: P) => boolean }): Coverage {
  const { pieces } = geometry(walls);
  const polys = walls.flatMap((w) => (pieces.get(w.id) ?? []).map((p) => p.polygon));
  const bodies = walls.flatMap(bodyOf);
  const rnd = mulberry32(seed);
  let samples = 0;
  let overlaps = 0;
  let gaps = 0;
  let extras = 0;
  let firstBad: P | null = null;
  // Points on an edge (of a body, or of the corner's region) could go either way: not tested.
  const edges = [...bodies.flatMap((b) => b.map((v, i) => [v, b[(i + 1) % b.length]!] as const)), ...(corner?.region.edges ?? [])];
  const nearEdge = (p: P) =>
    edges.some(([a, b]) => {
      const ab = pt(b.x - a.x, b.y - a.y);
      const l2 = ab.x * ab.x + ab.y * ab.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2));
      return Math.hypot(p.x - a.x - ab.x * t, p.y - a.y - ab.y * t) < 1e-7;
    });
  const test = (p: P) => {
    if (nearEdge(p)) return;
    samples++;
    const count = polys.filter((q) => inside(q, p)).length;
    if (corner && node && Math.hypot(p.x - node.x, p.y - node.y) <= tip && corner.applies(p)) {
      const want = corner.region.contains(p) ? 1 : 0;
      if (count !== want) {
        if (count > want) overlaps++;
        else gaps++;
        if (firstBad === null) firstBad = p;
      }
      return;
    }
    const inBody = bodies.some((b) => inside(b, p));
    const nearNode = node !== null && Math.hypot(p.x - node.x, p.y - node.y) <= tip;
    let bad = false;
    if (count > 1) (overlaps++, (bad = true));
    else if (inBody && count === 0) (gaps++, (bad = true));
    else if (!inBody && count > 0 && !nearNode) (extras++, (bad = true));
    if (bad && firstBad === null) firstBad = p;
  };
  for (const b of bodies) {
    const xs = b.map((v) => v.x);
    const ys = b.map((v) => v.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const m = 0.05;
    for (let i = 0; i < 12; i++) test(pt(x0 - m + (x1 - x0 + 2 * m) * rnd(), y0 - m + (y1 - y0 + 2 * m) * rnd()));
  }
  if (node) {
    for (let i = 0; i < 400; i++) {
      const ang = 2 * Math.PI * rnd();
      const rad = tip * 1.5 * Math.sqrt(rnd());
      test(pt(node.x + rad * Math.cos(ang), node.y + rad * Math.sin(ang)));
    }
  }
  return { samples, overlaps, gaps, extras, firstBad };
}
