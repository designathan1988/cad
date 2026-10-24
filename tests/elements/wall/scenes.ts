// Random scenes for the property tests. Built with the oracle's own math, never the engine's.

import fc from 'fast-check';
import type { LayerFunction, ReferenceLine, WallEnd, WallLayer } from '../../../src/elements/wall/schema';
import { layer, testWall, type TestWall as Wall } from './fixtures';
import { frameOf, inside, rectOf, roomCorners, shoelace, type P } from './oracle';

export type Mode = 'normal' | 'degenerate';

const pt = (x: number, y: number): P => ({ x, y });
const plus = (a: P, b: P) => pt(a.x + b.x, a.y + b.y);
const times = (a: P, s: number) => pt(a.x * s, a.y * s);
const dir = (deg: number) => pt(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180));
const rot = (v: P, deg: number) => {
  const c = Math.cos((deg * Math.PI) / 180);
  const s = Math.sin((deg * Math.PI) / 180);
  return pt(v.x * c - v.y * s, v.x * s + v.y * c);
};
const dotp = (a: P, b: P) => a.x * b.x + a.y * b.y;

const num = (min: number, max: number) => fc.double({ min, max, noNaN: true, noDefaultInfinity: true });
const ref = fc.constantFrom<ReferenceLine>('centerline', 'interiorFace', 'exteriorFace');

/** How a wall type splits its thickness: 1 to 4 layers, functions at random. */
interface Recipe {
  readonly split: number[];
  readonly fns: LayerFunction[];
}
const anyRecipe: fc.Arbitrary<Recipe> = fc.record({
  split: fc.array(num(0.1, 1), { minLength: 1, maxLength: 4 }),
  fns: fc.array(fc.constantFrom<LayerFunction>('structure', 'substrate', 'thermal', 'finish1', 'finish2'), {
    minLength: 4,
    maxLength: 4,
  }),
});
/** The common build-up: a finish, a structural core, a finish. */
const plasteredRecipe: fc.Arbitrary<Recipe> = fc
  .tuple(num(0.05, 0.3), num(0.4, 1), num(0.05, 0.3))
  .map(([a, b, c]) => ({ split: [a, b, c], fns: ['finish1', 'structure', 'finish2', 'finish2'] }));
const recipe = fc.oneof(anyRecipe, plasteredRecipe);
function layersOf(thickness: number, r: Recipe): WallLayer[] {
  const sum = r.split.reduce((a, b) => a + b, 0);
  return r.split.map((part, i) => layer((thickness * part) / sum, r.fns[i]!));
}

const make = (id: string, from: P, to: P, layers: readonly WallLayer[], referenceLine: ReferenceLine): Wall =>
  testWall(id, from, to, layers, referenceLine);

/** Where the line p + s·u meets q + r·w, as the parameter s. */
function meetParam(p: P, u: P, q: P, w: P): number {
  const det = u.y * w.x - u.x * w.y;
  return ((q.y - p.y) * w.x - (q.x - p.x) * w.y) / det;
}

/** Distance from p to segment a–b. */
function toSegment(p: P, a: P, b: P): number {
  const ab = pt(b.x - a.x, b.y - a.y);
  const l2 = dotp(ab, ab);
  const t = Math.max(0, Math.min(1, dotp(pt(p.x - a.x, p.y - a.y), ab) / l2));
  return Math.hypot(p.x - a.x - ab.x * t, p.y - a.y - ab.y * t);
}

export interface LScene {
  readonly a: Wall;
  readonly aEnd: WallEnd;
  readonly b: Wall;
  readonly bEnd: WallEnd;
}

