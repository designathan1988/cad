// Rule → position, by hand. A wall 5 m long and 2.8 m high unless said otherwise; stations are
// measured along the wall's reference line from its start, jamb to jamb.

import { describe, expect, it } from 'vitest';
import { deriveOpenings, type HostInfo } from '../../../src/elements/opening/derive';
import { newOpening, OPENING_DEFAULTS, type Opening, type PositionRule } from '../../../src/elements/opening/schema';
import { wid } from '../../ids';
import type { WallId } from '../../../src/elements/wall/schema';
import { oid } from '../../ids';
import type { OpeningId } from '../../../src/elements/opening/schema';

const hosts = (length = 5, height = 2.8): Map<WallId, HostInfo> => new Map([[wid('w'), { length, height }]]);
const door = (id: OpeningId, rule: PositionRule, wallId = wid('w')): Opening => newOpening(id, wallId, 'door', rule);
const win = (id: OpeningId, rule: PositionRule, wallId = wid('w')): Opening => newOpening(id, wallId, 'window', rule);

function at(openings: Opening[], id: OpeningId, h = hosts()) {
  const d = deriveOpenings(openings, h).placed.get(id)!;
  return { start: d.start, end: d.end, valid: d.valid, warnings: d.warnings };
}

describe('defaults', () => {
  it('door 0.90 × 2.10 on the floor, window 1.20 × 1.20 with a 1.00 sill', () => {
    expect(OPENING_DEFAULTS.door).toEqual({ width: 0.9, height: 2.1, sill: 0 });
    expect(OPENING_DEFAULTS.window).toEqual({ width: 1.2, height: 1.2, sill: 1 });
    const d = door(oid('a'), { kind: 'centered' });
    expect([d.width, d.height, d.sill]).toEqual([0.9, 2.1, 0]);
    const w = win(oid('b'), { kind: 'centered' });
    expect([w.width, w.height, w.sill]).toEqual([1.2, 1.2, 1]);
  });
});

describe('rule → position', () => {
  it('from the start: 0.50 to the near jamb → [0.50, 1.40]', () => {
    const r = at([door(oid('a'), { kind: 'fromStart', distance: 0.5 })], oid('a'));
    expect(r.start).toBeCloseTo(0.5, 12);
    expect(r.end).toBeCloseTo(1.4, 12);
    expect(r.valid).toBe(true);
  });

  it('from the end: 0.50 → [3.60, 4.50]', () => {
    const r = at([door(oid('a'), { kind: 'fromEnd', distance: 0.5 })], oid('a'));
    expect(r.start).toBeCloseTo(3.6, 12);
    expect(r.end).toBeCloseTo(4.5, 12);
  });

  it('centred: (5 − 0.9) / 2 = 2.05 → [2.05, 2.95]', () => {
    const r = at([door(oid('a'), { kind: 'centered' })], oid('a'));
    expect(r.start).toBeCloseTo(2.05, 12);
    expect(r.end).toBeCloseTo(2.95, 12);
  });

  it('from another opening, toward the end: 1.40 + 0.60 → window [2.00, 3.20]', () => {
    const list = [door(oid('a'), { kind: 'fromStart', distance: 0.5 }), win(oid('b'), { kind: 'fromOpening', openingId: oid('a'), distance: 0.6, toward: 'end' })];
    const r = at(list, oid('b'));
    expect(r.start).toBeCloseTo(2, 12);
    expect(r.end).toBeCloseTo(3.2, 12);
    expect(r.valid).toBe(true);
  });

  it('from another opening, toward the start: 3.60 − 0.30 → door [2.40, 3.30]', () => {
    const list = [door(oid('a'), { kind: 'fromEnd', distance: 0.5 }), door(oid('b'), { kind: 'fromOpening', openingId: oid('a'), distance: 0.3, toward: 'start' })];
    const r = at(list, oid('b'));
    expect(r.start).toBeCloseTo(2.4, 12);
    expect(r.end).toBeCloseTo(3.3, 12);
  });

  it('a chain of references resolves in any order of the list', () => {
    const list = [
      door(oid('c'), { kind: 'fromOpening', openingId: oid('b'), distance: 0.2, toward: 'end' }),
      door(oid('b'), { kind: 'fromOpening', openingId: oid('a'), distance: 0.2, toward: 'end' }),
      door(oid('a'), { kind: 'fromStart', distance: 0.1 }),
    ];
    // a [0.1, 1.0], b [1.2, 2.1], c [2.3, 3.2]
    expect(at(list, oid('c')).start).toBeCloseTo(2.3, 12);
    expect(at(list, oid('c')).end).toBeCloseTo(3.2, 12);
  });

  it('the wall made 6 m long: from start stays, from end follows the end, centred follows the middle', () => {
    const list = [
      door(oid('a'), { kind: 'fromStart', distance: 0.5 }),
      door(oid('b'), { kind: 'fromEnd', distance: 0.5 }),
      win(oid('c'), { kind: 'centered' }),
    ];
    const h = hosts(6);
    expect(at(list, oid('a'), h).start).toBeCloseTo(0.5, 12);
    expect(at(list, oid('b'), h).start).toBeCloseTo(4.6, 12);
    expect(at(list, oid('c'), h).start).toBeCloseTo(2.4, 12);
  });

  it('openings touching jamb to jamb are both valid', () => {
    const list = [door(oid('a'), { kind: 'fromStart', distance: 0.5 }), door(oid('b'), { kind: 'fromStart', distance: 1.4 })];
    expect(at(list, oid('a')).valid).toBe(true);
    expect(at(list, oid('b')).valid).toBe(true);
  });

  it('a door exactly at the wall start (distance 0) is valid', () => {
    expect(at([door(oid('a'), { kind: 'fromStart', distance: 0 })], oid('a')).valid).toBe(true);
  });
});

