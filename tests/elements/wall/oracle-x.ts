// Crossing (X) expectations for the oracle. Own math only.

import type { WallEnd } from '../../../src/elements/wall/schema';
import { geometry, type TestWall as Wall } from './fixtures';
import { type CornerKind, cornerSpec, expectedL, frameOf, inside, into, rectOf, shoelace, type P, type Region } from './oracle';
import { coreLayersOf, layerOffsetsOf, sameSequence, tFaces } from './oracle-layers';

const pt = (x: number, y: number): P => ({ x, y });

/** Line through p along u meets line through q along w (Cramer). */
function meet(p: P, u: P, q: P, w: P): P {
  const det = u.x * -w.y - u.y * -w.x;
  const s = ((q.x - p.x) * -w.y - (q.y - p.y) * -w.x) / det;
  return pt(p.x + u.x * s, p.y + u.y * s);
}

/** Where the two reference lines cross. */
export const crossingOf = (a: Wall, b: Wall): P => meet(a.start, frameOf(a).d, b.start, frameOf(b).d);

const SPEC_POINT_TOL = 1e-3;

const coreThickness = (w: Wall) => {
  const [c0, c1] = coreLayersOf(w);
  let sum = 0;
  for (let k = c0; k <= c1; k++) sum += w.layers[k]!.thickness;
  return sum;
};

/** The spec's choice: the thicker core goes through; cores within 1 mm tie, and the lower id goes. */
export function throughOf(a: Wall, b: Wall): { through: Wall; cut: Wall } {
  const ca = coreThickness(a);
  const cb = coreThickness(b);
  const aThrough = Math.abs(ca - cb) <= SPEC_POINT_TOL ? a.id < b.id : ca > cb;
  return aThrough ? { through: a, cut: b } : { through: b, cut: a };
}

/** The overlap of the two bands: a parallelogram from the four face-line crossings. */
export function overlapOf(a: Wall, b: Wall): P[] {
  const fa = frameOf(a);
  const fb = frameOf(b);
  const on = (w: Wall, o: number) => {
    const f = frameOf(w);
    return pt(w.start.x + f.n.x * o, w.start.y + f.n.y * o);
  };
  return [
    meet(on(a, fa.o0), fa.d, on(b, fb.o0), fb.d),
    meet(on(a, fa.o0), fa.d, on(b, fb.o1), fb.d),
    meet(on(a, fa.o1), fa.d, on(b, fb.o1), fb.d),
    meet(on(a, fa.o1), fa.d, on(b, fb.o0), fb.d),
  ];
}

/** An X only redistributes material: the region is the union of both bands. */
export function expectedX(a: Wall, b: Wall): Region {
  const ra = rectOf(a);
  const rb = rectOf(b);
  const edges = (poly: P[]): [P, P][] => poly.map((v, i) => [v, poly[(i + 1) % poly.length]!]);
  return {
    area: shoelace(ra) + shoelace(rb) - shoelace(overlapOf(a, b)),
    contains: (p) => inside(ra, p) || inside(rb, p),
    edges: [...edges(ra), ...edges(rb)],
  };
}

/**
 * Each side of the crossing as a T: the cut wall up to the crossing, and from it. A piece belongs to
 * the side of the through wall's core midline its centroid lies on. (Stations along the cut wall do
 * not work: at a shallow angle a far layer of one side is cut so obliquely that its centroid falls
 * past the crossing.) A piece that wrongly crossed the midline lands on the other side and fails there.
 */
export function sidesOf(
  cut: Wall,
  through: Wall,
  x: P,
): { abutting: Wall; end: WallEnd; keep: (poly: readonly P[]) => boolean }[] {
  const ft = frameOf(through);
  const offs = layerOffsetsOf(through);
  const [c0, c1] = coreLayersOf(through);
  const mid = (offs[c0]! + offs[c1 + 1]!) / 2;
  const side = (poly: readonly P[]) => {
    const cx = poly.reduce((s, v) => s + v.x, 0) / poly.length;
    const cy = poly.reduce((s, v) => s + v.y, 0) / poly.length;
    return (cx - through.start.x) * ft.n.x + (cy - through.start.y) * ft.n.y - mid;
  };
  // The part before the crossing lies on the side the cut wall comes from.
  const startSide = Math.sign((cut.start.x - x.x) * ft.n.x + (cut.start.y - x.y) * ft.n.y);
  return [
    { abutting: { ...cut, end: x }, end: 'end', keep: (poly) => Math.sign(side(poly)) === startSide },
    { abutting: { ...cut, start: x }, end: 'start', keep: (poly) => Math.sign(side(poly)) === -startSide },
  ];
}