export function lScene(mode: Mode): fc.Arbitrary<LScene> {
  const theta =
    mode === 'normal' ? num(15, 165) : fc.oneof(num(0.05, 3), num(3, 15), num(165, 177), num(177, 179.95));
  return fc
    .record({
      node: fc.tuple(num(-5, 5), num(-5, 5)),
      heading: num(0, 360),
      theta,
      left: fc.boolean(),
      lens: fc.tuple(num(0.5, 6), num(0.5, 6)),
      ts: fc.tuple(num(0.05, 0.4), num(0.05, 0.4)),
      recipes: fc.tuple(recipe, recipe),
      sameType: fc.boolean(),
      refs: fc.tuple(ref, ref),
      away: fc.tuple(fc.boolean(), fc.boolean()),
      jitter: mode === 'normal' ? fc.constant(0) : num(0, 0.0009),
      jitterHeading: num(0, 360),
    })
    .map((r) => {
      const la = layersOf(r.ts[0], r.recipes[0]);
      const lb = r.sameType ? la : layersOf(r.ts[1], r.recipes[1]);
      const pa = pt(r.node[0], r.node[1]);
      const pb = plus(pa, times(dir(r.jitterHeading), r.jitter));
      const ua = dir(r.heading);
      const ub = rot(ua, r.left ? r.theta : -r.theta);
      const fa = plus(pa, times(ua, r.lens[0]));
      const fb = plus(pb, times(ub, r.lens[1]));
      return {
        a: r.away[0] ? make('a', pa, fa, la, r.refs[0]) : make('a', fa, pa, la, r.refs[0]),
        aEnd: (r.away[0] ? 'start' : 'end') as WallEnd,
        b: r.away[1] ? make('b', pb, fb, lb, r.refs[1]) : make('b', fb, pb, lb, r.refs[1]),
        bEnd: (r.away[1] ? 'start' : 'end') as WallEnd,
      };
    })
    .filter((s) => {
      // A far end resting on the other wall would make this an L plus a T: a different scene.
      const reach = s.a.thickness + s.b.thickness;
      const farA = s.aEnd === 'start' ? s.a.end : s.a.start;
      const farB = s.bEnd === 'start' ? s.b.end : s.b.start;
      return toSegment(farA, s.b.start, s.b.end) > reach && toSegment(farB, s.a.start, s.a.end) > reach;
    });
}

export interface TScene {
  readonly host: Wall;
  readonly abutting: Wall;
  readonly end: WallEnd;
}

export function tScene(mode: Mode): fc.Arbitrary<TScene> {
  const phi = mode === 'normal' ? num(20, 160) : fc.oneof(num(8, 20), num(160, 172));
  const slack = mode === 'normal' ? 0 : 0.0009;
  return fc
    .record({
      start: fc.tuple(num(-5, 5), num(-5, 5)),
      heading: num(0, 360),
      hostLen: num(2, 10),
      hostT: num(0.05, 0.4),
      hostRecipe: recipe,
      hostRef: ref,
      phi,
      positive: fc.boolean(),
      station: num(0, 1),
      across: num(0, 1),
      len: num(0.5, 5),
      t: num(0.05, 0.4),
      tRecipe: recipe,
      tRef: ref,
      away: fc.boolean(),
    })
    .map((r) => {
      const hs = pt(r.start[0], r.start[1]);
      const hostEnd = plus(hs, times(dir(r.heading), r.hostLen));
      const host = make('host', hs, hostEnd, layersOf(r.hostT, r.hostRecipe), r.hostRef);
      const f = frameOf(host);
      const sinPhi = Math.sin((r.phi * Math.PI) / 180);
      const margin = r.t / sinPhi + r.hostT + 0.1;
      const s = margin + (r.hostLen - 2 * margin) * r.station;
      const off = f.o0 - slack + (f.o1 - f.o0 + 2 * slack) * r.across;
      const p = plus(plus(hs, times(f.d, s)), times(f.n, off));
      const side = r.positive ? f.n : times(f.n, -1);
      const u = plus(times(f.d, Math.cos((r.phi * Math.PI) / 180)), times(side, sinPhi));
      const q = plus(p, times(u, r.len));
      const tl = layersOf(r.t, r.tRecipe);
      const abutting = r.away ? make('t', p, q, tl, r.tRef) : make('t', q, p, tl, r.tRef);
      return { host, abutting, end: (r.away ? 'start' : 'end') as WallEnd, ok: 2 * margin < r.hostLen };
    })
    .filter((s) => {
      if (!s.ok) return false;
      // The free end must clear the host band.
      const farEnd = s.end === 'start' ? s.abutting.end : s.abutting.start;
      if (toSegment(farEnd, s.host.start, s.host.end) <= s.host.thickness + 0.01) return false;
      // A pure T: the abutting band crosses both host faces well inside the host's length, so
      // neither host end touches it. (Ends inside each other are a corner: see crossedScene.)
      const fh = frameOf(s.host);
      const fa = frameOf(s.abutting);
      for (const ho of [fh.o0, fh.o1]) {
        for (const ao of [fa.o0, fa.o1]) {
          const hp = plus(s.host.start, times(fh.n, ho));
          const ap = plus(s.abutting.start, times(fa.n, ao));
          const station = meetParam(hp, fh.d, ap, fa.d);
          if (station < 0.05 || station > fh.len - 0.05) return false;
        }
      }
      return true;
    })
    .map(({ host, abutting, end }) => ({ host, abutting, end }));
}

