import { describe, expect, it } from 'vitest';
import { elementIds, newDocument, startLevel } from '../../src/project/doc';
import { newOpening } from '../../src/elements/opening/schema';
import { wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';
import { oid } from '../ids';

describe('selectable elements', () => {
  it('walls, openings, rooms and floors all count, so editing a room keeps it selected', () => {
    const doc = {
      ...newDocument(),
      openings: [newOpening(oid('o'), wid('w'), 'door', { kind: 'centered' })],
      rooms: [{ id: 'r', levelId: 'lvl_ground', seed: { x: 0, y: 0 }, name: 'Room 1', number: '1' }],
      floors: [{ id: 'f', levelId: 'lvl_ground', source: { kind: 'room' as const, roomId: 'r' }, thickness: 0.1, offset: 0 }],
    };
    expect([...elementIds(doc)].sort()).toEqual(['f', 'o', 'r']);
  });
});

describe('wall numbers', () => {
  it('each wall is numbered on its level in the order drawn', async () => {
    const { wallNumber } = await import('../../src/project/doc');
    const w = (id: WallId, levelId: string) => ({ id, wallTypeId: 'wt_concrete20', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, referenceLine: 'centerline' as const, levelId });
    const doc = { ...newDocument(), walls: [w(wid('a'), 'lvl_ground'), w(wid('u'), 'lvl_up'), w(wid('b'), 'lvl_ground')] };
    expect([wallNumber(doc, 'a'), wallNumber(doc, 'b'), wallNumber(doc, 'u'), wallNumber(doc, 'x')]).toEqual([1, 2, 1, null]);
  });
});

describe('the level shown at the start', () => {
  const two = {
    ...newDocument(),
    levels: [
      { id: 'up', name: 'Upper', elevation: 2.8, height: 2.8 },
      { id: 'lvl_ground', name: 'Ground floor', elevation: 0, height: 2.8 },
    ],
  };
  const onUp = { ...two, rooms: [{ id: 'r', levelId: 'up', seed: { x: 0, y: 0 }, name: 'Room 1', number: '1' }] };

  it('the one shown last, when it still exists', () => {
    expect(startLevel(onUp, 'lvl_ground')).toBe('lvl_ground');
  });
  it('otherwise the lowest level with something on it: never an empty one when another has content', () => {
    expect(startLevel(onUp)).toBe('up');
    expect(startLevel(onUp, 'gone')).toBe('up');
  });
  it('an empty project: its lowest level', () => {
    expect(startLevel(two)).toBe('lvl_ground');
  });
});
