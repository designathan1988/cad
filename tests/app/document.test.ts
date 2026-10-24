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
