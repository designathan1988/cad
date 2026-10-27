// A stair's steps and landings, in plan with their heights, and its handrails: laid out from its kind,
// its height and its step depth. Each step rises the same (the height over the number of risers nearest
// STAIR_RISER). Pure.

import { union } from 'polyclip-ts';
import { add, type Point2, scale } from '../../core/vector';
import { RAIL_HEIGHT, RAMP_GRADE, RAMP_LANDING, RAMP_RISE, type Stair, STAIR_RISER } from './schema';

export interface StairPart {
  /** In plan, counter-clockwise. */
  readonly polygon: readonly Point2[];
  /** Its top above the stair's bottom (m); a ramp's run, at its high end. */
  readonly top: number;
  readonly landing: boolean;
  /** A ramp's run: its top at a point, rising along it. */
  readonly topAt?: (p: Point2) => number;
}

export interface StairSolid {
  readonly stair: Stair;
  readonly parts: readonly StairPart[];
  /** The walking line, bottom to top, for the plan's arrow. */
  readonly walk: readonly Point2[];
  /** Handrails: polylines (x, y, z), z above the stair's bottom. */
  readonly rails: readonly (readonly { x: number; y: number; z: number }[])[];
  readonly bottom: number;
  readonly height: number;
  readonly risers: number;
  readonly riser: number;
}

const rect = (o: Point2, u: Point2, v: Point2, along: number, across: number): Point2[] => {
  // From o (the middle of its near side): along u by `along`, across v by `across` each side… made ccw.
  const a = add(o, scale(v, -across / 2));
  const b = add(a, scale(u, along));
  const c = add(b, scale(v, across));
  const d = add(a, scale(v, across));
  return ccw([a, b, c, d]);
};

function ccw(poly: Point2[]): Point2[] {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    s += p.x * q.y - q.x * p.y;
  }
  return s < 0 ? poly.reverse() : poly;
}

/** The risers its corner takes: a landing's one, or its winders (three in an L, six in a U). */
const cornerRisers = (stair: Stair): number => (stair.winders ? (stair.kind === 'u' ? 6 : 3) : 1);

/** The steps of an L's or a U's first flight: its own split, else half, leaving one at least after its corner. */
export const firstFlight = (stair: Stair, risers: number): number =>
  Math.min(Math.max(1, Math.round(stair.split ?? Math.floor((risers - cornerRisers(stair) + 1) / 2))), Math.max(1, risers - cornerRisers(stair) - 1));

/**
 * The stair's footprint, its steps and landings united (counter-clockwise, the outer ring of the
 * largest part): the well the floor it reaches leaves open. A U with a shorter second flight leaves the
 * corner past it closed, as built.
 */
export function stairWell(s: StairSolid): Point2[] {
  const rings = s.parts.filter((p) => p.polygon.length >= 3).map((p) => [p.polygon.map((q): [number, number] => [q.x, q.y])]);
  if (rings.length === 0) return [];
  const [first, ...rest] = rings;
  const parts = union(first!, ...rest);
  const area = (r: readonly [number, number][]) => r.reduce((a, [x, y], i) => a + x * r[(i + 1) % r.length]![1] - r[(i + 1) % r.length]![0] * y, 0) / 2;
  const outer = parts.map((p) => p[0]!).reduce((a, b) => (Math.abs(area(b)) > Math.abs(area(a)) ? b : a));
  const pts = outer.map(([x, y]) => ({ x, y }));
  // polyclip closes its rings; and points on a straight side (where two steps met) say nothing.
  if (pts.length > 1 && pts[0]!.x === pts.at(-1)!.x && pts[0]!.y === pts.at(-1)!.y) pts.pop();
  const straight = (a: Point2, b: Point2, c: Point2) => Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < 1e-9;
  const ring = pts.filter((p, i) => !straight(pts[(i + pts.length - 1) % pts.length]!, p, pts[(i + 1) % pts.length]!));
  return area(ring.map((p): [number, number] => [p.x, p.y])) < 0 ? ring.reverse() : ring;
}

