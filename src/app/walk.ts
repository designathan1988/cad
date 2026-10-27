// Walking through the model (ref/chat.txt:160-165): a person on a level, eyes 1.60 m up, who walks into
// rooms through doorways and is stopped by walls, windows' sills included. Pure: obstacles from the
// derived geometry, moves with collision, where to start.

import type { Point2 } from '../core/vector';
import { eachSolid } from '../elements/registry';
import type { DerivedGeometry } from './geometry';

export interface Walker {
  /** Where the feet are, in plan, and the level they stand on. */
  readonly x: number;
  readonly y: number;
  readonly levelId: string;
  /** Looking: across the plan (radians, counter-clockwise from +x) and up (radians, + up). */
  readonly yaw: number;
  readonly pitch: number;
}

export const EYE_HEIGHT = 1.6;
/** How low and high the eyes can be set (m): a child, a tall adult. */
export const EYE_MIN = 0.8;
export const EYE_MAX = 2.2;
/** The body, round in plan (m): kept this far from every wall. */
export const BODY_RADIUS = 0.25;
export const WALK_SPEED = 1.4;
export const RUN_SPEED = 3.5;
/** A wall blocks if it stands at this height above the floor (m): a door's opening is clear there, a window's sill is not. */
export const KNEE = 0.4;
/** Looking no further up or down than this (radians). */
export const MAX_PITCH = 1.4;

type Polygon = readonly Point2[];

/**
 * Kinds that never stop a walker by their outline: the walls (their blocks above, which leave the
 * doorways open), the doors and windows (a doorway is walked through, a window's sill is its wall's
 * block), and what is walked on: the ground, a stair (not climbed, nor shut in by).
 */
const NOT_IN_THE_WAY = new Set(['walls', 'openings', 'terrains', 'stairs']);

/**
 * What stops a walker on a level whose floor is at `floor`: every wall block standing at knee height,
 * and every other solid of the level that stands a knee high over what it stands on (a table, a bed, a
 * column, a railing, a curtain wall, a tree): its outline in plan.
 */
export function obstaclesOf(g: DerivedGeometry, levelId: string, floor: number): Polygon[] {
  const z = floor + KNEE;
  const out: Polygon[] = [];
  for (const s of g.solids.values()) {
    if (s.wall.levelId !== levelId) continue;
    for (const b of s.blocks) if (b.bottom <= z && b.top >= z) out.push(b.polygon);
  }
  for (const x of eachSolid(g.kinds)) {
    if (x.levelId !== levelId || NOT_IN_THE_WAY.has(x.kind.key) || !x.kind.span) continue;
    const { bottom, top } = x.kind.span(x.solid);
    // At knee height over its own base (an object on the terrain stands higher than the floor).
    const knee = Math.max(floor, bottom) + KNEE;
    if (bottom <= knee && top >= knee) out.push(...x.kind.outlines(x.solid));
  }
  return out;
}

/** Whether a circle at p of radius r overlaps a convex polygon. */
function hits(p: Point2, r: number, poly: Polygon): boolean {
  let inside = true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len2 = ex * ex + ey * ey;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / len2)) : 0;
    if (Math.hypot(p.x - (a.x + ex * t), p.y - (a.y + ey * t)) < r) return true;
    // Counter-clockwise: inside is on the left of every edge.
    if (ex * (p.y - a.y) - ey * (p.x - a.x) < 0) inside = false;
  }
  return inside;
}

const blocked = (p: Point2, obstacles: readonly Polygon[]) => obstacles.some((o) => hits(p, BODY_RADIUS, o));

/**
 * Where a walker at p ends after moving by d: in short steps (never through a thin wall), each one
 * whole if clear, else along x or along y alone (sliding along a wall), else not at all.
 */
export function moveWithCollision(p: Point2, d: Point2, obstacles: readonly Polygon[]): Point2 {
  const steps = Math.max(1, Math.ceil(Math.hypot(d.x, d.y) / 0.05));
  let at = p;
  for (let i = 0; i < steps; i++) {
    const sx = d.x / steps;
    const sy = d.y / steps;
    const tries = [
      { x: at.x + sx, y: at.y + sy },
      { x: at.x + sx, y: at.y },
      { x: at.x, y: at.y + sy },
    ];
    const next = tries.find((q) => (q.x !== at.x || q.y !== at.y) && !blocked(q, obstacles));
    if (!next) break;
    at = next;
  }
  return at;
}

/** Where to start on a level: the middle of its largest room, else of everything on it. */
export function startPoint(g: DerivedGeometry, levelId: string): Point2 | null {
  const rooms = [...g.rooms.values()].filter((r) => r.room.levelId === levelId && r.enclosed);
  if (rooms.length > 0) return [...rooms].sort((a, b) => b.area - a.area)[0]!.label;
  const pts = [...g.solids.values()].filter((s) => s.wall.levelId === levelId).flatMap((s) => [s.wall.start, s.wall.end]);
  if (pts.length === 0) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/** The step for one frame: forward and sideways (−1..1 each), seconds, running or not, along the yaw. */
export function stepFor(w: Walker, forward: number, side: number, seconds: number, run: boolean): Point2 {
  const len = Math.hypot(forward, side);
  if (len === 0) return { x: 0, y: 0 };
  const speed = (run ? RUN_SPEED : WALK_SPEED) * seconds;
  const f = forward / len;
  const s = side / len;
  // Sideways is to the right: the forward direction turned a quarter clockwise.
  const fx = Math.cos(w.yaw);
  const fy = Math.sin(w.yaw);
  return { x: (fx * f + fy * s) * speed, y: (fy * f - fx * s) * speed };
}
