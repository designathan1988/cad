// Select similar (select-similar.ts): from a selection, its like on the level shown.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { similarTo } from '../../src/app/select-similar';
import { newOpening } from '../../src/elements/opening/schema';

const wall = (id: string, type: string, levelId = 'lvl_ground', y = 0): DocWall => ({
  id,
  wallTypeId: type,
  start: { x: 0, y },
  end: { x: 4, y },
  referenceLine: 'centerline',
  levelId,
});

const base = newDocument();
const doc: Doc = {
  ...base,
  levels: [...base.levels, { id: 'lvl_up', name: 'Up', elevation: 2.8, height: 2.8 }],
  walls: [wall('a', 'wt_masonry15'), wall('b', 'wt_masonry15', 'lvl_ground', 3), wall('c', 'wt_concrete20', 'lvl_ground', 6), wall('d', 'wt_masonry15', 'lvl_up')],
  openings: [
    newOpening('opening_1', 'a', 'door', { kind: 'centered' }, { width: 0.8 }),
    newOpening('opening_2', 'b', 'door', { kind: 'centered' }, { width: 0.8 }),
    newOpening('opening_3', 'c', 'door', { kind: 'centered' }, { width: 0.9 }),
    newOpening('opening_4', 'c', 'window', { kind: 'fromStart', distance: 0.5 }, { width: 0.8 }),
    newOpening('opening_5', 'd', 'door', { kind: 'centered' }, { width: 0.8 }),
  ],
  rooms: [
    { id: 'room_1', levelId: 'lvl_ground', seed: { x: 1, y: 1 }, name: 'A', number: '1', use: 'bedroom' },
    { id: 'room_2', levelId: 'lvl_ground', seed: { x: 1, y: 4 }, name: 'B', number: '2', use: 'bedroom' },
    { id: 'room_3', levelId: 'lvl_ground', seed: { x: 1, y: 7 }, name: 'C', number: '3', use: 'kitchen' },
    { id: 'room_4', levelId: 'lvl_ground', seed: { x: 1, y: 9 }, name: 'D', number: '4' },
  ],
};

describe('select similar', () => {
  it('walls: the same type on this level, not the other type, not another level', () => {
    expect(similarTo(doc, new Set(['a']), 'lvl_ground')).toEqual(['a', 'b']);
  });

  it('doors: the same kind and size on this level; a 0.8 window or a 0.9 door is not like a 0.8 door', () => {
    expect(similarTo(doc, new Set(['opening_1']), 'lvl_ground')).toEqual(['opening_1', 'opening_2']);
  });

  it('rooms: the same use; a room with none brings every room of the level', () => {
    expect(similarTo(doc, new Set(['room_1']), 'lvl_ground')).toEqual(['room_1', 'room_2']);
    expect(similarTo(doc, new Set(['room_4']), 'lvl_ground')).toEqual(['room_4', 'room_1', 'room_2', 'room_3']);
  });

  it('a mixed selection brings the like of each', () => {
    expect(similarTo(doc, new Set(['c', 'room_3']), 'lvl_ground').sort()).toEqual(['c', 'room_3']);
    expect(similarTo(doc, new Set(['c', 'opening_2']), 'lvl_ground').sort()).toEqual(['c', 'opening_1', 'opening_2']);
  });
});
