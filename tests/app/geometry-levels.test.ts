// Walls join only with walls of their own level: a wall drawn upstairs over one downstairs changes
// nothing below, and is not cut by it.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { addLevel } from '../../src/elements/level/commands';
import { lid, tid, wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';

const wall = (id: WallId, a: [number, number], b: [number, number], levelId = lid('lvl_ground')): DocWall => ({
  id,
  wallTypeId: tid('wt_concrete20'),
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId,
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

// Ground: a 4 × 3 rectangle with a wall crossing it at x = 2 (an X at the bottom and top).
const ground = [
  wall(wid('b'), [0, 0], [4, 0]),
  wall(wid('r'), [4, 0], [4, 3]),
  wall(wid('t'), [4, 3], [0, 3]),
  wall(wid('l'), [0, 3], [0, 0]),
  wall(wid('x'), [2, -1], [2, 4]),
];

describe('joins per level', () => {
  it('a wall upstairs over the bottom wall leaves the ground floor exactly as it was, and is whole', () => {
    const base: Doc = { ...newDocument(), walls: ground };
    const two = addLevel(lid('lvl_up'), 'Upper').apply(base);
    const withUp = { ...two, walls: [...ground, wall(wid('u'), [1, 0], [3, 0], lid('lvl_up'))] };
    const before = deriveGeometry(base);
    const after = deriveGeometry(withUp);
    for (const w of ground) expect(after.solids.get(w.id)!.pieces).toEqual(before.solids.get(w.id)!.pieces);
    expect(after.warnings).toEqual(before.warnings);
    // Alone on its level: one plain rectangle, 2 m × 0.2 m.
    const up = after.solids.get(wid('u'))!.pieces;
    expect(up).toHaveLength(1);
    expect(after.warnings.filter((w) => w.walls.includes(wid('u')))).toEqual([]);
  });
});