export interface RoomScene {
  readonly ring: readonly Wall[];
  readonly ringEnds: readonly (readonly [WallEnd, WallEnd])[];
  readonly divider: Wall;
  readonly startHost: Wall;
  readonly endHost: Wall;
}

export function roomScene(): fc.Arbitrary<RoomScene> {
  return fc
    .record({
      center: fc.tuple(num(-5, 5), num(-5, 5)),
      size: fc.tuple(num(3, 7), num(3, 7)),
      turn: num(0, 360),
      jitter: fc.array(num(-0.8, 0.8), { minLength: 8, maxLength: 8 }),
      ts: fc.array(num(0.05, 0.3), { minLength: 4, maxLength: 4 }),
      recipes: fc.array(recipe, { minLength: 4, maxLength: 4 }),
      sameType: fc.boolean(),
      refs: fc.array(ref, { minLength: 4, maxLength: 4 }),
      reversed: fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
      at: fc.tuple(num(0.3, 0.7), num(0.3, 0.7)),
      dT: num(0.05, 0.3),
      dRecipe: recipe,
      dRef: ref,
      dReversed: fc.boolean(),
    })
    .map((r) => {
      const [w, h] = r.size;
      const base = [pt(-w / 2, -h / 2), pt(w / 2, -h / 2), pt(w / 2, h / 2), pt(-w / 2, h / 2)];
      const c = pt(r.center[0], r.center[1]);
      const v = base.map((p, i) => plus(c, rot(pt(p.x + r.jitter[2 * i]!, p.y + r.jitter[2 * i + 1]!), r.turn)));
      const shared = layersOf(r.ts[0]!, r.recipes[0]!);
      const ring = v.map((from, i) => {
        const to = v[(i + 1) % 4]!;
        const id = `w${i}`;
        const ls = r.sameType ? shared : layersOf(r.ts[i]!, r.recipes[i]!);
        return r.reversed[i] ? make(id, to, from, ls, r.refs[i]!) : make(id, from, to, ls, r.refs[i]!);
      });
      const ringEnds = r.reversed.map((rev) => (rev ? (['end', 'start'] as const) : (['start', 'end'] as const)));
      const lerp = (a: P, b: P, t: number) => plus(a, times(pt(b.x - a.x, b.y - a.y), t));
      const q0 = lerp(v[0]!, v[1]!, r.at[0]);
      const q2 = lerp(v[2]!, v[3]!, r.at[1]);
      const dl = layersOf(r.dT, r.dRecipe);
      const divider = r.dReversed ? make('d', q2, q0, dl, r.dRef) : make('d', q0, q2, dl, r.dRef);
      const startHost = r.dReversed ? ring[2]! : ring[0]!;
      const endHost = r.dReversed ? ring[0]! : ring[2]!;
      return { ring, ringEnds, divider, startHost, endHost, v };
    })
    .filter((s) => validRoom(s.v, s.ring, s.ringEnds, s.divider))
    .map(({ ring, ringEnds, divider, startHost, endHost }) => ({ ring, ringEnds, divider, startHost, endHost }));
}

