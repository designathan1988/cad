// Aligning and distributing parallel walls: worked out by hand on a 9 × 3 box with partitions.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { alignWalls, canAlignWalls, canDistributeWalls, distributeWalls } from '../../src/elements/wall/arrange';
import type { WallId } from '../../src/elements/wall/schema';
import { wid } from '../ids';

const wall = (id: WallId, a: [number, number], b: [number, number], bulge = 0): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  ...(bulge ? { bulge } : {}),
});

// A 9 m by 3 m box; partitions standing on its bottom and top at x = 2, 3 and 7, one drawn downward.
const doc: Doc = {
  ...newDocument(),
  walls: [
    wall(wid('b'), [0, 0], [9, 0]),
    wall(wid('r'), [9, 0], [9, 3]),
    wall(wid('t'), [9, 3], [0, 3]),
    wall(wid('l'), [0, 3], [0, 0]),
    wall(wid('p2'), [2, 0], [2, 3]),
    wall(wid('p3'), [3, 3], [3, 0]),
    wall(wid('p7'), [7, 0], [7, 3]),
  ],
};
const xOf = (walls: readonly DocWall[] | null, id: string) => walls!.find((w) => w.id === id)!.start.x;

describe('distributing parallel walls', () => {
  it('the outer two stay, the middle one goes halfway: 2, 4.5, 7, whatever the order picked', () => {
    const walls = distributeWalls(doc, ['p7', 'p3', 'p2']);
    expect(xOf(walls, 'p2')).toBeCloseTo(2, 12);
    expect(xOf(walls, 'p3')).toBeCloseTo(4.5, 12);
    expect(xOf(walls, 'p7')).toBeCloseTo(7, 12);
    // It still stands on the bottom and the top: its ends moved along them.
    const p3 = walls!.find((w) => w.id === 'p3')!;
    expect([p3.start.y, p3.end.y]).toEqual([3, 0]);
  });

  it('needs three parallel straight walls', () => {
    expect(canDistributeWalls(doc, ['p2', 'p3'])).toBe(false);
    expect(distributeWalls(doc, ['p2', 'p3'])).toBeNull();
    expect(canDistributeWalls(doc, ['p2', 'p3', 'b'])).toBe(false);
    expect(canDistributeWalls(doc, ['p2', 'p3', 'p7'])).toBe(true);
  });
});

describe('aligning parallel walls', () => {
  it('the others onto the first one picked: p3 and p7 onto x = 2', () => {
    const walls = alignWalls(doc, ['p2', 'p3', 'p7']);
    expect(xOf(walls, 'p3')).toBeCloseTo(2, 12);
    expect(xOf(walls, 'p7')).toBeCloseTo(2, 12);
    expect(xOf(walls, 'p2')).toBeCloseTo(2, 12);
  });

  it('a wall that is not parallel, or an arc, and nothing is done', () => {
    expect(canAlignWalls(doc, ['p2', 'b'])).toBe(false);
    expect(alignWalls(doc, ['p2', 'b'])).toBeNull();
    const arced = { ...doc, walls: [...doc.walls, wall(wid('a'), [5, 0], [5, 3], 0.3)] };
    expect(canAlignWalls(arced, ['p2', 'a'])).toBe(false);
  });
});