const SPEC_MITER_LIMIT = 10;

/**
 * The butt layer by layer between two straight walls (§7.1): `t` goes through (throughOf), `c` stops
 * against it. Each wall's layers are inner (on the side of the other wall's body), core, or outer, and
 * each stops on a line of the other wall, given as an offset across that wall:
 *
 * - t: outer layers on c's outer face, core on c's outer core face, inner layers on c's inner core face;
 * - c: inner layers on t's inner face, core on t's inner core face, outer layers on t's outer core face.
 *
 * `tPositive`: t's body lies on the positive side of c's frame; `cPositive`: c's on t's.
 */
export function buttRule(a: Wall, aEnd: WallEnd, b: Wall, bEnd: WallEnd) {
  const { through: t, cut: c } = throughOf(a, b);
  const tEnd = t === a ? aEnd : bEnd;
  const cEnd = c === a ? aEnd : bEnd;
  const ft = frameOf(t);
  const fc = frameOf(c);
  const ut = into(t, tEnd);
  const uc = into(c, cEnd);
  const tPositive = ut.x * fc.n.x + ut.y * fc.n.y > 0;
  const cPositive = uc.x * ft.n.x + uc.y * ft.n.y > 0;
  const tOffs = layerOffsetsOf(t);
  const cOffs = layerOffsetsOf(c);
  const [tc0, tc1] = coreLayersOf(t);
  const [cc0, cc1] = coreLayersOf(c);
  const kind = (k: number, c0: number, c1: number, innerPositive: boolean): 'inner' | 'core' | 'outer' =>
    k >= c0 && k <= c1 ? 'core' : (k > c1) === innerPositive ? 'inner' : 'outer';
  const cLines = {
    outer: tPositive ? fc.o0 : fc.o1,
    core: tPositive ? cOffs[cc0]! : cOffs[cc1 + 1]!,
    inner: tPositive ? cOffs[cc1 + 1]! : cOffs[cc0]!,
  };
  const tLines = {
    inner: cPositive ? ft.o1 : ft.o0,
    core: cPositive ? tOffs[tc1 + 1]! : tOffs[tc0]!,
    outer: cPositive ? tOffs[tc0]! : tOffs[tc1 + 1]!,
  };
  const tStops = t.layers.map((_, k) => cLines[kind(k, tc0, tc1, cPositive)]);
  const cStops = c.layers.map((_, k) => tLines[kind(k, cc0, cc1, tPositive)]);
  return { t, tEnd, c, cEnd, ft, fc, tPositive, cPositive, tOffs, cOffs, tStops, cStops };
}

/** Where each layer's band edges meet the line it stops on: the butt's own corners. */
export function buttReached(a: Wall, aEnd: WallEnd, b: Wall, bEnd: WallEnd): P[] {
  const r = buttRule(a, aEnd, b, bEnd);
  const on = (w: Wall, o: number) => {
    const f = frameOf(w);
    return pt(w.start.x + f.n.x * o, w.start.y + f.n.y * o);
  };
  return [
    ...r.tStops.flatMap((stop, k) => [r.tOffs[k]!, r.tOffs[k + 1]!].map((o) => meet(on(r.t, o), r.ft.d, on(r.c, stop), r.fc.d))),
    ...r.cStops.flatMap((stop, k) => [r.cOffs[k]!, r.cOffs[k + 1]!].map((o) => meet(on(r.c, o), r.fc.d, on(r.t, stop), r.ft.d))),
  ];
}

