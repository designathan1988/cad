// Arc checks for the oracle. Own circle, own segmentation (the spec's formula), own trapezoids: no
// engine geometry code. What it checks is coverage, by sampling: no point covered twice, no point of
// a wall's body left uncovered, and nothing drawn outside the bodies except around the joined node.

import type { WallEnd } from '../../../src/elements/wall/schema';
import { geometry, layer, type TestWall as Wall } from './fixtures';
import { cornerSpec, frameOf, inside, rectOf, SPEC_MITER_LIMIT, type P, type Region } from './oracle';
import { expectedCorner } from './oracle-x';

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
export function faceRadii(w: Wall, a: OracleArc): [number, number] {
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
 * Segment `i` of an arc as the spec joins it (§5.2): a straight wall along the chord between its two
 * points on the reference line, with every layer × cos(Δ/2). The arc's own ends are kept exact.
 */
export function segmentWall(arc: Wall, i: number): Wall {
  const c = circleOf(arc);
  const n = segmentsOf(arc);
  const d = c.sweep / n;
  const on = (j: number) => (j === 0 ? arc.start : j === n ? arc.end : pt(c.cx + c.r * Math.cos(c.a0 + d * j), c.cy + c.r * Math.sin(c.a0 + d * j)));
  const k = Math.cos(d / 2);
  const seg: Wall = { ...arc, id: `${arc.id}#${i}`, start: on(i), end: on(i + 1), layers: arc.layers.map((l) => layer(l.thickness * k, l.function)), thickness: arc.thickness * k };
  delete (seg as { bulge?: number }).bulge;
  return seg;
}

/**
 * The region the spec gives an L between an arc's end and a straight wall: the arc joins as its chain
 * of straight segments (spec §5.2), so near the node it is the straight L (oracle.ts, expectedL)
 * between the end segment (the chord of the reference circle, layer offsets × cos(Δ/2)) and the
 * wall. `applies`: where that alone decides: along the end segment, short of its far joint (radial,
 * not square as the straight L's far end) by the thickness times tan(Δ/2), and outside the arc's
 * other segments. 'overlap' when the spec says that L warns.
 */
export function arcCorner(arc: Wall, arcEnd: WallEnd, straight: Wall, straightEnd: WallEnd): { region: Region; applies: (p: P) => boolean } | 'overlap' {
  const c = circleOf(arc);
  const n = segmentsOf(arc);
  const d = c.sweep / n;
  const seg = segmentWall(arc, arcEnd === 'start' ? 0 : n - 1);
  // The spec's corner (oracle-x.ts): the miter rules, and with different sequences the butt's own. The
  // end segment's free end is the arc's own far end (spec §5.2, §7.1): its reach is the arc's length,
  // along its chain of chords.
  const chainLength = n * 2 * c.r * Math.abs(Math.sin(d / 2));
  // The region is built with the end segment's chord carried on past any corner the spec allows
  // (MITER_LIMIT × max(T)): with the corner past the segment's own far end, a region with that end as a
  // vertex folds over itself. Where it applies is still bounded by the segment itself (below).
  const chordLen = Math.hypot(seg.end.x - seg.start.x, seg.end.y - seg.start.y);
  const extra = SPEC_MITER_LIMIT * Math.max(seg.thickness, straight.thickness);
  const ux = (seg.end.x - seg.start.x) / chordLen;
  const uy = (seg.end.y - seg.start.y) / chordLen;
  const longSeg: Wall =
    arcEnd === 'start'
      ? { ...seg, end: pt(seg.start.x + ux * (chordLen + extra), seg.start.y + uy * (chordLen + extra)) }
      : { ...seg, start: pt(seg.end.x - ux * (chordLen + extra), seg.end.y - uy * (chordLen + extra)) };
  const region = expectedCorner(longSeg, arcEnd, straight, straightEnd, undefined, { a: chainLength });
  if (region === 'overlap') return 'overlap';
  // Where this L is the spec's: in the end segment's wedge (between its two radial planes) and outside
  // the arc's sweep (the corner's tip past its end), never in the other segments' bodies, which are
  // checked as bodies. The wedge, not a distance along the chord: an acute butt trims the end
  // segment's far part too, past the other wall's outer face.
  const body = arcBody(arc);
  const others = arcEnd === 'start' ? body.slice(1) : body.slice(0, -1);
  const turn = (q: P) => {
    const t = ((Math.atan2(q.y - c.cy, q.x - c.cx) - c.a0) * Math.sign(c.sweep)) % (2 * Math.PI);
    return t < 0 ? t + 2 * Math.PI : t;
  };
  const sweep = Math.abs(c.sweep);
  const step = Math.abs(d);
  const inEndWedge = (q: P) => (arcEnd === 'start' ? turn(q) <= step : turn(q) >= sweep - step && turn(q) <= sweep);
  // Outside the sweep on the node's side of the gap only: past the arc's other end is not this corner.
  const pastNode = (q: P) => {
    const t = turn(q);
    if (t <= sweep) return false;
    const fromEnd = t - sweep;
    const fromStart = 2 * Math.PI - t;
    return arcEnd === 'end' ? fromEnd <= fromStart : fromStart < fromEnd;
  };
  return { region, applies: (q) => (inEndWedge(q) || pastNode(q)) && !others.some((b) => inside(b, q)) };
}

/**
 * Samples around every body and the node. Overlap: two pieces. Gap: a body point no piece covers.
 * Extra: a covered point outside every body, farther than `tip` from the node (the miter's outer tip
 * and the end the corner fills lie within it). With `corner` (arcCorner), points near the node where it
 * applies must be covered once exactly where its region is, and nowhere else: an acute L trims the
 * end of a body that would stick out past the other wall's outer face.
 */
/**
 * `notKept`: points of a wall's own body that its join does not keep (tBeyond: what of a wall abutting
 * the arc lies past it, spec §7.2), checked as outside every body.
 */
export function coverage(
  walls: readonly Wall[],
  node: P | null,
  tip: number,
  seed: number,
  corner?: { region: Region; applies: (p: P) => boolean },
  notKept?: (p: P) => boolean,
): Coverage {
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
    const inBody = bodies.some((b) => inside(b, p)) && !notKept?.(p);
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

/** Area two convex polygons share (the oracle's own clipping: Sutherland–Hodgman, either winding). */
export function sharedArea(a: readonly P[], b: readonly P[]): number {
  const signed = (poly: readonly P[]) => poly.reduce((s, p, i) => s + p.x * poly[(i + 1) % poly.length]!.y - poly[(i + 1) % poly.length]!.x * p.y, 0) / 2;
  const ccw = (poly: readonly P[]) => (signed(poly) < 0 ? [...poly].reverse() : [...poly]);
  let out: P[] = ccw(a);
  const clip = ccw(b);
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const p = clip[i]!;
    const q = clip[(i + 1) % clip.length]!;
    const side = (v: P) => (q.x - p.x) * (v.y - p.y) - (q.y - p.y) * (v.x - p.x);
    const next: P[] = [];
    out.forEach((v, k) => {
      const w = out[(k + 1) % out.length]!;
      const sv = side(v);
      const sw = side(w);
      if (sv >= 0) next.push(v);
      if ((sv >= 0) !== (sw >= 0)) {
        const t = sv / (sv - sw);
        next.push(pt(v.x + (w.x - v.x) * t, v.y + (w.y - v.y) * t));
      }
    });
    out = next;
  }
  return out.length >= 3 ? Math.abs(signed(out)) : 0;
}

/**
 * A straight wall joined at one end of an arc also touching the arc elsewhere: its body shares area
 * with a segment of the arc other than the end one. The spec warns then (part 6: any overlap left
 * between an arc and another wall is reported), however small.
 */
export function touchesArcElsewhere(arc: Wall, arcEnd: WallEnd, straight: Wall): boolean {
  const body = arcBody(arc);
  const others = arcEnd === 'start' ? body.slice(1) : body.slice(0, -1);
  const rect = rectOf(straight);
  return others.some((b) => sharedArea(rect, b) > 0);
}

/**
 * How far `p` is from the arc as the spec joins it: from the nearest of its segments' rectangles
 * (segmentWall), 0 inside one. An end within POINT_TOLERANCE of a band meets that wall (spec §6).
 */
export function distanceToSegments(arc: Wall, p: P): number {
  const toEdge = (a: P, b: P) => {
    const ab = pt(b.x - a.x, b.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y)));
    return Math.hypot(p.x - a.x - ab.x * t, p.y - a.y - ab.y * t);
  };
  let best = Infinity;
  for (let i = 0; i < segmentsOf(arc); i++) {
    const r = rectOf(segmentWall(arc, i));
    best = Math.min(best, inside(r, p) ? 0 : Math.min(...r.map((v, k) => toEdge(v, r[(k + 1) % r.length]!))));
  }
  return best;
}

