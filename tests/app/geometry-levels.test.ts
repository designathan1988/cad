// Walls join only with walls of their own level: a wall drawn upstairs over one downstairs changes
// nothing below, and is not cut by it.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { addLevel } from '../../src/elements/level/commands';

const wall = (id: string, a: [number, number], b: [number, number], levelId = 'lvl_ground'): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId,
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

// Ground: a 4 × 3 rectangle with a wall crossing it at x = 2 (an X at the bottom and top).
const ground = [
  wall('b', [0, 0], [4, 0]),
  wall('r', [4, 0], [4, 3]),
  wall('t', [4, 3], [0, 3]),
  wall('l', [0, 3], [0, 0]),
  wall('x', [2, -1], [2, 4]),
];

describe('joins per level', () => {
  it('a wall upstairs over the bottom wall leaves the ground floor exactly as it was, and is whole', () => {
    const base: Doc = { ...newDocument(), walls: ground };
    const two = addLevel('lvl_up', 'Upper').apply(base);
    const withUp = { ...two, walls: [...ground, wall('u', [1, 0], [3, 0], 'lvl_up')] };
    const before = deriveGeometry(base);
    const after = deriveGeometry(withUp);
    for (const w of ground) expect(after.solids.get(w.id)!.pieces).toEqual(before.solids.get(w.id)!.pieces);
    expect(after.warnings).toEqual(before.warnings);
    // Alone on its level: one plain rectangle, 2 m × 0.2 m.
    const up = after.solids.get('u')!.pieces;
    expect(up).toHaveLength(1);
    expect(after.warnings.filter((w) => w.walls.includes('u'))).toEqual([]);
  });
});
