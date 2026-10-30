// Arranging several straight, parallel walls (pure): aligning them on the first one's line, and
// distributing them with equal spaces between their axes, the outer two staying. Each wall moves
// across itself only, with its joins kept as a drag keeps them (edit.ts: moveWalls), so the walls
// meeting them stretch and the rooms between them resize. Openings go with their walls.

import type { Doc, DocWall } from '../project/doc';
import { cross, dot, normalize, perp, type Point2, scale, sub } from '../model/vector';
import { moveWalls } from './edit';

/** Directions closer than this (as the sine between them) count as parallel. */
const PARALLEL = 1e-6;

/** The walls in `ids`, in that order, when there are at least two, all straight and parallel. */
function parallelWalls(doc: Doc, ids: readonly string[]): DocWall[] | null {
  const walls = ids.flatMap((id) => doc.walls.filter((w) => w.id === id));
  if (walls.length < 2 || walls.some((w) => w.bulge)) return null;
  const d = normalize(sub(walls[0]!.end, walls[0]!.start));
  return walls.every((w) => Math.abs(cross(d, normalize(sub(w.end, w.start)))) < PARALLEL) ? walls : null;
}

/** Each wall moved across by its own offset, one after another so every move keeps the joins as they stand then. */
function moveAcross(doc: Doc, moves: readonly { id: string; by: Point2 }[]): DocWall[] {
  let walls: readonly DocWall[] = doc.walls;
  for (const m of moves) {
    if (Math.hypot(m.by.x, m.by.y) < 1e-12) continue;
    walls = moveWalls({ ...doc, walls }, [m.id], m.by);
  }
  return [...walls];
}

export const canAlignWalls = (doc: Doc, ids: readonly string[]): boolean => parallelWalls(doc, ids) !== null;
export const canDistributeWalls = (doc: Doc, ids: readonly string[]): boolean => (parallelWalls(doc, ids)?.length ?? 0) >= 3;

/** The others onto the first one's line (its reference line). Null when they are not parallel. */
export function alignWalls(doc: Doc, ids: readonly string[]): DocWall[] | null {
  const walls = parallelWalls(doc, ids);
  if (!walls) return null;
  const [first, ...others] = walls;
  const n = perp(normalize(sub(first!.end, first!.start)));
  return moveAcross(
    doc,
    others.map((w) => ({ id: w.id, by: scale(n, -dot(sub(w.start, first!.start), n)) })),
  );
}

/**
 * Equal spaces between their lines: the two outermost stay, the others take the even steps between
 * them, in the order they lie across. Null with fewer than three or when they are not parallel.
 */
export function distributeWalls(doc: Doc, ids: readonly string[]): DocWall[] | null {
  const walls = parallelWalls(doc, ids);
  if (!walls || walls.length < 3) return null;
  const n = perp(normalize(sub(walls[0]!.end, walls[0]!.start)));
  const across = (w: DocWall) => dot(sub(w.start, walls[0]!.start), n);
  const sorted = [...walls].sort((a, b) => across(a) - across(b));
  const lo = across(sorted[0]!);
  const step = (across(sorted[sorted.length - 1]!) - lo) / (sorted.length - 1);
  return moveAcross(
    doc,
    sorted.slice(1, -1).map((w, k) => ({ id: w.id, by: scale(n, lo + step * (k + 1) - across(w)) })),
  );
}