/**
 * Whether a wall ending in an arc's band comes to it from outside the ring: the first point of its
 * axis, walking back from the end, that is out of the band says. (Its far end can lie on the circle
 * itself, past the arc's sweep, where its radius alone would leave it to rounding.)
 */
export function comesFromOutside(arc: Wall, wall: Wall, end: WallEnd = 'end'): boolean {
  const c = circleOf(arc);
  const [ra, rb] = faceRadii(arc, c);
  const [rIn, rOut] = [Math.min(ra, rb), Math.max(ra, rb)];
  const f = frameOf(wall);
  const at = end === 'end' ? wall.end : wall.start;
  const into = end === 'end' ? pt(-f.d.x, -f.d.y) : f.d;
  const step = Math.min(rOut - rIn, f.len) / 8;
  for (let s = 0; s <= f.len; s += step) {
    const r = Math.hypot(at.x + into.x * s - c.cx, at.y + into.y * s - c.cy);
    if (r > rOut) return true;
    if (r < rIn) return false;
  }
  return Math.hypot(at.x + into.x * f.len - c.cx, at.y + into.y * f.len - c.cy) > (rIn + rOut) / 2;
}

/**
 * What of the abutting wall's own rectangle a T against an arc does not keep (spec §7.2: the abutting
 * wall stays on its side of the host): a point in the arc's sweep, outside its body, on the far side
 * from where the wall comes. A tilted square end can poke through a thin arc there.
 */