function validRoom(
  v: readonly P[],
  ring: readonly Wall[],
  ringEnds: readonly (readonly [WallEnd, WallEnd])[],
  divider: Wall,
): boolean {
  for (let i = 0; i < 4; i++) {
    const a = v[(i + 3) % 4]!;
    const b = v[i]!;
    const c = v[(i + 1) % 4]!;
    const e1 = pt(a.x - b.x, a.y - b.y);
    const e2 = pt(c.x - b.x, c.y - b.y);
    const cross = e2.x * e1.y - e2.y * e1.x;
    if (cross <= 0) return false; // must stay convex and counter-clockwise
    const angle = (Math.acos(dotp(e1, e2) / (Math.hypot(e1.x, e1.y) * Math.hypot(e2.x, e2.y))) * 180) / Math.PI;
    if (angle < 40 || angle > 140) return false;
  }
  const corners = roomCorners(ring, ringEnds);
  if (!corners.kinds.every((k) => k === 'miter')) return false;
  if (shoelace(corners.inner) <= 0) return false;
  // The divider must cross each host's inner edge well clear of the inner corners.
  const fd = frameOf(divider);
  const sideOf = (p: P) => dotp(fd.n, pt(p.x - divider.start.x, p.y - divider.start.y));
  const clear = divider.thickness + 0.1;
  const s = corners.inner.map(sideOf);
  if (s.some((x) => Math.abs(x) < clear)) return false;
  // inner[k] is the corner before ring[k]; ring[0] spans inner[0]→inner[1], ring[2] spans inner[2]→inner[3].
  return Math.sign(s[0]!) !== Math.sign(s[1]!) && Math.sign(s[2]!) !== Math.sign(s[3]!);
}

export interface CrossedScene extends LScene {
  readonly node: P;
}

/** Two walls whose ends each sit inside the other: a corner whose ends overran or fell short. */
export function crossedScene(): fc.Arbitrary<CrossedScene> {
  return fc
    .record({
      node: fc.tuple(num(-5, 5), num(-5, 5)),
      heading: num(0, 360),
      theta: num(25, 155),
      left: fc.boolean(),
      lens: fc.tuple(num(1, 6), num(1, 6)),
      ts: fc.tuple(num(0.05, 0.4), num(0.05, 0.4)),
      recipes: fc.tuple(recipe, recipe),
      sameType: fc.boolean(),
      refs: fc.tuple(ref, ref),
      away: fc.tuple(fc.boolean(), fc.boolean()),
      over: fc.tuple(num(-1, 1), num(-1, 1)),
    })
    .map((r) => {
      const la = layersOf(r.ts[0], r.recipes[0]);
      const lb = r.sameType ? la : layersOf(r.ts[1], r.recipes[1]);
      const tb = lb.reduce((s, l) => s + l.thickness, 0);
      const x = pt(r.node[0], r.node[1]);
      const ua = dir(r.heading);
      const ub = rot(ua, r.left ? r.theta : -r.theta);
      const sin = Math.sin((r.theta * Math.PI) / 180);
      const pa = plus(x, times(ua, -r.over[0] * (tb / sin + 0.05)));
      const pb = plus(x, times(ub, -r.over[1] * (r.ts[0] / sin + 0.05)));
      const fa = plus(x, times(ua, r.lens[0]));
      const fb = plus(x, times(ub, r.lens[1]));
      return {
        node: x,
        a: r.away[0] ? make('a', pa, fa, la, r.refs[0]) : make('a', fa, pa, la, r.refs[0]),
        aEnd: (r.away[0] ? 'start' : 'end') as WallEnd,
        b: r.away[1] ? make('b', pb, fb, lb, r.refs[1]) : make('b', fb, pb, lb, r.refs[1]),
        bEnd: (r.away[1] ? 'start' : 'end') as WallEnd,
      };
    })
    .filter((s) => {
      const pa = s.aEnd === 'start' ? s.a.start : s.a.end;
      const pb = s.bEnd === 'start' ? s.b.start : s.b.end;
      if (Math.hypot(pa.x - pb.x, pa.y - pb.y) <= 0.0015) return false;
      if (!inside(rectOf(s.b), pa) || !inside(rectOf(s.a), pb)) return false;
      const station = (w: Wall, p: P) => {
        const f = frameOf(w);
        return dotp(f.d, pt(p.x - w.start.x, p.y - w.start.y));
      };
      const sa = station(s.b, pa);
      const sb = station(s.a, pb);
      const la = frameOf(s.a).len;
      const lb = frameOf(s.b).len;
      return sa > 0.0015 && sa < lb - 0.0015 && sb > 0.0015 && sb < la - 0.0015;
    });
}

