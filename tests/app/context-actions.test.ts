// What the right-click menu and the floating bar offer for what is selected: 4 to 6 actions, the
// ones that fit that kind of element (ref/chat.txt:206, 222).

import { describe, expect, it } from 'vitest';
import { contextIds } from '../../src/session/context-actions';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { newOpening } from '../../src/elements/opening/schema';
import { fid, lid, oid, rid, wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';

const wall = (id: WallId, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: lid('lvl_ground'),
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

const doc: Doc = {
  ...newDocument(),
  walls: [wall(wid('w'), [0, 0], [6, 0]), wall(wid('v'), [6, 0], [6, 4])],
  openings: [
    newOpening(oid('d'), wid('w'), 'door', { kind: 'fromStart', distance: 1 }),
    newOpening(oid('n'), wid('w'), 'window', { kind: 'fromEnd', distance: 1 }),
    newOpening(oid('m'), wid('v'), 'window', { kind: 'centered' }),
  ],
  rooms: [{ id: rid('r'), levelId: lid('lvl_ground'), seed: { x: 3, y: 2 }, name: 'Room 1', number: '1' }],
  floors: [{ id: fid('f'), levelId: lid('lvl_ground'), source: { kind: 'outline', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] }, thickness: 0.1, offset: 0 }],
};

describe('actions for the selection', () => {
  it('a wall: move, flip, its type, select similar (framing one is F), properties, delete', () => {
    expect(contextIds(doc, ['w'])).toEqual(['move', 'flipWall', 'editType', 'selectSimilar', 'properties', 'delete']);
  });

  it('a door: move (the Modify tools take it alone), flip hinge, flip swing, select similar, properties, delete', () => {
    expect(contextIds(doc, ['d'])).toEqual(['move', 'toggleOpen', 'flipHinge', 'flipSwing', 'properties', 'delete']);
  });

  it('a window: move, centre on its wall, select similar, frame, properties, delete', () => {
    expect(contextIds(doc, ['n'])).toEqual(['move', 'toggleOpen', 'centerOpening', 'selectSimilar', 'properties', 'delete']);
  });

  it('a room without a floor offers one; with a floor, not', () => {
    expect(contextIds(doc, ['r'])).toEqual(['move', 'addFloor', 'addCeiling', 'properties', 'delete']);
    const floored = { ...doc, floors: [{ ...doc.floors[0]!, source: { kind: 'room' as const, roomId: rid('r') } }] };
    expect(contextIds(floored, ['r'])).toEqual(['move', 'addCeiling', 'properties', 'delete']);
  });

  it('an outline floor: move, select similar, frame, properties, delete', () => {
    expect(contextIds(doc, ['f'])).toEqual(['move', 'selectSimilar', 'frameSelection', 'properties', 'delete']);
  });

  it('several: distribute when they are openings of one wall, then frame, clear, delete', () => {
    expect(contextIds(doc, ['d', 'n'])).toEqual(['move', 'distribute', 'frameSelection', 'clearSelection', 'delete']);
    expect(contextIds(doc, ['d', 'm'])).toEqual(['move', 'frameSelection', 'clearSelection', 'delete']);
    expect(contextIds(doc, ['w', 'v'])).toEqual(['move', 'frameSelection', 'clearSelection', 'delete']);
  });

  it('nothing: draw a wall, add a text, frame all, commands', () => {
    expect(contextIds(doc, [])).toEqual(['drawWall', 'addNote', 'frameAll', 'commands']);
  });

  it('never more than 6', () => {
    for (const sel of [[], ['w'], ['d'], ['n'], ['r'], ['f'], ['d', 'n']]) expect(contextIds(doc, sel).length).toBeLessThanOrEqual(6);
  });
});

describe('guides in the menu', () => {
  const guide = { id: 'guide_1', levelId: lid('lvl_ground'), point: { x: 0, y: 1 }, dir: { x: 1, y: 0 } };
  const withGuide: Doc = { ...doc, guides: [guide] };

  it('with nothing selected, deleting the guides of the level shown is offered only when it has some', () => {
    expect(contextIds(withGuide, [], lid('lvl_ground'))).toEqual(['drawWall', 'addNote', 'frameAll', 'clearGuides']);
    expect(contextIds(withGuide, [], lid('other'))).toEqual(['drawWall', 'addNote', 'frameAll', 'commands']);
    expect(contextIds(doc, [], lid('lvl_ground'))).toEqual(['drawWall', 'addNote', 'frameAll', 'commands']);
  });

  it('a guide selected: no zoom to it (it has no ends), its properties, the level\'s guides, delete', () => {
    expect(contextIds(withGuide, ['guide_1'], lid('lvl_ground'))).toEqual(['move', 'section', 'properties', 'clearGuides', 'delete']);
  });
});
