// The project browser's data: categories that can be hidden, and how many walls use each type.

import { floorsOf } from '../../src/elements/registry';
import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { hideCategories } from '../../src/project/derived-filters';
import { typeUsage } from '../../src/session/browser-data';
import { newOpening } from '../../src/elements/opening/schema';
import { wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';

const wall = (id: WallId, type: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: type,
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

const doc: Doc = {
  ...newDocument(),
  walls: [wall(wid('a'), 'wt_concrete20', [0, 0], [4, 0]), wall(wid('b'), 'wt_concrete20', [4, 0], [4, 3]), wall(wid('c'), 'wt_masonry15', [4, 3], [0, 3]), wall(wid('d'), 'wt_masonry15', [0, 3], [0, 0])],
  openings: [newOpening('o', wid('a'), 'door', { kind: 'centered' })],
  rooms: [{ id: 'r', levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Room 1', number: '1' }],
  floors: [{ id: 'f', levelId: 'lvl_ground', source: { kind: 'room', roomId: 'r' }, thickness: 0.1, offset: 0 }],
};

describe('project browser', () => {
  it('hiding a category leaves the others as they are', () => {
    const g = deriveGeometry(doc);
    const noRooms = hideCategories(g, new Set(['rooms']));
    expect(noRooms.rooms.size).toBe(0);
    expect(noRooms.solids).toBe(g.solids);
    expect(floorsOf(noRooms)).toBe(floorsOf(g));
    const nothing = hideCategories(g, new Set(['walls', 'openings', 'rooms', 'floors']));
    expect([nothing.solids.size, nothing.openings.size, nothing.rooms.size, floorsOf(nothing).size]).toEqual([0, 0, 0, 0]);
    expect(hideCategories(g, new Set())).toBe(g);
  });

  it('wall types with how many walls use them, every type listed', () => {
    const usage = typeUsage(doc);
    expect(usage.get('wt_concrete20')).toBe(2);
    expect(usage.get('wt_masonry15')).toBe(2);
    expect(usage.get('wt_drywall10')).toBe(0);
    expect(usage.size).toBe(doc.wallTypes.length);
  });

  it('counted on one level: what a click on the type selects there', () => {
    const two = { ...doc, walls: [...doc.walls, { ...doc.walls[0]!, id: wid('up'), levelId: 'lvl_up' }] };
    expect(typeUsage(two).get('wt_concrete20')).toBe(3);
    expect(typeUsage(two, 'lvl_ground').get('wt_concrete20')).toBe(2);
    expect(typeUsage(two, 'lvl_up').get('wt_concrete20')).toBe(1);
  });
});
