// The floating bar sits by any selection, rooms and floors included; an opening over another wall's
// joint is flagged.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { boundsOf, deriveGeometry } from '../../src/app/geometry';
import { newOpening } from '../../src/elements/opening/schema';

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

const box: Doc = {
  ...newDocument(),
  walls: [wall('b', [0, 0], [4, 0]), wall('r', [4, 0], [4, 3]), wall('t', [4, 3], [0, 3]), wall('l', [0, 3], [0, 0])],
  rooms: [{ id: 'room', levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Room 1', number: '1' }],
  floors: [{ id: 'fl', levelId: 'lvl_ground', source: { kind: 'outline', points: [{ x: 5, y: 0 }, { x: 7, y: 0 }, { x: 7, y: 2 }] }, thickness: 0.1, offset: 0 }],
};

describe('bounds of a selection', () => {
  it('a room: its outline, inside the walls', () => {
    const b = boundsOf(deriveGeometry(box), new Set(['room']))!;
    expect(b.min.x).toBeCloseTo(0.1, 9);
    expect(b.max.y).toBeCloseTo(2.9, 9);
  });

  it('a floor: its outline', () => {
    expect(boundsOf(deriveGeometry(box), new Set(['fl']))).toEqual({ min: { x: 5, y: 0 }, max: { x: 7, y: 2 } });
  });
});

describe('an opening over a joint', () => {
  // A wall t2 meets the bottom wall at x = 2 from below (a T).
  const tee: Doc = { ...box, walls: [...box.walls, wall('t2', [2, -3], [2, 0])] };

  it('centred on the bottom wall, its 1.20 m span covers the T at x = 2: flagged', () => {
    const g = deriveGeometry({ ...tee, openings: [newOpening('o', 'b', 'window', { kind: 'centered' })] });
    expect(g.openings.get('o')!.warnings).toContain('openingAtJoint');
    expect(g.openingWarnings).toContainEqual({ kind: 'openingAtJoint', openings: ['o'] });
  });

  it('beside the T: not flagged; at the wall corner it is joined to: not flagged either', () => {
    const g = deriveGeometry({ ...tee, openings: [newOpening('o', 'b', 'window', { kind: 'fromEnd', distance: 0.5 })] });
    expect(g.openings.get('o')!.warnings).toEqual([]);
  });
});