/** How far any layer piece of either wall passes the line its layer stops on (≤ 0: none). */
export function buttPenetration(a: Wall, aEnd: WallEnd, b: Wall, bEnd: WallEnd, walls: readonly Wall[]): number {
  const r = buttRule(a, aEnd, b, bEnd);
  const { pieces } = geometry(walls);
  let worst = -Infinity;
  const check = (w: Wall, other: Wall, stops: readonly number[], positive: boolean) => {
    const fo = frameOf(other);
    for (const piece of pieces.get(w.id) ?? []) {
      const limit = stops[piece.layerIndex]!;
      for (const v of piece.polygon) {
        const o = fo.n.x * (v.x - other.start.x) + fo.n.y * (v.y - other.start.y);
        worst = Math.max(worst, positive ? limit - o : o - limit);
      }
    }
  };
  check(r.t, r.c, r.tStops, r.tPositive);
  check(r.c, r.t, r.cStops, r.cPositive);
  return worst;
}

/**
 * Inside the overlap of the two bands, short of both free ends, every point belongs to exactly one
 * layer by the rule: t's layer there if the point is on t's side of that layer's stop, else c's layer
 * there if on c's side of its own; and the engine's piece there is that layer. Points on a line are
 * skipped. `bad` also counts points the rule itself gives to both or neither.
 */
export function buttOwnership(a: Wall, aEnd: WallEnd, b: Wall, bEnd: WallEnd, walls: readonly Wall[], seed: number): { checked: number; bad: number } {
  const r = buttRule(a, aEnd, b, bEnd);
  const { pieces } = geometry(walls);
  const quad = overlapOf(a, b);
  const eps = 1e-6;
  let x = seed >>> 0 || 1;
  const rnd = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296);
  const offset = (w: Wall, p: P) => {
    const f = frameOf(w);
    return f.n.x * (p.x - w.start.x) + f.n.y * (p.y - w.start.y);
  };
  const shortOfFree = (w: Wall, end: WallEnd, p: P) => {
    const free = end === 'start' ? w.end : w.start;
    const u = into(w, end);
    return (p.x - free.x) * u.x + (p.y - free.y) * u.y < -eps;
  };
  const layerAt = (offs: readonly number[], o: number) => offs.findIndex((v, i) => i + 1 < offs.length && o > v && o < offs[i + 1]!);
  const near = (o: number, lines: readonly number[]) => lines.some((v) => Math.abs(o - v) < eps);
  let checked = 0;
  let bad = 0;
  for (let i = 0; i < 300; i++) {
    // A point of the parallelogram: its first corner plus a mix of the two sides from it.
    const s = rnd();
    const t = rnd();
    const p = pt(
      quad[0]!.x + (quad[1]!.x - quad[0]!.x) * s + (quad[3]!.x - quad[0]!.x) * t,
      quad[0]!.y + (quad[1]!.y - quad[0]!.y) * s + (quad[3]!.y - quad[0]!.y) * t,
    );
    if (!shortOfFree(r.t, r.tEnd, p) || !shortOfFree(r.c, r.cEnd, p)) continue;
    const ot = offset(r.t, p);
    const oc = offset(r.c, p);
    if (near(ot, [...r.tOffs, ...r.cStops]) || near(oc, [...r.cOffs, ...r.tStops])) continue;
    const kt = layerAt(r.tOffs, ot);
    const kc = layerAt(r.cOffs, oc);
    if (kt < 0 || kc < 0) continue;
    checked++;
    const tOwns = r.tPositive ? oc > r.tStops[kt]! : oc < r.tStops[kt]!;
    const cOwns = r.cPositive ? ot > r.cStops[kc]! : ot < r.cStops[kc]!;
    if (tOwns === cOwns) {
      bad++;
      continue;
    }
    const [wall, layerIndex] = tOwns ? [r.t, kt] : [r.c, kc];
    const owner = walls.find((w) => (pieces.get(w.id) ?? []).some((piece) => inside(piece.polygon, p)));
    const piece = owner && (pieces.get(owner.id) ?? []).find((q) => inside(q.polygon, p));
    if (owner?.id !== wall.id || piece?.layerIndex !== layerIndex) bad++;
  }
  return { checked, bad };
}

