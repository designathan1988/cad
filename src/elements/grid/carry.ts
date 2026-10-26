// What goes with an axis: the walls lying on it, on every level (schema.ts: onGrid). Pure.

import type { Doc } from '../../app/document';
import { onGrid } from './schema';

/** The ids of the walls on the axes among `ids`, not already among them. */
export function wallsOnGrids(doc: Doc, ids: readonly string[]): string[] {
  const set = new Set(ids);
  const taken = doc.grids.filter((g) => set.has(g.id));
  if (taken.length === 0) return [];
  return [...new Set(taken.flatMap((g) => onGrid(g, doc.walls).map((w) => w.id)))].filter((id) => !set.has(id));
}
