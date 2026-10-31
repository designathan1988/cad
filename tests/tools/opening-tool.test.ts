// The opening tool's table, row by row, and the rule it picks under the cursor. A wall 5 m long, a
// door 0.90 wide, 1 cm per pixel: the centre snaps within 10 px = 0.10 m.

import { describe, expect, it } from 'vitest';
import { type Aim, OPENING_IDLE, openingTransition, ruleAt } from '../../src/elements/opening/tool';
import { oid, wid } from '../ids';

const aim = (station: number, others: Aim['others'] = [], side: Aim['side'] = 'left'): Aim => ({
  wallId: wid('w'),
  length: 5,
  station,
  side,
  others,
  mpp: 0.01,
});

describe('rule under the cursor', () => {
  it('near the start: the near jamb from the start, in 5 cm steps', () => {
    // Centre at 1.02: jamb at 0.57 → 0.55.
    expect(ruleAt(aim(1.02), 0.9)).toEqual({ kind: 'fromStart', distance: expect.closeTo(0.55, 12) });
  });

  it('near the end: the far jamb from the end', () => {
    // Centre at 4.0: jamb at 4.45, 0.55 from the end.
    expect(ruleAt(aim(4), 0.9)).toEqual({ kind: 'fromEnd', distance: expect.closeTo(0.55, 12) });
  });

  it('within 10 px of the middle: centred', () => {
    expect(ruleAt(aim(2.52), 0.9)).toEqual({ kind: 'centered' });
    expect(ruleAt(aim(2.41), 0.9)).toEqual({ kind: 'centered' });
    expect(ruleAt(aim(2.35), 0.9).kind).not.toBe('centered');
  });

  it('nearest to another opening: the gap from its jamb', () => {
    // Other [1.0, 1.9]; centre at 2.75 → jambs 2.3 and 3.2: gap 0.40, end 1.80, start 2.30.
    expect(ruleAt(aim(2.75, [{ id: oid('x'), start: 1, end: 1.9 }]), 0.9)).toEqual({ kind: 'fromOpening', openingId: oid('x'), distance: expect.closeTo(0.4, 12), toward: 'end' });
    // Other [3.5, 4.4]; centre at 1.0 → jambs 0.55 and 1.45: gap 2.05, start 0.55 → from the start.
    expect(ruleAt(aim(1, [{ id: oid('x'), start: 3.5, end: 4.4 }]), 0.9)).toEqual({ kind: 'fromStart', distance: expect.closeTo(0.55, 12) });
    // Other [3.5, 4.4]; centre at 2.9 → far jamb 3.35: gap 0.15 toward the start of x.
    expect(ruleAt(aim(2.9, [{ id: oid('x'), start: 3.5, end: 4.4 }]), 0.9)).toEqual({ kind: 'fromOpening', openingId: oid('x'), distance: expect.closeTo(0.15, 12), toward: 'start' });
  });
});

describe('rule under the cursor, over another opening', () => {
  it('a reference it would overlap loses to one it clears', () => {
    // Other [2.5, 3.7]; centre at 4.0 → jambs 3.55 and 4.45, overlapping it: the gap −0.15 from x is
    // nearest by size, but the wall end is 0.55 away and clear.
    expect(ruleAt(aim(4, [{ id: oid('x'), start: 2.5, end: 3.7 }]), 0.9)).toEqual({ kind: 'fromEnd', distance: expect.closeTo(0.55, 12) });
  });
});

