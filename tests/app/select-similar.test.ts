// Select similar (select-similar.ts): from a selection, its like on the level shown.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { similarTo } from '../../src/session/select-similar';
import { newOpening } from '../../src/elements/opening/schema';
import { lid, oid, rid, wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';

const wall = (id: WallId, type: string, levelId = lid('lvl_ground'), y = 0): DocWall => ({
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
  levels: [...base.levels, { id: lid('lvl_up'), name: 'Up', elevation: 2.8, height: 2.8 }],
  walls: [wall(wid('a'), 'wt_masonry15'), wall(wid('b'), 'wt_masonry15', lid('lvl_ground'), 3), wall(wid('c'), 'wt_concrete20', lid('lvl_ground'), 6), wall(wid('d'), 'wt_masonry15', lid('lvl_up'))],
  openings: [
    newOpening(oid('opening_1'), wid('a'), 'door', { kind: 'centered' }, { width: 0.8 }),
    newOpening(oid('opening_2'), wid('b'), 'door', { kind: 'centered' }, { width: 0.8 }),
    newOpening(oid('opening_3'), wid('c'), 'door', { kind: 'centered' }, { width: 0.9 }),
    newOpening(oid('opening_4'), wid('c'), 'window', { kind: 'fromStart', distance: 0.5 }, { width: 0.8 }),
    newOpening(oid('opening_5'), wid('d'), 'door', { kind: 'centered' }, { width: 0.8 }),
  ],
  rooms: [
    { id: rid('room_1'), levelId: lid('lvl_ground'), seed: { x: 1, y: 1 }, name: 'A', number: '1', use: 'bedroom' },
    { id: rid('room_2'), levelId: lid('lvl_ground'), seed: { x: 1, y: 4 }, name: 'B', number: '2', use: 'bedroom' },
    { id: rid('room_3'), levelId: lid('lvl_ground'), seed: { x: 1, y: 7 }, name: 'C', number: '3', use: 'kitchen' },
    { id: rid('room_4'), levelId: lid('lvl_ground'), seed: { x: 1, y: 9 }, name: 'D', number: '4' },
  ],
};

describe('select similar', () => {
  it('walls: the same type on this level, not the other type, not another level', () => {
    expect(similarTo(doc, new Set(['a']), lid('lvl_ground'))).toEqual(['a', 'b']);
  });

  it('doors: the same kind and size on this level; a 0.8 window or a 0.9 door is not like a 0.8 door', () => {
    expect(similarTo(doc, new Set(['opening_1']), lid('lvl_ground'))).toEqual(['opening_1', 'opening_2']);
  });

  it('rooms: the same use; a room with none brings every room of the level', () => {
    expect(similarTo(doc, new Set(['room_1']), lid('lvl_ground'))).toEqual(['room_1', 'room_2']);
    expect(similarTo(doc, new Set(['room_4']), lid('lvl_ground'))).toEqual(['room_4', 'room_1', 'room_2', 'room_3']);
  });

  it('a mixed selection brings the like of each', () => {
    expect(similarTo(doc, new Set(['c', 'room_3']), lid('lvl_ground')).sort()).toEqual(['c', 'room_3']);
    expect(similarTo(doc, new Set(['c', 'opening_2']), lid('lvl_ground')).sort()).toEqual(['c', 'opening_1', 'opening_2']);
  });
});
