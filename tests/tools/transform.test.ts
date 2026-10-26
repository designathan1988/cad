// Moving, turning, scaling and mirroring the selection, in place and copied, worked out by hand on a
// 4 × 3 box (b along the bottom from (0, 0) to (4, 0), then r, t, l round it), a wall x going on
// from the box's corner (4, 0) to (6, 0), a door on b 1 m from its start, and the room inside.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { newOpening } from '../../src/elements/opening/schema';
import { canTransform, reflection, rotation, scaling, transformSelection, translation } from '../../src/tools/transform';

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
});
const doc: Doc = {
  ...newDocument(),
  walls: [wall('b', [0, 0], [4, 0]), wall('r', [4, 0], [4, 3]), wall('t', [4, 3], [0, 3]), wall('l', [0, 3], [0, 0]), wall('x', [4, 0], [6, 0])],
  openings: [newOpening('opening_d', 'b', 'door', { kind: 'fromStart', distance: 1 }, { hinge: 'start', swing: 'left' })],
  rooms: [{ id: 'room', levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Room 1', number: '1' }],
  floors: [{ id: 'floor', levelId: 'lvl_ground', source: { kind: 'room', roomId: 'room' }, thickness: 0.15, offset: 0 }],
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
    expect(g.openings.get('opening_d')!.start).toBeCloseTo(1, 9);
    expect(deriveGeometry(r.doc).openings.get('opening_d')!.start).toBeCloseTo(2, 9);
    expect(find(r.doc, 'b')).toEqual(find(doc, 'b'));
    expect(r.selection).toEqual(['opening_d']);
  });

  it('moved onto the right wall: it goes onto r, opening to the side its middle landed on', () => {
    // Middle (1.45, 0) to (4.03, 1.5): on r (x = 4), a hair inside the box from its axis.
    const r = transformSelection(doc, g, ['opening_d'], translation({ x: 2.58, y: 1.5 }), false, newId);
    const d = r.doc.openings[0]!;
    expect(d.wallId).toBe('r');
    const placed = deriveGeometry(r.doc).openings.get('opening_d')!;
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
