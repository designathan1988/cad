// Door and window type marks (marks.ts): a type is a size, numbered from the smallest.

import { describe, expect, it } from 'vitest';
import { markPoint, openingMarks } from '../../../src/elements/opening/marks';
import type { OpeningFrame } from '../../../src/elements/opening/void';
import { newOpening } from '../../../src/elements/opening/schema';

const door = (id: string, width: number, height = 2.1) => newOpening(id, 'w', 'door', { kind: 'centered' }, { width, height });
const window = (id: string, width: number, sill = 1) => newOpening(id, 'w', 'window', { kind: 'centered' }, { width, height: 1.2, sill });
const prefix = { door: 'P', window: 'J' };

describe('door and window marks', () => {
  it('doors of one size share a mark; sizes numbered from the smallest, by width then height', () => {
    const marks = openingMarks([door('a', 0.9), door('b', 0.8), door('c', 0.9), door('d', 0.9, 2.2), door('e', 1.2)], prefix);
    expect(Object.fromEntries(marks)).toEqual({ a: 'P2', b: 'P1', c: 'P2', d: 'P3', e: 'P4' });
  });

  it('windows apart from doors, a different sill a different type', () => {
    const marks = openingMarks([door('a', 0.8), window('b', 1.2), window('c', 0.6, 1.6), window('d', 1.2, 1.1)], prefix);
    expect(Object.fromEntries(marks)).toEqual({ a: 'P1', b: 'J2', c: 'J1', d: 'J3' });
  });

  it('the same marks whatever the order the openings were drawn in', () => {
    const list = [door('a', 0.9), door('b', 0.8), window('c', 1.2)];
    expect(openingMarks([...list].reverse(), prefix)).toEqual(openingMarks(list, prefix));
  });

  it('a tag off the middle: a door on the side it does not open to, a window outside unless that side is a room', () => {
    // A wall along x, 15 cm, its exterior face at y = −0.075 (the normal points up, +y).
    const frame: OpeningFrame = { start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, dir: { x: 1, y: 0 }, normal: { x: 0, y: 1 }, faces: [-0.075, 0.075], region: [] };
    const at = (p: { x: number; y: number }) => [Number(p.x.toFixed(6)), Number(p.y.toFixed(6))];
    // Swinging left, the leaf opens up (+y): the tag below.
    expect(at(markPoint(frame, { ...door('a', 1), swing: 'left' }, 0.25))).toEqual([0.5, -0.325]);
    expect(at(markPoint(frame, { ...door('a', 1), swing: 'right' }, 0.25))).toEqual([0.5, 0.325]);
    expect(at(markPoint(frame, window('b', 1), 0.25))).toEqual([0.5, -0.325]);
    // The exterior face indoors (a room below, none above): the window's tag goes up, outside.
    expect(at(markPoint(frame, window('b', 1), 0.25, (p) => p.y < 0))).toEqual([0.5, 0.325]);
  });
});