export interface XScene {
  readonly a: Wall;
  readonly b: Wall;
}

/** Two walls crossing well inside both, each passing fully through the other's band. */
export function xScene(mode: Mode): fc.Arbitrary<XScene> {
  const phi = mode === 'normal' ? num(20, 160) : fc.oneof(num(8, 20), num(160, 172));
  return fc
    .record({
      start: fc.tuple(num(-5, 5), num(-5, 5)),
      heading: num(0, 360),
      lens: fc.tuple(num(2, 10), num(2, 10)),
      // Interior only: fast-check favours interval ends, and a crossing at an end is a T, tested apart.
      at: fc.tuple(num(0.15, 0.85), num(0.15, 0.85)),
      phi,
      ts: fc.tuple(num(0.05, 0.4), num(0.05, 0.4)),
      recipes: fc.tuple(recipe, recipe),
      sameType: fc.boolean(),
      refs: fc.tuple(ref, ref),
      reversed: fc.tuple(fc.boolean(), fc.boolean()),
      swapIds: fc.boolean(),
    })
    .map((r) => {
      const la = layersOf(r.ts[0], r.recipes[0]);
      const lb = r.sameType ? la : layersOf(r.ts[1], r.recipes[1]);
      const a0 = pt(r.start[0], r.start[1]);
      const da = dir(r.heading);
      const x = plus(a0, times(da, r.lens[0] * r.at[0]));
      const db = rot(da, r.phi);
      const b0 = plus(x, times(db, -r.lens[1] * r.at[1]));
      const b1 = plus(b0, times(db, r.lens[1]));
      const a1 = plus(a0, times(da, r.lens[0]));
      const [ida, idb] = r.swapIds ? ['b', 'a'] : ['a', 'b'];
      return {
        a: r.reversed[0] ? make(ida!, a1, a0, la, r.refs[0]) : make(ida!, a0, a1, la, r.refs[0]),
        b: r.reversed[1] ? make(idb!, b1, b0, lb, r.refs[1]) : make(idb!, b0, b1, lb, r.refs[1]),
      };
    })
    .filter(({ a, b }) => {
      // Every end clear of the other band, and the band overlap well inside both walls.
      const clear = (w: Wall, other: Wall) => {
        const f = frameOf(other);
        return [w.start, w.end].every((p) => {
          const o = dotp(f.n, pt(p.x - other.start.x, p.y - other.start.y));
          const st = dotp(f.d, pt(p.x - other.start.x, p.y - other.start.y));
          return o < f.o0 - 0.05 || o > f.o1 + 0.05 || st < -0.05 || st > f.len + 0.05;
        });
      };
      if (!clear(a, b) || !clear(b, a)) return false;
      const fa = frameOf(a);
      const fb = frameOf(b);
      for (const ao of [fa.o0, fa.o1]) {
        for (const bo of [fb.o0, fb.o1]) {
          const ap = plus(a.start, times(fa.n, ao));
          const bp = plus(b.start, times(fb.n, bo));
          const sa = meetParam(ap, fa.d, bp, fb.d);
          const sb = meetParam(bp, fb.d, ap, fa.d);
          if (sa < 0.05 || sa > fa.len - 0.05 || sb < 0.05 || sb > fb.len - 0.05) return false;
        }
      }
      return true;
    });
}
