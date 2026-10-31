// Walls standing off the face of the wall below them (app/stacked.ts): the step on the façade, and the
// move that aligns it. Worked out by hand: the exterior face is on the right of a wall's direction.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { stackedSteps } from '../../src/session/stacked';
import { moveWalls } from '../../src/elements/wall/edit';
import { wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';

const wall = (id: WallId, levelId: string, type: string, a: [number, number], b: [number, number], referenceLine: DocWall['referenceLine'] = 'centerline'): DocWall => ({
  id,
  wallTypeId: type,
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine,
  levelId,
});

const levels = [...newDocument().levels, { id: 'lvl_up', name: 'Upper', elevation: 2.8, height: 2.8 }];
const doc = (walls: DocWall[]): Doc => ({ ...newDocument(), levels, walls });

describe('a wall standing on another, off its face', () => {
  // Below: 20 cm along +x on its axis, its exterior face at y = −0.1. Above: 15 cm on the same axis,
  // its exterior face at y = −0.075, 2.5 cm in.
  const below = wall(wid('b'), 'lvl_ground', 'wt_masonry20', [0, 0], [5, 0]);
  const above = wall(wid('u'), 'lvl_up', 'wt_masonry15', [0, 0], [5, 0]);

  it('the step is 2.5 cm, and the move that aligns it goes 2.5 cm out (−y)', () => {
    const [s] = stackedSteps(doc([below, above]));
    expect(s).toMatchObject({ upperId: 'u', lowerId: 'b' });
    expect(s!.size).toBeCloseTo(0.025, 12);
    expect(s!.shift.x).toBeCloseTo(0, 12);
    expect(s!.shift.y).toBeCloseTo(-0.025, 12);
  });

  it('drawn the other way above, the same step on the same face', () => {
    const [s] = stackedSteps(doc([below, wall(wid('u'), 'lvl_up', 'wt_masonry15', [5, 0], [0, 0])]));
    expect(s!.size).toBeCloseTo(0.025, 12);
    expect(s!.shift.y).toBeCloseTo(-0.025, 12);
  });

  it('moved by its shift, it stands flush: no step left', () => {
    const d = doc([below, above]);
    const [s] = stackedSteps(d);
    const aligned = { ...d, walls: moveWalls(d, [wid('u')], s!.shift) };
    expect(stackedSteps(aligned)).toEqual([]);
  });

  it('drawn on its exterior face along the same line, it is flush already', () => {
    // On its exterior face at y = −0.1, the lower wall's.
    expect(stackedSteps(doc([below, wall(wid('u'), 'lvl_up', 'wt_masonry15', [0, -0.1], [5, -0.1], 'exteriorFace')]))).toEqual([]);
  });

  it('a wall across it, beside it, or on the same level is not standing on it', () => {
    expect(stackedSteps(doc([below, wall(wid('u'), 'lvl_up', 'wt_masonry15', [2, -2], [2, 2])]))).toEqual([]);
    expect(stackedSteps(doc([below, wall(wid('u'), 'lvl_up', 'wt_masonry15', [0, 1], [5, 1])]))).toEqual([]);
    expect(stackedSteps(doc([below, wall(wid('u'), 'lvl_ground', 'wt_masonry15', [0, 0.5], [5, 0.5])]))).toEqual([]);
  });
});