export function tBeyond(arc: Wall, wall: Wall, end: WallEnd = 'end'): (p: P) => boolean {
  const c = circleOf(arc);
  const [ra, rb] = faceRadii(arc, c);
  const rMid = (ra + rb) / 2;
  const dist = (p: P) => Math.hypot(p.x - c.cx, p.y - c.cy);
  const outside = comesFromOutside(arc, wall, end);
  const body = arcBody(arc);
  const inSweep = (p: P) => {
    const t = ((Math.atan2(p.y - c.cy, p.x - c.cx) - c.a0) * Math.sign(c.sweep)) % (2 * Math.PI);
    return (t < 0 ? t + 2 * Math.PI : t) <= Math.abs(c.sweep);
  };
  return (p) => inSweep(p) && !body.some((b) => inside(b, p)) && (outside ? dist(p) < rMid : dist(p) > rMid);
}

/**
 * What a T against an arc fills past the wall's end (spec §7.2: the abutting wall runs up to the
 * host's face): a point of the wall's band past its end, outside the arc's body, inside the arc's sweep,
 * on the side the wall comes from (outside the ring's middle radius when it comes from outside), and
 * not across the ring: the stretch from it back to the end does not pass inside the ring.
 */
export function tFill(arc: Wall, wall: Wall, end: WallEnd = 'end'): (p: P) => boolean {
  const c = circleOf(arc);
  const [ra, rb] = faceRadii(arc, c);
  const [rIn, rOut] = [Math.min(ra, rb), Math.max(ra, rb)];
  const rMid = (rIn + rOut) / 2;
  const f = frameOf(wall);
  const at = end === 'end' ? wall.end : wall.start;
  const into = end === 'end' ? pt(-f.d.x, -f.d.y) : f.d;
  const dist = (p: P) => Math.hypot(p.x - c.cx, p.y - c.cy);
  const outside = comesFromOutside(arc, wall, end);
  const body = arcBody(arc);
  const inSweep = (p: P) => {
    const t = ((Math.atan2(p.y - c.cy, p.x - c.cx) - c.a0) * Math.sign(c.sweep)) % (2 * Math.PI);
    return (t < 0 ? t + 2 * Math.PI : t) <= Math.abs(c.sweep);
  };
  // Least distance from the centre to the stretch from p to q.
  const nearest = (p: P, q: P) => {
    const pq = pt(q.x - p.x, q.y - p.y);
    const l2 = pq.x * pq.x + pq.y * pq.y;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((c.cx - p.x) * pq.x + (c.cy - p.y) * pq.y) / l2));
    return Math.hypot(p.x + pq.x * t - c.cx, p.y + pq.y * t - c.cy);
  };
  return (p) => {
    const along = (p.x - at.x) * into.x + (p.y - at.y) * into.y;
    if (along >= 0) return false;
    const off = (p.x - wall.start.x) * f.n.x + (p.y - wall.start.y) * f.n.y;
    if (off < f.o0 || off > f.o1 || !inSweep(p) || body.some((b) => inside(b, p))) return false;
    if (outside ? dist(p) <= rMid : dist(p) >= rMid) return false;
    const back = pt(p.x - into.x * along, p.y - into.y * along);
    return !outside || nearest(p, back) >= rIn;
  };
}

