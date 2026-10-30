// What goes with an axis: the walls and beams lying on it and the columns standing on it, on every level
// (schema.ts: onGrid). Pure.

import type { Doc } from '../../project/doc';
import { distance } from '../../model/vector';
import { kindsOnLine } from '../registry';
import { type Grid, onGrid } from './schema';

/** Whether a point is on the axis's line (1 mm): a column's centre. */
function onLine(g: Grid, p: { x: number; y: number }): boolean {
  const len = distance(g.start, g.end);
  if (len === 0) return false;
  const dx = (g.end.x - g.start.x) / len;
  const dy = (g.end.y - g.start.y) / len;
  return Math.abs(dx * (p.y - g.start.y) - dy * (p.x - g.start.x)) < 1e-3;
}

/** The ids of the walls and columns on the axes among `ids`, not already among them. */
export function wallsOnGrids(doc: Doc, ids: readonly string[]): string[] {
  const set = new Set(ids);
  const taken = doc.grids.filter((g) => set.has(g.id));
  if (taken.length === 0) return [];
  const on = (g: Grid) => [
    ...onGrid(g, doc.walls).map((w) => w.id),
    ...kindsOnLine(doc, (p) => onLine(g, p)),
  ];
  return [...new Set(taken.flatMap(on))].filter((id) => !set.has(id));
}