/** `levelHeight`: the height it climbs when it sets none; `bottom`: its level's floor. */
export function stairSolid(stair: Stair, levelHeight: number, bottom: number): StairSolid {
  const height = Math.max(0.2, stair.height ?? levelHeight);
  const risers = Math.max(2, Math.round(height / STAIR_RISER));
  const riser = height / risers;
  const t = stair.tread;
  const w = stair.width;
  const u = { x: Math.cos(stair.angle), y: Math.sin(stair.angle) };
  // To the turn's side, seen climbing.
  const side = stair.turn === 'left' ? { x: -u.y, y: u.x } : { x: u.y, y: -u.x };
  const parts: StairPart[] = [];
  const walk: Point2[] = [];
  const rails: { x: number; y: number; z: number }[][] = [];
  // A flight of `n` steps from `o` along `dir`, the first rising from `z0`.
  const flight = (o: Point2, dir: Point2, n: number, z0: number, step0: number) => {
    const across = { x: -dir.y, y: dir.x };
    for (let i = 0; i < n; i++) parts.push({ polygon: rect(add(o, scale(dir, i * t)), dir, across, t, w), top: z0 + (step0 + i + 1) * riser, landing: false });
    walk.push(o, add(o, scale(dir, n * t)));
    for (const s of [-1, 1]) {
      const edge = add(o, scale(across, (s * w) / 2));
      rails.push([
        { ...edge, z: z0 + (step0 + 1) * riser + RAIL_HEIGHT },
        { ...add(edge, scale(dir, n * t)), z: z0 + (step0 + n) * riser + RAIL_HEIGHT },
      ]);
    }
  };
  if (stair.kind === 'ramp') {
    // Runs at the grade, each rising at most RAMP_RISE, with a level landing between them.
    const k = Math.max(0.5, stair.grade ?? RAMP_GRADE) / 100;
    const runs = Math.max(1, Math.ceil(height / RAMP_RISE - 1e-9));
    const rise = height / runs;
    const runLen = rise / k;
    const across = { x: -u.y, y: u.x };
    let o = stair.at;
    let z = 0;
    const railPts: [Point2, number][] = [];
    for (let i = 0; i < runs; i++) {
      const z0 = z;
      const o0 = o;
      parts.push({ polygon: rect(o, u, across, runLen, w), top: z0 + rise, landing: false, topAt: (p) => z0 + k * ((p.x - o0.x) * u.x + (p.y - o0.y) * u.y) });
      railPts.push([o, z0]);
      o = add(o, scale(u, runLen));
      z += rise;
      railPts.push([o, z]);
      if (i < runs - 1) {
        parts.push({ polygon: rect(o, u, across, RAMP_LANDING, w), top: z, landing: true });
        o = add(o, scale(u, RAMP_LANDING));
        railPts.push([o, z]);
      }
    }
    walk.push(stair.at, o);
    for (const s of [-1, 1]) rails.push(railPts.map(([p, zz]) => ({ ...add(p, scale(across, (s * w) / 2)), z: zz + RAIL_HEIGHT })));
    return { stair, parts, walk, rails: stair.railing === false ? [] : rails, bottom, height, risers: runs, riser: rise };
  }
  // Three steps fanned about the inner corner of a square of side w, its near edge centred at `near`,
  // climbed along `dir` and turning to `turn`: 30° each, the first by the flight that arrives, the
  // third by the one that leaves; the handrail along its outer edges.
  const winders = (near: Point2, dir: Point2, turn: Point2, step0: number) => {
    const inner = add(near, scale(turn, w / 2));
    const a = add(near, scale(turn, -w / 2));
    const b = add(a, scale(dir, w));
    const c = add(inner, scale(dir, w));
    const k30 = w * Math.tan(Math.PI / 6);
    const p30 = add(a, scale(dir, k30));
    const p60 = add(c, scale(turn, -k30));
    [[inner, a, p30], [inner, p30, b, p60], [inner, p60, c]].forEach((polygon, i) => parts.push({ polygon: ccw(polygon), top: (step0 + i + 1) * riser, landing: false }));
    walk.push(add(near, scale(dir, w / 2)));
    rails.push([
      { ...a, z: (step0 + 1) * riser + RAIL_HEIGHT },
      { ...b, z: (step0 + 2.5) * riser + RAIL_HEIGHT },
      { ...c, z: (step0 + 3) * riser + RAIL_HEIGHT },
    ]);
  };
  if (stair.kind === 'straight') {
    flight(stair.at, u, risers, 0, 0);
  } else if (stair.kind === 'l' && stair.winders) {
    // The first flight, three winders in the corner, the second flight to the turn's side.
    const k = firstFlight(stair, risers);
    flight(stair.at, u, k, 0, 0);
    const end = add(stair.at, scale(u, k * t));
    winders(end, u, side, k);
    const o2 = add(add(end, scale(u, w / 2)), scale(side, w / 2));
    flight(o2, side, risers - k - 3, 0, k + 3);
  } else if (stair.kind === 'u' && stair.winders) {
    // Up, six winders round the inner corner (two squares turning a half turn), back beside the first.
    const k = firstFlight(stair, risers);
    flight(stair.at, u, k, 0, 0);
    const end = add(stair.at, scale(u, k * t));
    winders(end, u, side, k);
    winders(add(add(end, scale(u, w / 2)), scale(side, w / 2)), side, scale(u, -1), k + 3);
    const o2 = add(end, scale(side, w));
    flight(o2, scale(u, -1), risers - k - 6, 0, k + 6);
  } else if (stair.kind === 'l') {
    // The first flight, a square landing, the second flight to the turn's side.
    const k = firstFlight(stair, risers);
    flight(stair.at, u, k, 0, 0);
    const end = add(stair.at, scale(u, k * t));
    parts.push({ polygon: rect(end, u, { x: -u.y, y: u.x }, w, w), top: (k + 1) * riser, landing: true });
    const o2 = add(add(end, scale(u, w / 2)), scale(side, w / 2));
    flight(o2, side, risers - k - 1, 0, k + 1);
  } else if (stair.kind === 'u') {
    // Up, a landing as wide as both flights, back down the other way beside the first.
    const k = firstFlight(stair, risers);
    flight(stair.at, u, k, 0, 0);
    const end = add(stair.at, scale(u, k * t));
    const mid = add(end, scale(side, w / 2));
    parts.push({ polygon: rect(add(mid, scale(side, 0)), u, side, w, 2 * w), top: (k + 1) * riser, landing: true });
    const back = scale(u, -1);
    const o2 = add(end, scale(side, w));
    flight(o2, back, risers - k - 1, 0, k + 1);
  } else {
    // A spiral round its centre: each step a wedge, its depth `tread` on the walking line (2/3 out).
    const r = w;
    const post = 0.1;
    const walkR = post + (r - post) * (2 / 3);
    const turnSign = stair.turn === 'left' ? 1 : -1;
    const da = (t / walkR) * turnSign;
    // Centred a radius ahead of its first step's front, its first step starting there: a stair turned into
    // a spiral stays where it was.
    const centre = add(stair.at, scale(u, r));
    const start = stair.angle + Math.PI;
    const at = (radius: number, a: number) => ({ x: centre.x + radius * Math.cos(a), y: centre.y + radius * Math.sin(a) });
    for (let i = 0; i < risers; i++) {
      const a0 = start + i * da;
      const a1 = a0 + da;
      const arc = [0, 1, 2, 3].map((k) => at(r, a0 + (da * k) / 3));
      parts.push({ polygon: ccw([at(post, a0), ...arc, at(post, a1)]), top: (i + 1) * riser, landing: false });
      walk.push(at(walkR, a0 + da / 2));
    }
    rails.push(Array.from({ length: risers + 1 }, (_, i) => ({ ...at(r, start + i * da), z: Math.min(i + 1, risers) * riser + RAIL_HEIGHT })));
  }
  return { stair, parts, walk, rails: stair.railing === false ? [] : rails, bottom, height, risers, riser };
}
