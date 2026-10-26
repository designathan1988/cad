// A stair's steps and landings, in plan with their heights, and its handrails: laid out from its kind,
// its height and its step depth. Each step rises the same (the height over the number of risers nearest
// STAIR_RISER). Pure.

import { add, type Point2, scale } from '../../core/vector';
import { RAIL_HEIGHT, type Stair, STAIR_RISER } from './schema';

export interface StairPart {
  /** In plan, counter-clockwise. */
  readonly polygon: readonly Point2[];
  /** Its top above the stair's bottom (m). */
  readonly top: number;
  readonly landing: boolean;
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
  if (stair.kind === 'straight') {
    flight(stair.at, u, risers, 0, 0);
  } else if (stair.kind === 'l') {
    // The first flight, a square landing, the second flight to the turn's side.
    const k = Math.max(1, Math.floor(risers / 2));
    flight(stair.at, u, k, 0, 0);
    const end = add(stair.at, scale(u, k * t));
    parts.push({ polygon: rect(end, u, { x: -u.y, y: u.x }, w, w), top: (k + 1) * riser, landing: true });
    const o2 = add(add(end, scale(u, w / 2)), scale(side, w / 2));
    flight(o2, side, risers - k - 1, 0, k + 1);
  } else if (stair.kind === 'u') {
    // Up, a landing as wide as both flights, back down the other way beside the first.
    const k = Math.max(1, Math.floor(risers / 2));
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
