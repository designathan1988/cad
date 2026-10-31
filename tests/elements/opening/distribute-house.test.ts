// Distributing windows in a real house: a closed rectangle of walls with a T wall between two rooms. The
// spaces are equal between the faces the room sees (a corner wall's inner face, the T wall's face), and
// dragging one of them afterwards moves only that one (the user's reports).

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../../src/project/doc';
import { hostsIn } from '../../../src/project/derived-queries';
import { distributeOpenings, updateOpening } from '../../../src/elements/opening/commands';
import { deriveOpenings } from '../../../src/elements/opening/derive';
import { newOpening } from '../../../src/elements/opening/schema';

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_masonry15',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

// 9 × 4.6, a T wall at x = 4.6 between the rooms; the bottom wall runs (0,0) → (9,0).
const walls = [wall('b', [0, 0], [9, 0]), wall('r', [9, 0], [9, 4.6]), wall('t', [9, 4.6], [0, 4.6]), wall('l', [0, 4.6], [0, 0]), wall('m', [4.6, 0], [4.6, 4.6])];
const win = (id: string, at: number) => newOpening(id, 'b', 'window', { kind: 'fromStart', distance: at });
const house = (): Doc => ({ ...newDocument(), walls, openings: [win('x', 2), win('y', 5.5), win('z', 7.5)] });
const placed = (d: Doc) => deriveOpenings(d.openings, hostsIn(d), d.openingGroups).placed;

describe('distribute in a house', () => {
  it('the two windows of the right room: equal spaces from the T wall face to the corner wall face', () => {
    const d = distributeOpenings('g', ['x', 'y', 'z'], { kind: 'equal' }).apply(house());
    const p = placed(d);
    const [y, z] = [p.get('y')!, p.get('z')!];
    // Faces: the T wall's right face at 4.675, the right wall's inner face at 8.925 (15 cm walls on their axes).
    const gaps = [y.start - 4.675, z.start - y.end, 8.925 - z.end];
    expect(gaps[0]).toBeCloseTo(gaps[1]!, 6);
    expect(gaps[1]).toBeCloseTo(gaps[2]!, 6);
  });

  it('one dragged away: the others stay where they were', () => {
    const d = distributeOpenings('g', ['x', 'y', 'z'], { kind: 'equal' }).apply(house());
    const before = placed(d);
    const next = updateOpening('y', { rule: { kind: 'fromStart', distance: 5 } }).apply(d);
    const after = placed(next);
    for (const id of ['x', 'z']) expect(after.get(id)!.start).toBeCloseTo(before.get(id)!.start, 9);
  });
});
