// Grid axes (ref/chat.txt:80, 132): named lines of the structure, 1, 2, 3 one way and A, B, C the
// other, the same on every level, with a bubble at each end. The walls lying on an axis go with it when
// it is moved. Part of the project: saved, undone, moved as the rest.

import { distance, dot, normalize, type Point2, sub } from '../../model/vector';

export const GRID_PREFIX = 'grid';

export interface Grid {
  readonly id: string;
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

/** The walls lying on an axis (both ends on its line, 1 mm): the ones that go with it. */
export function onGrid<W extends { readonly id: string; readonly start: Point2; readonly end: Point2 }>(g: Grid, walls: readonly W[]): W[] {
  const len = distance(g.start, g.end);
  if (len === 0) return [];
  const dir = normalize(sub(g.end, g.start));
  const off = (p: Point2) => Math.abs(dir.x * (p.y - g.start.y) - dir.y * (p.x - g.start.x));
  return walls.filter((w) => off(w.start) < 1e-3 && off(w.end) < 1e-3 && dot(sub(w.end, w.start), sub(w.end, w.start)) > 0);
}
