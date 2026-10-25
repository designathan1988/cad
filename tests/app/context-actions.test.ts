// What the right-click menu and the floating bar offer for what is selected: 4 to 6 actions, the
// ones that fit that kind of element (ref/chat.txt:206, 222).

import { describe, expect, it } from 'vitest';
import { contextIds } from '../../src/app/context-actions';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { newOpening } from '../../src/elements/opening/schema';

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

const doc: Doc = {
  ...newDocument(),
  walls: [wall('w', [0, 0], [6, 0]), wall('v', [6, 0], [6, 4])],
  openings: [
    newOpening('d', 'w', 'door', { kind: 'fromStart', distance: 1 }),
    newOpening('n', 'w', 'window', { kind: 'fromEnd', distance: 1 }),
    newOpening('m', 'v', 'window', { kind: 'centered' }),
  ],
  rooms: [{ id: 'r', levelId: 'lvl_ground', seed: { x: 3, y: 2 }, name: 'Room 1', number: '1' }],
  floors: [{ id: 'f', levelId: 'lvl_ground', source: { kind: 'outline', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] }, thickness: 0.1, offset: 0 }],
};

describe('actions for the selection', () => {
  it('a wall: move, flip, frame, properties, delete', () => {
    expect(contextIds(doc, ['w'])).toEqual(['move', 'flipWall', 'editType', 'frameSelection', 'properties', 'delete']);
  });

  it('a door: flip hinge, flip swing, frame, properties, delete', () => {
    expect(contextIds(doc, ['d'])).toEqual(['flipHinge', 'flipSwing', 'frameSelection', 'properties', 'delete']);
  });

  it('a window: centre on its wall, frame, properties, delete', () => {
    expect(contextIds(doc, ['n'])).toEqual(['centerOpening', 'frameSelection', 'properties', 'delete']);
  });

  it('a room without a floor offers one; with a floor, not', () => {
    expect(contextIds(doc, ['r'])).toEqual(['move', 'addFloor', 'frameSelection', 'properties', 'delete']);
    const floored = { ...doc, floors: [{ ...doc.floors[0]!, source: { kind: 'room' as const, roomId: 'r' } }] };
    expect(contextIds(floored, ['r'])).toEqual(['move', 'frameSelection', 'properties', 'delete']);
  });

  it('an outline floor: move, frame, properties, delete', () => {
    expect(contextIds(doc, ['f'])).toEqual(['move', 'frameSelection', 'properties', 'delete']);
  });

  it('several: distribute when they are openings of one wall, then frame, clear, delete', () => {
    expect(contextIds(doc, ['d', 'n'])).toEqual(['distribute', 'frameSelection', 'clearSelection', 'delete']);
    expect(contextIds(doc, ['d', 'm'])).toEqual(['frameSelection', 'clearSelection', 'delete']);
    expect(contextIds(doc, ['w', 'v'])).toEqual(['move', 'frameSelection', 'clearSelection', 'delete']);
  });

  it('nothing: draw a wall, frame all, commands', () => {
    expect(contextIds(doc, [])).toEqual(['drawWall', 'frameAll', 'commands']);
  });

  it('never more than 6', () => {
    for (const sel of [[], ['w'], ['d'], ['n'], ['r'], ['f'], ['d', 'n']]) expect(contextIds(doc, sel).length).toBeLessThanOrEqual(6);
  });
});

describe('guides in the menu', () => {
  const guide = { id: 'guide_1', levelId: 'lvl_ground', point: { x: 0, y: 1 }, dir: { x: 1, y: 0 } };
  const withGuide: Doc = { ...doc, guides: [guide] };

  it('with nothing selected, deleting the guides of the level shown is offered only when it has some', () => {
    expect(contextIds(withGuide, [], 'lvl_ground')).toEqual(['drawWall', 'frameAll', 'clearGuides', 'commands']);
    expect(contextIds(withGuide, [], 'other')).toEqual(['drawWall', 'frameAll', 'commands']);
    expect(contextIds(doc, [], 'lvl_ground')).toEqual(['drawWall', 'frameAll', 'commands']);
  });

  it('a guide selected: no zoom to it (it has no ends), its properties, the level\'s guides, delete', () => {
    expect(contextIds(withGuide, ['guide_1'], 'lvl_ground')).toEqual(['move', 'properties', 'clearGuides', 'delete']);
  });
});
