// Rooms and floors. Every expected area is worked out by hand from the walls' faces.

import { floorsOf } from '../../../src/elements/registry';
import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../../src/project/doc';
import { deriveGeometry } from '../../../src/project/derive';
import { vec } from '../../../src/model/vector';
import { deleteElements } from '../../../src/elements/opening/commands';
import { moveWalls } from '../../../src/tools/edit';

const wall = (id: string, a: [number, number], b: [number, number], type = 'wt_concrete20'): DocWall => ({
  id,
  wallTypeId: type,
  start: vec(a[0], a[1]),
  end: vec(b[0], b[1]),
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

// 8 × 6 on the axis, 20 cm concrete: the inside is x ∈ [0.1, 7.9], y ∈ [0.1, 5.9].
const ring = [wall('w0', [0, 0], [8, 0]), wall('w1', [8, 0], [8, 6]), wall('w2', [8, 6], [0, 6]), wall('w3', [0, 6], [0, 0])];
const room = (id: string, x: number, y: number) => ({ id, levelId: 'lvl_ground', seed: vec(x, y), name: id, number: '1' });
const doc = (extra: Partial<Doc> = {}): Doc => ({ ...newDocument(), walls: ring, ...extra });

describe('rooms', () => {
  it('a click inside closed walls: the inside of their faces, 7.8 × 5.8 = 45.24 m², perimeter 27.2 m', () => {
    const r = deriveGeometry(doc({ rooms: [room('r', 4, 3)] })).rooms.get('r')!;
    expect(r.enclosed).toBe(true);
    expect(r.area).toBeCloseTo(45.24, 9);
    expect(r.perimeter).toBeCloseTo(27.2, 9);
  });

  it('its name sits in the middle of the room as it is now, not at the point it was made from', () => {
    // Made from (1, 1): the inside is 0.1 to 7.9 by 0.1 to 5.9, centre (4, 3).
    const r = deriveGeometry(doc({ rooms: [room('r', 1, 1)] })).rooms.get('r')!;
    expect(r.label.x).toBeCloseTo(4, 2);
    expect(r.label.y).toBeCloseTo(3, 2);
    // The right wall moved 2 m out: the inside runs to 9.9, centre x = 5.
    const wider = ring.map((w) => (w.id === 'w1' ? { ...w, start: vec(10, 0), end: vec(10, 6) } : w.id === 'w0' ? { ...w, end: vec(10, 0) } : w.id === 'w2' ? { ...w, start: vec(10, 6) } : w));
    const moved = deriveGeometry(doc({ walls: wider, rooms: [room('r', 1, 1)] })).rooms.get('r')!;
    expect(moved.label.x).toBeCloseTo(5, 2);
  });

  it('a divider splits it: the left room is 3.825 × 5.8 = 22.185 m²', () => {
    // Divider 15 cm masonry at x = 4: faces 3.925 and 4.075.
    const walls = [...ring, wall('d', [4, 0], [4, 6], 'wt_masonry15')];
    const r = deriveGeometry(doc({ walls, rooms: [room('r', 2, 3)] })).rooms.get('r')!;
    expect(r.area).toBeCloseTo(3.825 * 5.8, 9);
  });

  it('a point outside the walls, or inside a wall, is not enclosed', () => {
    const g = deriveGeometry(doc({ rooms: [room('out', 20, 3), room('in', 4, 0.05)] }));
    expect(g.rooms.get('out')!.enclosed).toBe(false);
    expect(g.rooms.get('in')!.enclosed).toBe(false);
    expect(g.roomWarnings.map((w) => w.roomId).sort()).toEqual(['in', 'out']);
    expect(g.rooms.get('in')!.sharing).toEqual([]);
  });

  it('two rooms in one space (a divider moved away): each names the other, and both are warned', () => {
    const g = deriveGeometry(doc({ rooms: [room('a', 2, 3), room('b', 6, 3), room('c', 20, 3)] }));
    expect(g.rooms.get('a')!.sharing).toEqual(['b']);
    expect(g.rooms.get('b')!.sharing).toEqual(['a']);
    expect(g.rooms.get('c')!.sharing).toEqual([]);
    expect(g.roomWarnings.filter((w) => w.kind === 'roomShared').map((w) => w.roomId).sort()).toEqual(['a', 'b']);
  });

  it('the room follows its walls: moving the right wall 2 m makes it 9.8 × 5.8', () => {
    const d = doc({ rooms: [room('r', 4, 3)] });
    const moved = { ...d, walls: moveWalls(d, ['w1'], vec(2, 0)) };
    expect(deriveGeometry(moved).rooms.get('r')!.area).toBeCloseTo(9.8 * 5.8, 9);
  });
});

describe('floors', () => {
  it('a floor linked to a room takes its outline; one drawn by outline keeps its own', () => {
    const g = deriveGeometry(
      doc({
        rooms: [room('r', 4, 3)],
        floors: [
          { id: 'f1', levelId: 'lvl_ground', source: { kind: 'room', roomId: 'r' }, thickness: 0.15, offset: 0 },
          { id: 'f2', levelId: 'lvl_ground', source: { kind: 'outline', points: [vec(10, 0), vec(13, 0), vec(13, 2), vec(10, 2)] }, thickness: 0.1, offset: 0 },
        ],
      }),
    );
    expect(floorsOf(g).get('f1')!.area).toBeCloseTo(45.24, 9);
    expect(floorsOf(g).get('f1')!.top).toBeCloseTo(0, 12);
    expect(floorsOf(g).get('f1')!.bottom).toBeCloseTo(-0.15, 12);
    expect(floorsOf(g).get('f2')!.area).toBeCloseTo(6, 12);
  });

  it('deleting a room keeps its floor where it was, as an outline', () => {
    const d = doc({
      rooms: [room('r', 4, 3)],
      floors: [{ id: 'f1', levelId: 'lvl_ground', source: { kind: 'room', roomId: 'r' }, thickness: 0.15, offset: 0 }],
    });
    const after = deleteElements(['r']).apply(d);
    expect(after.rooms).toEqual([]);
    expect(after.floors[0]!.source.kind).toBe('outline');
    expect(floorsOf(deriveGeometry(after)).get('f1')!.area).toBeCloseTo(45.24, 9);
  });
});
