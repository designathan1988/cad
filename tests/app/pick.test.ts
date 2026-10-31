// Taking an element with a click in plan: on it, or a few pixels off it. A 4 × 3 box of 20 cm walls
// on their centre lines, so the bottom wall's body runs from y = −0.1 to y = 0.1.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { openingAt, wallAt } from '../../src/project/derived-queries';
import { newOpening } from '../../src/elements/opening/schema';
import { symbolLines } from '../../src/elements/opening/symbol';
import { oid, wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';

const wall = (id: WallId, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
});
const doc: Doc = {
  ...newDocument(),
  walls: [wall(wid('b'), [0, 0], [4, 0]), wall(wid('r'), [4, 0], [4, 3]), wall(wid('t'), [4, 3], [0, 3]), wall(wid('l'), [0, 3], [0, 0])],
  openings: [newOpening(oid('d'), wid('b'), 'door', { kind: 'fromStart', distance: 0.5 })],
};
const g = deriveGeometry(doc);
// 6 px at 1 cm a pixel.
const REACH = 0.06;

describe('taking a wall', () => {
  it('on its body, as before', () => {
    expect(wallAt(g, { x: 3, y: 0.05 })).toBe('b');
  });

  it('4 cm off its face: only with the reach, and the nearest wall wins', () => {
    expect(wallAt(g, { x: 3, y: 0.14 })).toBeNull();
    expect(wallAt(g, { x: 3, y: 0.14 }, undefined, REACH)).toBe('b');
    expect(wallAt(g, { x: 3.86, y: 1.5 }, undefined, REACH)).toBe('r');
    // Farther than the reach from every wall: none.
    expect(wallAt(g, { x: 2, y: 1.5 }, undefined, REACH)).toBeNull();
  });
});

describe('taking a door by what the plan draws of it', () => {
  it('a point 2 cm off its leaf or swing, well inside the room, takes the door', () => {
    const o = g.openings.get(oid('d'))!;
    // The symbol's farthest point from the wall: the leaf's free end or the swing's.
    const far = symbolLines(o, o.frame)
      .flat()
      .reduce((a, b) => (Math.abs(b.y) > Math.abs(a.y) ? b : a));
    expect(Math.abs(far.y)).toBeGreaterThan(0.5);
    const p = { x: far.x + 0.02, y: far.y };
    expect(openingAt(g, p)).toBeNull();
    expect(openingAt(g, p, REACH)).toBe('d');
    expect(wallAt(g, p, undefined, REACH)).toBeNull();
  });
});
