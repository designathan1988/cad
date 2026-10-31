// A wall's type changed keeps the room's clear size (phase 11, diferenciais 3): the face against the
// room stays where it was, the thickness going to the other side; between two rooms the middle stays,
// the two sharing the change; with no room, or the option off, the reference line stays.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { insideRing } from '../../src/elements/room/derive';
import type { ReferenceLine } from '../../src/elements/wall/schema';
import { changeWallType, roomFace } from '../../src/elements/wall/edit';
import { rid, wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';

const wall = (id: WallId, a: [number, number], b: [number, number], type = 'wt_masonry15', referenceLine: ReferenceLine = 'centerline'): DocWall => ({
  id,
  wallTypeId: type,
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine,
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

const box: Doc = {
  ...newDocument(),
  walls: [wall(wid('s'), [0, 0], [6, 0]), wall(wid('e'), [6, 0], [6, 4]), wall(wid('n'), [6, 4], [0, 4]), wall(wid('w'), [0, 4], [0, 0])],
  rooms: [{ id: rid('r'), levelId: 'lvl_ground', seed: { x: 3, y: 2 }, name: 'Room 1', number: '1' }],
};

const inRoomOf = (doc: Doc) => {
  const rooms = [...deriveGeometry(doc).rooms.values()].filter((r) => r.enclosed);
  return (levelId: string, p: { x: number; y: number }) => rooms.some((r) => r.room.levelId === levelId && insideRing(r.outline, p));
};
const areas = (doc: Doc) => [...deriveGeometry(doc).rooms.values()].map((r) => Math.round(r.area * 1e6) / 1e6);
const keepRoom = (doc: Doc) => {
  const inRoom = inRoomOf(doc);
  return (w: DocWall) => roomFace(doc, w, inRoom);
};

describe('a wall type changed', () => {
  it('a room\'s walls 15 → 20 cm: the room keeps its size, the walls grow outwards', () => {
    expect(areas(box)).toEqual([5.85 * 3.85]);
    const walls = changeWallType(box, [wid('s'), wid('e'), wid('n'), wid('w')], 'wt_concrete20', keepRoom(box));
    const next = { ...box, walls };
    expect(walls.every((w) => w.wallTypeId === 'wt_concrete20')).toBe(true);
    expect(areas(next)[0]).toBeCloseTo(5.85 * 3.85, 9);
    // The south wall's line went 2.5 cm out, away from the room.
    expect(walls.find((w) => w.id === 's')!.start.y).toBeCloseTo(-0.025, 9);
  });

  it('with the option off the reference line stays, and the room is smaller', () => {
    const walls = changeWallType(box, [wid('s'), wid('e'), wid('n'), wid('w')], 'wt_concrete20', () => null);
    expect(walls.find((w) => w.id === 's')!.start).toEqual({ x: 0, y: 0 });
    expect(areas({ ...box, walls })[0]).toBeCloseTo(5.8 * 3.8, 9);
  });

  it('one wall alone: only it moves, its neighbours keep their joins to it', () => {
    const walls = changeWallType(box, [wid('s')], 'wt_concrete20', keepRoom(box));
    const g = deriveGeometry({ ...box, walls });
    expect(areas({ ...box, walls })[0]).toBeCloseTo(5.85 * 3.85, 9);
    expect(g.warnings).toEqual([]);
    expect(walls.find((w) => w.id === 'e')!.start.y).toBeCloseTo(-0.025, 9);
  });

  it('a partition between two rooms: its middle stays, the two rooms share the change', () => {
    const doc: Doc = {
      ...newDocument(),
      walls: [
        wall(wid('s'), [0, 0], [8, 0]),
        wall(wid('e'), [8, 0], [8, 4]),
        wall(wid('n'), [8, 4], [0, 4]),
        wall(wid('w'), [0, 4], [0, 0]),
        // Drawn on its exterior face: kept on its line, its whole thickness would go to one side.
        wall(wid('p'), [4, 0], [4, 4], 'wt_masonry20', 'exteriorFace'),
      ],
      rooms: [
        { id: rid('a'), levelId: 'lvl_ground', seed: { x: 2, y: 2 }, name: 'A', number: '1' },
        { id: rid('b'), levelId: 'lvl_ground', seed: { x: 6, y: 2 }, name: 'B', number: '2' },
      ],
    };
    const w = doc.walls.find((x) => x.id === 'p')!;
    expect(roomFace(doc, w, inRoomOf(doc))).toBe('middle');
    const before = areas(doc);
    const next = { ...doc, walls: changeWallType(doc, [wid('p')], 'wt_drywall10', keepRoom(doc)) };
    const after = areas(next);
    // 10 cm thinner, 5 cm to each room: 5 cm × 3.85 m more each.
    expect(after[0]! - before[0]!).toBeCloseTo(0.05 * 3.85, 9);
    expect(after[1]! - before[1]!).toBeCloseTo(0.05 * 3.85, 9);
  });

  it('a wall with no room on either side keeps its reference line', () => {
    const doc: Doc = { ...newDocument(), walls: [wall(wid('a'), [0, 0], [5, 0])] };
    expect(roomFace(doc, doc.walls[0]!, inRoomOf(doc))).toBeNull();
    expect(changeWallType(doc, [wid('a')], 'wt_concrete20', keepRoom(doc))[0]!.start).toEqual({ x: 0, y: 0 });
  });

  it('an arc wall round a room: its radius changes so its inner face stays', () => {
    // A half-round room: a straight wall and an arc over it (bulge 1, a half circle of radius 3).
    const doc: Doc = {
      ...newDocument(),
      walls: [wall(wid('d'), [-3, 0], [3, 0]), { ...wall(wid('c'), [3, 0], [-3, 0]), bulge: 1 }],
      rooms: [{ id: rid('r'), levelId: 'lvl_ground', seed: { x: 0, y: 1 }, name: 'R', number: '1' }],
    };
    const before = areas(doc)[0]!;
    expect(roomFace(doc, doc.walls[1]!, inRoomOf(doc))).not.toBeNull();
    const next = { ...doc, walls: changeWallType(doc, [wid('c')], 'wt_concrete20', keepRoom(doc)) };
    expect(areas(next)[0]).toBeCloseTo(before, 3);
  });
});
