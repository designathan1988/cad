// Moving, turning, scaling and mirroring the selection, in place and copied, worked out by hand on a
// 4 × 3 box (b along the bottom from (0, 0) to (4, 0), then r, t, l round it), a wall x going on
// from the box's corner (4, 0) to (6, 0), a door on b 1 m from its start, and the room inside.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { newOpening } from '../../src/elements/opening/schema';
import { canTransform, copiesInSeries, copyToLevel, reflection, rotation, scaling, transformSelection, translation } from '../../src/elements/transform';
import { fid, oid, rid, wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';

const wall = (id: WallId, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
});
const doc: Doc = {
  ...newDocument(),
  walls: [wall(wid('b'), [0, 0], [4, 0]), wall(wid('r'), [4, 0], [4, 3]), wall(wid('t'), [4, 3], [0, 3]), wall(wid('l'), [0, 3], [0, 0]), wall(wid('x'), [4, 0], [6, 0])],
  openings: [newOpening(oid('opening_d'), wid('b'), 'door', { kind: 'fromStart', distance: 1 }, { hinge: 'start', swing: 'left' })],
  rooms: [{ id: rid('room'), levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Room 1', number: '1' }],
  floors: [{ id: fid('floor'), levelId: 'lvl_ground', source: { kind: 'room', roomId: rid('room') }, thickness: 0.15, offset: 0 }],
};
const g = deriveGeometry(doc);
const box = ['b', 'r', 't', 'l'];
let n = 0;
const newId = (prefix: string) => `${prefix}_${++n}`;
const find = (d: Doc, id: string) => d.walls.find((w) => w.id === id)!;

describe('in place', () => {
  it('moved 1 m right: the box goes, the room inside with it, and the wall joined at its corner keeps the join', () => {
    const r = transformSelection(doc, g, box, translation({ x: 1, y: 0 }), false, newId);
    expect(find(r.doc, 'b')).toMatchObject({ start: { x: 1, y: 0 }, end: { x: 5, y: 0 } });
    // x was not selected: its start, at the corner, follows it; its end stays.
    expect(find(r.doc, 'x')).toMatchObject({ start: { x: 5, y: 0 }, end: { x: 6, y: 0 } });
    expect(r.doc.rooms[0]!.seed).toEqual({ x: 3, y: 1.5 });
    expect(r.doc.openings[0]!.rule).toEqual({ kind: 'fromStart', distance: 1 });
    expect(r.selection).toEqual(box);
  });

  it('turned a quarter about the origin: (4, 0) goes to (0, 4), the room point (2, 1.5) to (−1.5, 2)', () => {
    const r = transformSelection(doc, g, box, rotation({ x: 0, y: 0 }, Math.PI / 2), false, newId);
    const b = find(r.doc, 'b');
    expect(b.end.x).toBeCloseTo(0, 12);
    expect(b.end.y).toBeCloseTo(4, 12);
    expect(r.doc.rooms[0]!.seed.x).toBeCloseTo(-1.5, 12);
    expect(r.doc.rooms[0]!.seed.y).toBeCloseTo(2, 12);
  });

  it('scaled twice from the origin: lengths and the door distance double, not the door or the wall thickness', () => {
    const r = transformSelection(doc, g, box, scaling({ x: 0, y: 0 }, 2), false, newId);
    expect(find(r.doc, 'b')).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 8, y: 0 } });
    expect(r.doc.openings[0]).toMatchObject({ rule: { kind: 'fromStart', distance: 2 }, width: 0.9 });
    expect(find(r.doc, 'b').wallTypeId).toBe('wt_concrete20');
  });
});

describe('a mirrored copy', () => {
  // Across the vertical line x = −1: (x, y) goes to (−2 − x, y).
  const r = transformSelection(doc, g, ['b'], reflection({ x: -1, y: 0 }, { x: -1, y: 1 }), true, newId);
  const copy = r.doc.walls.at(-1)!;

  it('the wall is reflected and its ends swapped, so it runs left to right again with its layers mirrored', () => {
    expect(copy.start).toEqual({ x: -6, y: 0 });
    expect(copy.end).toEqual({ x: -2, y: 0 });
    expect(r.selection).toEqual([copy.id]);
    // The original stays.
    expect(find(r.doc, 'b')).toEqual(doc.walls[0]);
  });

  it('its door: measured from the other end, hinged at the other jamb, opening to the same side (the mirrored one)', () => {
    const d = r.doc.openings.at(-1)!;
    expect(d.id.startsWith('opening_')).toBe(true);
    expect(d).toMatchObject({ wallId: copy.id, rule: { kind: 'fromEnd', distance: 1 }, hinge: 'end', swing: 'left' });
    // Where it lands: the original's jambs at x = 1 and 1.9 go to −3 and −3.9.
    const placed = deriveGeometry(r.doc).openings.get(d.id)!;
    const xs = [placed.start, placed.end].map((s) => copy.start.x + s);
    expect(xs[0]).toBeCloseTo(-3.9, 9);
    expect(xs[1]).toBeCloseTo(-3, 9);
  });
});

describe('copies', () => {
  it('the whole box copied 6 m up: four new walls, its room numbered on (2) and its floor following the new room', () => {
    const r = transformSelection(doc, g, box, translation({ x: 0, y: 6 }), true, newId);
    expect(r.doc.walls).toHaveLength(9);
    const room = r.doc.rooms.at(-1)!;
    expect(room).toMatchObject({ number: '2', seed: { x: 2, y: 7.5 }, name: 'Room 1' });
    expect(r.doc.floors.at(-1)!.source).toEqual({ kind: 'room', roomId: room.id });
    // The copied room closes: its walls came along.
    expect(deriveGeometry(r.doc).rooms.get(room.id)!.enclosed).toBe(true);
  });
});

