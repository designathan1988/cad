// Opening commands: one undo step each, cascades, and rule changes that keep the opening in place.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../../src/project/doc';
import { createStore } from '../../../src/core/store';
import { addOpening, deleteElements, ruleKeepingPosition, updateOpening } from '../../../src/elements/opening/commands';
import { deriveOpenings, hostsOf } from '../../../src/elements/opening/derive';
import { newOpening } from '../../../src/elements/opening/schema';
import { addWalls } from '../../../src/elements/wall/commands';
import { wid } from '../../ids';
import type { WallId } from '../../../src/elements/wall/schema';

const wall = (id: WallId, x0: number, x1: number): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: x0, y: 0 },
  end: { x: x1, y: 0 },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

// w is 5 m: a door [0.5, 1.4], b window [2.0, 3.2] measured from a, d door [3.6, 4.5]. v is 3 m: c.
function setup() {
  const s = createStore<Doc>(newDocument());
  s.dispatch(addWalls([wall(wid('w'), 0, 5), wall(wid('v'), 0, 3)]));
  s.dispatch(addOpening(newOpening('a', wid('w'), 'door', { kind: 'fromStart', distance: 0.5 })));
  s.dispatch(addOpening(newOpening('b', wid('w'), 'window', { kind: 'fromOpening', openingId: 'a', distance: 0.6, toward: 'end' })));
  s.dispatch(addOpening(newOpening('c', wid('v'), 'window', { kind: 'centered' })));
  s.dispatch(addOpening(newOpening('d', wid('w'), 'door', { kind: 'fromEnd', distance: 0.5 })));
  return s;
}

const position = (doc: Doc, id: string) => {
  const d = deriveOpenings(doc.openings, hostsOf(doc)).placed.get(id)!;
  return [d.start, d.end];
};

describe('opening commands', () => {
  it('a new document has no openings; add and edit are one undo step each', () => {
    expect(newDocument().openings).toEqual([]);
    const s = setup();
    expect(s.get().openings).toHaveLength(4);
    s.dispatch(updateOpening('a', { width: 1 }));
    expect(s.get().openings.find((o) => o.id === 'a')!.width).toBe(1);
    s.undo();
    expect(s.get().openings.find((o) => o.id === 'a')!.width).toBe(0.9);
    s.undo();
    expect(s.get().openings).toHaveLength(3);
  });

  it('an edit that changes nothing is no undo step', () => {
    const s = setup();
    const before = s.get();
    s.dispatch(updateOpening('a', { width: 0.9 }));
    s.dispatch(updateOpening('zz', { width: 2 }));
    expect(s.get()).toBe(before);
  });

  it('hosts: the wall length and its height from the level', () => {
    const h = hostsOf(setup().get());
    expect(h.get(wid('w'))).toEqual({ length: 5, height: 2.8, line: { start: { x: 0, y: 0 }, end: { x: 5, y: 0 } } });
    expect(h.get(wid('v'))).toEqual({ length: 3, height: 2.8, line: { start: { x: 0, y: 0 }, end: { x: 3, y: 0 } } });
  });

  it('deleting a wall deletes the openings it hosts, in one step', () => {
    const s = setup();
    s.dispatch(deleteElements(['v']));
    expect(s.get().walls.map((w) => w.id)).toEqual(['w']);
    expect(s.get().openings.map((o) => o.id)).toEqual(['a', 'b', 'd']);
    s.undo();
    expect(s.get().openings).toHaveLength(4);
    expect(s.get().walls).toHaveLength(2);
  });

  it('deleting a referenced opening leaves the others where they were', () => {
    const s = setup();
    const [b0, b1] = position(s.get(), 'b');
    s.dispatch(deleteElements(['a']));
    expect(s.get().openings.map((o) => o.id)).toEqual(['b', 'c', 'd']);
    // b was [2.0, 3.2]; its rule now measures from the wall start.
    expect(s.get().openings.find((o) => o.id === 'b')!.rule).toEqual({ kind: 'fromStart', distance: expect.closeTo(2, 12) });
    const [n0, n1] = position(s.get(), 'b');
    expect(n0).toBeCloseTo(b0!, 12);
    expect(n1).toBeCloseTo(b1!, 12);
  });

  it('changing the rule kind keeps the position', () => {
    const doc = setup().get();
    expect(ruleKeepingPosition(doc, 'a', 'fromEnd')).toEqual({ kind: 'fromEnd', distance: expect.closeTo(3.6, 12) });
    expect(ruleKeepingPosition(doc, 'b', 'fromStart')).toEqual({ kind: 'fromStart', distance: expect.closeTo(2, 12) });
    expect(ruleKeepingPosition(doc, 'd', 'fromStart')).toEqual({ kind: 'fromStart', distance: expect.closeTo(3.6, 12) });
    // d [3.6, 4.5] from b [2.0, 3.2]: toward the end, 0.4 apart. a from d: toward the start, 2.2 apart.
    expect(ruleKeepingPosition(doc, 'd', 'fromOpening', 'b')).toEqual({ kind: 'fromOpening', openingId: 'b', distance: expect.closeTo(0.4, 12), toward: 'end' });
    expect(ruleKeepingPosition(doc, 'a', 'fromOpening', 'd')).toEqual({ kind: 'fromOpening', openingId: 'd', distance: expect.closeTo(2.2, 12), toward: 'start' });
  });

  it('no reference on another wall, to itself, or making a loop', () => {
    const doc = setup().get();
    expect(ruleKeepingPosition(doc, 'a', 'fromOpening', 'c')).toBeNull();
    expect(ruleKeepingPosition(doc, 'a', 'fromOpening', 'a')).toBeNull();
    // b already measures from a.
    expect(ruleKeepingPosition(doc, 'a', 'fromOpening', 'b')).toBeNull();
    expect(ruleKeepingPosition(doc, 'a', 'fromOpening')).toBeNull();
  });
});
