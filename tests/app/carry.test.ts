// A room goes with its walls: when every wall around it moves or turns, its point does the same; a
// room with a wall left behind stays where it is.

import { describe, expect, it } from 'vitest';
import { moveRooms, roomsGoingWith, wallsAround } from '../../src/app/carry';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';

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

// Two rooms side by side: left 0..4, right 4..8, sharing the wall at x = 4.
const doc: Doc = {
  ...newDocument(),
  walls: [
    wall('b1', [0, 0], [4, 0]), wall('b2', [4, 0], [8, 0]), wall('r', [8, 0], [8, 3]),
    wall('t2', [8, 3], [4, 3]), wall('t1', [4, 3], [0, 3]), wall('l', [0, 3], [0, 0]), wall('m', [4, 0], [4, 3]),
  ],
  rooms: [
    { id: 'L', levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Room 1', number: '1' },
    { id: 'R', levelId: 'lvl_ground', seed: { x: 6, y: 1.5 }, name: 'Room 2', number: '2' },
  ],
};
const shift = (p: { x: number; y: number }) => ({ x: p.x + 10, y: p.y });

describe('rooms carried with their walls', () => {
  // carriedRooms was a one-line composition of roomsGoingWith + moveRooms; this is the same call.
  const carried = (moved: ReadonlySet<string>) => moveRooms(doc.rooms, roomsGoingWith(doc, deriveGeometry(doc), moved), shift);
  it('every wall moved: both rooms move', () => {
    const rooms = carried(new Set(doc.walls.map((w) => w.id)));
    expect(rooms.map((r) => r.seed)).toEqual([{ x: 12, y: 1.5 }, { x: 16, y: 1.5 }]);
  });

  it('only the walls of the left room (with the shared one): the left room moves, the right one stays', () => {
    const rooms = carried(new Set(['b1', 't1', 'l', 'm']));
    expect(rooms.map((r) => r.seed)).toEqual([{ x: 12, y: 1.5 }, { x: 6, y: 1.5 }]);
  });

  it('one wall only: no room moves', () => {
    expect(carried(new Set(['l']))).toEqual(doc.rooms);
  });
});

describe('the walls around a room', () => {
  it('every wall whose pieces touch its outline, the shared one included; none when it is open', () => {
    const room = doc.rooms.find((r) => r.id === 'L')!;
    expect(wallsAround(deriveGeometry(doc), room).sort()).toEqual(['b1', 'l', 'm', 't1']);
    const open = { ...doc, walls: doc.walls.filter((w) => w.id !== 'l') };
    expect(wallsAround(deriveGeometry(open), room)).toEqual([]);
  });
});