describe('opening tool table', () => {
  it('idle + hover over a wall → aiming, with the rule under the cursor', () => {
    const r = openingTransition(OPENING_IDLE, { kind: 'hover', aim: aim(1.02) }, 0.9);
    expect(r.state.kind).toBe('aiming');
    if (r.state.kind === 'aiming') expect(r.state.rule).toEqual({ kind: 'fromStart', distance: expect.closeTo(0.55, 12) });
    expect(r.place).toBeUndefined();
  });

  it('aiming + hover off the walls → idle', () => {
    const a = openingTransition(OPENING_IDLE, { kind: 'hover', aim: aim(1) }, 0.9).state;
    expect(openingTransition(a, { kind: 'hover', aim: null }, 0.9).state).toEqual(OPENING_IDLE);
  });

  it('aiming + click places it with the rule and the side of the cursor; the tool stays', () => {
    const a = openingTransition(OPENING_IDLE, { kind: 'hover', aim: aim(4, [], 'right') }, 0.9).state;
    const r = openingTransition(a, { kind: 'click' }, 0.9);
    expect(r.place).toEqual({ wallId: wid('w'), rule: { kind: 'fromEnd', distance: expect.closeTo(0.55, 12) }, swing: 'right' });
    expect(r.state.kind).toBe('aiming');
  });

  it('idle + click is rejected: nothing to place', () => {
    const r = openingTransition(OPENING_IDLE, { kind: 'click' }, 0.9);
    expect(r.rejected).toBe(true);
    expect(r.place).toBeUndefined();
  });

  it('aiming + typed distance places it at that distance from the same reference', () => {
    const a = openingTransition(OPENING_IDLE, { kind: 'hover', aim: aim(4) }, 0.9).state;
    expect(openingTransition(a, { kind: 'typed', distance: 1.2 }, 0.9).place?.rule).toEqual({ kind: 'fromEnd', distance: 1.2 });
    const b = openingTransition(OPENING_IDLE, { kind: 'hover', aim: aim(2.75, [{ id: oid('x'), start: 1, end: 1.9 }]) }, 0.9).state;
    expect(openingTransition(b, { kind: 'typed', distance: 0.3 }, 0.9).place?.rule).toEqual({ kind: 'fromOpening', openingId: oid('x'), distance: 0.3, toward: 'end' });
  });

  it('typed while centred: from the nearer end of the cursor', () => {
    const a = openingTransition(OPENING_IDLE, { kind: 'hover', aim: aim(2.45) }, 0.9).state;
    expect(openingTransition(a, { kind: 'typed', distance: 1 }, 0.9).place?.rule).toEqual({ kind: 'fromStart', distance: 1 });
    const b = openingTransition(OPENING_IDLE, { kind: 'hover', aim: aim(2.55) }, 0.9).state;
    expect(openingTransition(b, { kind: 'typed', distance: 1 }, 0.9).place?.rule).toEqual({ kind: 'fromEnd', distance: 1 });
  });

  it('typed while idle or a negative distance is rejected', () => {
    expect(openingTransition(OPENING_IDLE, { kind: 'typed', distance: 1 }, 0.9).rejected).toBe(true);
    const a = openingTransition(OPENING_IDLE, { kind: 'hover', aim: aim(4) }, 0.9).state;
    expect(openingTransition(a, { kind: 'typed', distance: -1 }, 0.9).rejected).toBe(true);
  });

  it('escape → idle', () => {
    const a = openingTransition(OPENING_IDLE, { kind: 'hover', aim: aim(4) }, 0.9).state;
    expect(openingTransition(a, { kind: 'escape' }, 0.9).state).toEqual(OPENING_IDLE);
  });
});

describe('measured from the walls meeting this one', () => {
  // A partition's faces at 2.93 and 3.08 (15 cm, off the 5 cm grid on purpose).
  const stops = [2.93, 3.08];
  const at = (station: number): Aim => ({ ...aim(station), stops });

  it('between the start and a partition, nearer the partition: from its face, the gap in 5 cm steps', () => {
    // Centre at 2.21: end jamb at 2.66, 0.27 from the face at 2.93 → 0.25; stored from the wall's end.
    const r = ruleAt(at(2.21), 0.9);
    expect(r.kind).toBe('fromEnd');
    expect(r.kind === 'fromEnd' && r.distance).toBeCloseTo(5 - 2.93 + 0.25, 12);
  });

  it('past the partition: from its far face, not from the wall start', () => {
    // Centre at 3.6: start jamb at 3.15, 0.07 from the face at 3.08 → 0.05.
    const r = ruleAt(at(3.6), 0.9);
    expect(r.kind).toBe('fromStart');
    expect(r.kind === 'fromStart' && r.distance).toBeCloseTo(3.08 + 0.05, 12);
  });

  it('a typed distance is the gap to that face', () => {
    const s = { kind: 'aiming' as const, aim: at(3.6), rule: ruleAt(at(3.6), 0.9) };
    const r = openingTransition(s, { kind: 'typed', distance: 0.4 }, 0.9).place!.rule;
    expect(r.kind === 'fromStart' && r.distance).toBeCloseTo(3.08 + 0.4, 12);
  });
});
