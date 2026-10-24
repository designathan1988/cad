import { describe, expect, it } from 'vitest';
import { elementIds, newDocument } from '../../src/app/document';
import { newOpening } from '../../src/elements/opening/schema';

describe('selectable elements', () => {
  it('walls, openings, rooms and floors all count, so editing a room keeps it selected', () => {
    const doc = {
      ...newDocument(),
      openings: [newOpening('o', 'w', 'door', { kind: 'centered' })],
      rooms: [{ id: 'r', levelId: 'lvl_ground', seed: { x: 0, y: 0 }, name: 'Room 1', number: '1' }],
      floors: [{ id: 'f', levelId: 'lvl_ground', source: { kind: 'room' as const, roomId: 'r' }, thickness: 0.1, offset: 0 }],
    };
    expect([...elementIds(doc)].sort()).toEqual(['f', 'o', 'r']);
  });
});

describe('wall numbers', () => {
  it('each wall is numbered on its level in the order drawn', async () => {
    const { wallNumber } = await import('../../src/app/document');
    const w = (id: string, levelId: string) => ({ id, wallTypeId: 'wt_concrete20', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, referenceLine: 'centerline' as const, levelId });
    const doc = { ...newDocument(), walls: [w('a', 'lvl_ground'), w('u', 'lvl_up'), w('b', 'lvl_ground')] };
    expect([wallNumber(doc, 'a'), wallNumber(doc, 'b'), wallNumber(doc, 'u'), wallNumber(doc, 'x')]).toEqual([1, 2, 1, null]);
  });
});
