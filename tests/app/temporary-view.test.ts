// Hiding and isolating elements for a while (geometry.ts, applyTemporary): the views leave elements out,
// the document keeps them. A box of four walls with a door in the first, a room and its floor.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { applyTemporary, deriveGeometry } from '../../src/app/geometry';
import { newOpening } from '../../src/elements/opening/schema';

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_masonry15',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
});

const doc: Doc = {
  ...newDocument(),
  walls: [wall('a', [0, 0], [4, 0]), wall('b', [4, 0], [4, 3]), wall('c', [4, 3], [0, 3]), wall('d', [0, 3], [0, 0])],
  openings: [newOpening('o', 'a', 'door', { kind: 'centered' })],
  rooms: [{ id: 'r', levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Room 1', number: '1' }],
  floors: [{ id: 'f', levelId: 'lvl_ground', source: { kind: 'room', roomId: 'r' }, thickness: 0.1, offset: 0 }],
};
const g = deriveGeometry(doc);
const ids = (m: ReadonlyMap<string, unknown>) => [...m.keys()].sort();

describe('temporary hide and isolate', () => {
  it('nothing temporary: the geometry as it is', () => {
    expect(applyTemporary(g, null)).toBe(g);
  });

  it('a hidden wall goes with its door; the rest stays', () => {
    const t = applyTemporary(g, { mode: 'hide', ids: new Set(['a']) });
    expect(ids(t.solids)).toEqual(['b', 'c', 'd']);
    expect(ids(t.openings)).toEqual([]);
    expect(ids(t.rooms)).toEqual(['r']);
    expect(ids(t.floors)).toEqual(['f']);
  });

  it('a hidden door alone: its wall stays', () => {
    const t = applyTemporary(g, { mode: 'hide', ids: new Set(['o']) });
    expect(ids(t.solids)).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(t.openings)).toEqual([]);
  });

  it('an isolated wall stays with its door; nothing else', () => {
    const t = applyTemporary(g, { mode: 'isolate', ids: new Set(['a']) });
    expect(ids(t.solids)).toEqual(['a']);
    expect(ids(t.openings)).toEqual(['o']);
    expect(ids(t.rooms)).toEqual([]);
    expect(ids(t.floors)).toEqual([]);
  });

  it('an isolated room and floor: no walls', () => {
    const t = applyTemporary(g, { mode: 'isolate', ids: new Set(['r', 'f']) });
    expect(ids(t.solids)).toEqual([]);
    expect(ids(t.rooms)).toEqual(['r']);
    expect(ids(t.floors)).toEqual(['f']);
  });

  it('the walls are not redrawn: the rest of the house keeps its corners', () => {
    // Joins come from the document, not from what shows: wall b keeps the shape it had.
    const t = applyTemporary(g, { mode: 'hide', ids: new Set(['a']) });
    expect(t.solids.get('b')).toBe(g.solids.get('b'));
  });
});