describe('what these tools take', () => {
  it('walls, doors and windows, rooms, outline floors and guides; not a room floor alone', () => {
    expect(canTransform(doc, ['b'])).toBe(true);
    expect(canTransform(doc, ['room'])).toBe(true);
    expect(canTransform(doc, ['opening_d'])).toBe(true);
    expect(canTransform(doc, ['floor'])).toBe(false);
  });
});

describe('a door selected without its wall', () => {
  // The door on b is 0.9 m wide (default), its middle at x = 1 + 0.45 = 1.45 on b (y = 0).
  it('moved 1 m along its wall: it slides on b, the walls stay', () => {
    const r = transformSelection(doc, g, ['opening_d'], translation({ x: 1, y: 0 }), false, newId);
    const d = r.doc.openings[0]!;
    expect(d.wallId).toBe('b');
    expect(g.openings.get(oid('opening_d'))!.start).toBeCloseTo(1, 9);
    expect(deriveGeometry(r.doc).openings.get(oid('opening_d'))!.start).toBeCloseTo(2, 9);
    expect(find(r.doc, 'b')).toEqual(find(doc, 'b'));
    expect(r.selection).toEqual(['opening_d']);
  });

  it('moved onto the right wall: it goes onto r, opening to the side its middle landed on', () => {
    // Middle (1.45, 0) to (4.03, 1.5): on r (x = 4), a hair inside the box from its axis.
    const r = transformSelection(doc, g, ['opening_d'], translation({ x: 2.58, y: 1.5 }), false, newId);
    const d = r.doc.openings[0]!;
    expect(d.wallId).toBe('r');
    const placed = deriveGeometry(r.doc).openings.get(oid('opening_d'))!;
    expect((placed.start + placed.end) / 2).toBeCloseTo(1.5, 9);
  });

  it('copied 1 m along: a new door on b, the first one where it was; with no wall there, no copy', () => {
    const r = transformSelection(doc, g, ['opening_d'], translation({ x: 1, y: 0 }), true, newId);
    expect(r.doc.openings).toHaveLength(2);
    const copy = r.doc.openings[1]!;
    expect(r.selection).toEqual([copy.id]);
    expect(copy.wallId).toBe('b');
    expect(deriveGeometry(r.doc).openings.get(copy.id)!.start).toBeCloseTo(2, 9);
    const nowhere = transformSelection(doc, g, ['opening_d'], translation({ x: 0, y: 1.5 }), true, newId);
    expect(nowhere.doc.openings).toHaveLength(1);
  });
});

describe('copied to another level (Ctrl+C, Ctrl+V)', () => {
  const twoLevels: Doc = { ...doc, levels: [...doc.levels, { id: 'lvl_up', name: 'Upper', elevation: 3, height: 2.8 }] };
  const g2 = deriveGeometry(twoLevels);

  it('the box, its door and its room: copies on the upper level in the same place, the originals kept', () => {
    const r = copyToLevel(twoLevels, g2, [...box, 'room'], 'lvl_up', newId);
    const added = r.doc.walls.slice(twoLevels.walls.length);
    expect(added).toHaveLength(4);
    expect(added.every((w) => w.levelId === 'lvl_up')).toBe(true);
    expect(added.map((w) => [w.start, w.end])).toEqual(box.map((id) => [find(twoLevels, id).start, find(twoLevels, id).end]));
    expect(r.doc.walls.slice(0, twoLevels.walls.length)).toEqual(twoLevels.walls);
    // The door goes onto the copy of its wall; the room is numbered as the upper level's first.
    const door = r.doc.openings.at(-1)!;
    expect(door.wallId).toBe(added[0]!.id);
    const room = r.doc.rooms.at(-1)!;
    expect(room).toMatchObject({ levelId: 'lvl_up', number: '1', seed: { x: 2, y: 1.5 } });
    expect(deriveGeometry(r.doc).rooms.get(room.id)!.enclosed).toBe(true);
  });

  it('a door selected without its wall is left out (its wall is not on that level)', () => {
    const r = copyToLevel(twoLevels, g2, ['opening_d'], 'lvl_up', newId);
    expect(r.doc.openings).toHaveLength(twoLevels.openings.length);
  });
});

describe('copies in a series ("3x", "/3")', () => {
  it('3x a step of 5 m right: three boxes at 5, 10 and 15 m, the last one selected', () => {
    const r = copiesInSeries(doc, g, box, { x: 5, y: 0 }, 3, false, newId);
    expect(r.doc.walls).toHaveLength(doc.walls.length + 12);
    const bottoms = r.doc.walls.slice(doc.walls.length).filter((_, i) => i % 4 === 0);
    expect(bottoms.map((w) => w.start.x)).toEqual([5, 10, 15]);
    expect(r.selection).toEqual(r.doc.walls.slice(-4).map((w) => w.id));
    // Each copy takes its door and its room.
    expect(r.doc.openings).toHaveLength(4);
    expect(r.doc.rooms.map((x) => x.seed.x)).toEqual([2, 7, 12, 17]);
  });

  it('/2 the same step: two boxes, at 2.5 and 5 m', () => {
    const r = copiesInSeries(doc, g, box, { x: 5, y: 0 }, 2, true, newId);
    const bottoms = r.doc.walls.slice(doc.walls.length).filter((_, i) => i % 4 === 0);
    expect(bottoms.map((w) => w.start.x)).toEqual([2.5, 5]);
  });
});