/**
 * How far along a straight wall (from the node, into its body) the L made with an arc's end segment
 * reaches: the farthest of the four points where the wall's faces meet the end segment's faces. A
 * contact with the arc's other segments that starts within it is the corner itself reaching past the
 * end segment; one that starts beyond it is a second junction.
 */
export function cornerReach(arc: Wall, arcEnd: WallEnd, wall: Wall): number {
  const seg = segmentWall(arc, arcEnd === 'start' ? 0 : segmentsOf(arc) - 1);
  const node = arcEnd === 'start' ? arc.start : arc.end;
  const fs = frameOf(seg);
  const fw = frameOf(wall);
  const into = pt(wall.start.x - wall.end.x, wall.start.y - wall.end.y);
  const len = Math.hypot(into.x, into.y);
  const u = pt(into.x / len, into.y / len);
  const meetAt = (a: P, da: P, b: P, db: P) => {
    const det = da.x * db.y - da.y * db.x;
    const t = ((b.x - a.x) * db.y - (b.y - a.y) * db.x) / det;
    return pt(a.x + da.x * t, a.y + da.y * t);
  };
  const on = (w: Wall, f: { n: P }, o: number) => pt(w.start.x + f.n.x * o, w.start.y + f.n.y * o);
  const points = [fs.o0, fs.o1].flatMap((os) => [fw.o0, fw.o1].map((ow) => meetAt(on(seg, fs, os), fs.d, on(wall, fw, ow), fw.d)));
  const faces = Math.max(...points.map((p) => (p.x - node.x) * u.x + (p.y - node.y) * u.y));
  // The spec bounds the corner itself (§7.1): an obtuse one past MITER_LIMIT × max(T) is one cut through
  // the node, reaching along the wall no farther than a thickness; an acute one is bevelled there.
  const limit = SPEC_MITER_LIMIT * Math.max(seg.thickness, wall.thickness);
  const spec = cornerSpec(seg, arcEnd, wall, 'end', node);
  if (spec.kind === 'shared') return Math.max(seg.thickness, wall.thickness);
  return Math.min(faces, limit);
}