describe('invalid openings: warned, still placed', () => {
  it('past the wall end: [4.50, 5.40] on a 5 m wall', () => {
    const d = deriveOpenings([door(oid('a'), { kind: 'fromStart', distance: 4.5 })], hosts());
    const r = d.placed.get(oid('a'))!;
    expect(r.start).toBeCloseTo(4.5, 12);
    expect(r.end).toBeCloseTo(5.4, 12);
    expect(r.valid).toBe(false);
    expect(r.warnings).toEqual(['openingOutside']);
    expect(d.warnings).toEqual([{ kind: 'openingOutside', openings: ['a'] }]);
  });

  it('before the wall start: a negative distance', () => {
    expect(at([door(oid('a'), { kind: 'fromStart', distance: -0.1 })], oid('a')).warnings).toEqual(['openingOutside']);
  });

  it('wider than the wall, centred: [−0.25, 0.65] on a 0.40 m wall', () => {
    const r = at([door(oid('a'), { kind: 'centered' })], oid('a'), hosts(0.4));
    expect(r.start).toBeCloseTo(-0.25, 12);
    expect(r.warnings).toEqual(['openingOutside']);
  });

  it('two overlapping openings are both warned, once as a pair', () => {
    const list = [door(oid('a'), { kind: 'fromStart', distance: 0.5 }), door(oid('b'), { kind: 'fromStart', distance: 1.0 })];
    const d = deriveOpenings(list, hosts());
    expect(d.placed.get(oid('a'))!.warnings).toEqual(['openingOverlap']);
    expect(d.placed.get(oid('b'))!.warnings).toEqual(['openingOverlap']);
    expect(d.warnings).toEqual([{ kind: 'openingOverlap', openings: ['a', 'b'] }]);
  });

  it('openings on different walls never overlap', () => {
    const h = new Map([[wid('w'), { length: 5, height: 2.8 }], [wid('v'), { length: 5, height: 2.8 }]]);
    const list = [door(oid('a'), { kind: 'fromStart', distance: 0.5 }), door(oid('b'), { kind: 'fromStart', distance: 0.5 }, wid('v'))];
    expect(deriveOpenings(list, h).warnings).toEqual([]);
  });

  it('taller than the wall: window 1.00 + 1.20 = 2.20 > 2.00; a door of 2.10 in 2.80 or 2.10 is fine', () => {
    expect(at([win(oid('a'), { kind: 'centered' })], oid('a'), hosts(5, 2)).warnings).toEqual(['openingTooTall']);
    expect(at([door(oid('a'), { kind: 'centered' })], oid('a')).valid).toBe(true);
    expect(at([door(oid('a'), { kind: 'centered' })], oid('a'), hosts(5, 2.1)).valid).toBe(true);
  });

  it('a host that does not exist', () => {
    const r = at([door(oid('a'), { kind: 'centered' }, wid('gone'))], oid('a'));
    expect(r.valid).toBe(false);
    expect(r.warnings).toEqual(['openingNoHost']);
  });

  it('a reference that does not exist, is on another wall, or loops: warned and centred', () => {
    const h = new Map([[wid('w'), { length: 5, height: 2.8 }], [wid('v'), { length: 3, height: 2.8 }]]);
    const missing = at([door(oid('a'), { kind: 'fromOpening', openingId: oid('zz'), distance: 0.2, toward: 'end' })], oid('a'), h);
    expect(missing.warnings).toEqual(['openingBadReference']);
    expect(missing.start).toBeCloseTo(2.05, 12);
    const other = at([door(oid('o'), { kind: 'fromStart', distance: 0.2 }, wid('v')), door(oid('a'), { kind: 'fromOpening', openingId: oid('o'), distance: 0.2, toward: 'end' })], oid('a'), h);
    expect(other.warnings).toEqual(['openingBadReference']);
    const loop = [door(oid('a'), { kind: 'fromOpening', openingId: oid('b'), distance: 0.2, toward: 'end' }), door(oid('b'), { kind: 'fromOpening', openingId: oid('a'), distance: 0.2, toward: 'end' })];
    expect(at(loop, oid('a'), h).warnings).toContain('openingBadReference');
    expect(at(loop, oid('b'), h).warnings).toContain('openingBadReference');
  });
});