/**
 * How the spec resolves an L (§7.1): the miter classification, and for different sequences a butt.
 * Between two straight walls the butt goes layer by layer (buttRule): each layer's band edges on the
 * line it stops on are its corners. With an arc's segment (`layered` off) the butt is a T: one corner,
 * the through wall's inner face on the other's outer face, where its square end reaches across its
 * whole width, and the abutting layers reach into the through wall as in a T. Any of those points past
 * either free end swallows a wall (overlap); at an obtuse angle farther than MITER_LIMIT·T from the
 * node it is a long taper (shared cut), as for the miter's corners.
 */
export function cornerJoin(
  a: Wall,
  aEnd: WallEnd,
  b: Wall,
  bEnd: WallEnd,
  node?: P,
  reach: { a?: number; b?: number } = {},
  layered = true,
): { kind: CornerKind; butt: boolean } {
  const c = cornerSpec(a, aEnd, b, bEnd, node, reach);
  if ((c.kind !== 'miter' && c.kind !== 'bevel') || sameSequence(a, aEnd, b, bEnd, node)) return { kind: c.kind, butt: false };
  const past = (w: Wall, end: WallEnd, p: P, limit?: number) => {
    const f = frameOf(w);
    const u = end === 'start' ? f.d : pt(-f.d.x, -f.d.y);
    const farEnd = end === 'start' ? w.end : w.start;
    const along = (x: P) => (x.x - c.node.x) * u.x + (x.y - c.node.y) * u.y;
    return along(p) > (limit ?? along(farEnd));
  };
  const ua = into(a, aEnd);
  const ub = into(b, bEnd);
  const angle = (Math.acos(Math.max(-1, Math.min(1, ua.x * ub.x + ua.y * ub.y))) * 180) / Math.PI;
  const tooFar = (p: P) => Math.hypot(p.x - c.node.x, p.y - c.node.y) > SPEC_MITER_LIMIT * Math.max(a.thickness, b.thickness);
  if (layered) {
    const reached = buttReached(a, aEnd, b, bEnd);
    if (reached.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || past(a, aEnd, p, reach.a) || past(b, bEnd, p, reach.b))) {
      return { kind: 'overlap', butt: false };
    }
    if (angle >= 90 && reached.some(tooFar)) return { kind: 'shared', butt: false };
    return { kind: c.kind, butt: true };
  }
  const { through } = throughOf(a, b);
  const [tInner, cOuter] = through === a ? [c.aInner, c.bOuter] : [c.bInner, c.aOuter];
  const cut = through === a ? b : a;
  const on = (w: Wall, o: number) => {
    const f = frameOf(w);
    return pt(w.start.x + f.n.x * o, w.start.y + f.n.y * o);
  };
  const q = meet(on(through, tInner), frameOf(through).d, on(cut, cOuter), frameOf(cut).d);
  // The other wall abuts as a T: each of its layers reaches into the through wall, along the edges of
  // its band, as far as the face it stops on. Those deepest points must not pass the through wall's end.
  const cutEnd = cut === a ? aEnd : bEnd;
  const { stops } = tFaces(cut, cutEnd, through);
  const cutOffs = layerOffsetsOf(cut);
  const deepest = stops.flatMap((stop, k) =>
    [cutOffs[k]!, cutOffs[k + 1]!].map((o) => meet(on(cut, o), frameOf(cut).d, on(through, stop), frameOf(through).d)),
  );
  if ([q, ...deepest].some((p) => past(a, aEnd, p, reach.a) || past(b, bEnd, p, reach.b))) return { kind: 'overlap', butt: false };
  if (angle >= 90 && tooFar(q)) return { kind: 'shared', butt: false };
  return { kind: c.kind, butt: true };
}

/** The L region for the spec's resolution, or 'overlap' when it warns. `layered`: see cornerJoin. */
export function expectedCorner(
  a: Wall,
  aEnd: WallEnd,
  b: Wall,
  bEnd: WallEnd,
  node?: P,
  reach: { a?: number; b?: number } = {},
  layered = true,
): Region | 'overlap' {
  const { kind } = cornerJoin(a, aEnd, b, bEnd, node, reach, layered);
  return kind === 'overlap' ? 'overlap' : expectedL(a, aEnd, b, bEnd, node, kind);
}
