// Where other walls meet a wall: the stations of their faces along its reference line.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { wallStops } from '../../src/elements/wall/stops';
import { vec } from '../../src/model/vector';
import { lid, tid, wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';

const wall = (id: WallId, a: [number, number], b: [number, number], levelId = lid('lvl_ground')): DocWall => ({
  id,
  wallTypeId: tid('wt_concrete20'),
  start: vec(a[0], a[1]),
  end: vec(b[0], b[1]),
  referenceLine: 'centerline',
  levelId,
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

const with_ = (...walls: DocWall[]): Doc => ({ ...newDocument(), walls });

describe('wall stops', () => {
  it('a partition standing on the wall (a T) and a corner wall: their faces, inside the wall only', () => {
    const d = with_(wall(wid('h'), [0, 0], [6, 0]), wall(wid('t'), [2, 0], [2, 3]), wall(wid('c'), [6, 0], [6, 4]));
    const s = wallStops(d, wid('h'));
    // The T's faces at 1.90 and 2.10; the corner's inner face at 5.90 (its outer one, 6.10, is past the end).
    expect(s.map((x) => Math.round(x * 1e9) / 1e9)).toEqual([1.9, 2.1, 5.9]);
  });

  it('a slanted partition: where its faces cross the reference line', () => {
    // At 45°, a 20 cm wall's faces cross a line 0.10·√2 either side of its axis.
    const d = with_(wall(wid('h'), [0, 0], [6, 0]), wall(wid('t'), [3, 0], [5, 2]));
    const s = wallStops(d, wid('h'));
    expect(s[0]).toBeCloseTo(3 - 0.1 * Math.SQRT2, 9);
    expect(s[1]).toBeCloseTo(3 + 0.1 * Math.SQRT2, 9);
  });

  it('walls that do not reach it, run alongside it, or stand on another level: none', () => {
    const d = with_(
      wall(wid('h'), [0, 0], [6, 0]),
      wall(wid('far'), [2, 1], [2, 3]),
      wall(wid('along'), [0, 0.5], [6, 0.5]),
      wall(wid('up'), [3, 0], [3, 3], lid('lvl_other')),
    );
    expect(wallStops(d, wid('h'))).toEqual([]);
  });
});
