// Grid axes (ref/chat.txt:80, 132): named lines of the structure, 1, 2, 3 one way and A, B, C the
// other, the same on every level, with a bubble at each end. An axis moves alone: what lies on it is not
// tied to it. Part of the project: saved, undone, moved as the rest.

import { type Point2 } from '../../model/vector';
import { type Brand, newId } from '../../core/id';

export const GRID_PREFIX = 'grid';

/** A grid axis's id (grid…). */
export type GridId = Brand<'grid'>;

/** A new grid's id. */
export const newGridId = (): GridId => newId(GRID_PREFIX) as GridId;

export interface Grid {
  readonly id: GridId;
  /** "1", "2", "A", "B"…: what its bubbles say. */
  readonly name: string;
  readonly start: Point2;
  readonly end: Point2;
}

export const isGridId = (id: string): boolean => id.startsWith(`${GRID_PREFIX}_`);

/** "A" → "B", "Z" → "AA", "AZ" → "BA". */
function nextLetters(s: string): string {
  const chars = [...s];
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] !== 'Z') {
      chars[i] = String.fromCharCode(chars[i]!.charCodeAt(0) + 1);
      return chars.join('');
    }
    chars[i] = 'A';
    i--;
  }
  return `A${chars.join('')}`;
}

/**
 * The name a new axis gets: running on from the last of its kind. Up and down the plan the axes are
 * numbered (1, 2, 3), across they are lettered (A, B, C), as drawings usually have them.
 */
export function nextGridName(grids: readonly Grid[], start: Point2, end: Point2): string {
  const upright = Math.abs(end.y - start.y) >= Math.abs(end.x - start.x);
  const numbers = grids.map((g) => g.name).filter((n) => /^\d+$/.test(n));
  const letters = grids.map((g) => g.name).filter((n) => /^[A-Z]+$/.test(n));
  if (upright) return String(numbers.reduce((m, n) => Math.max(m, Number(n)), 0) + 1);
  const last = letters.sort((a, b) => a.length - b.length || a.localeCompare(b)).at(-1);
  return last ? nextLetters(last) : 'A';
}
