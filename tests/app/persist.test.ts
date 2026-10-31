// Loading a saved document: openings are validated, and documents saved before openings existed
// load with none.

import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/project/doc';
import { validateDocument } from '../../src/project/persist';
import { newOpening } from '../../src/elements/opening/schema';
import { wid } from '../ids';
import { oid } from '../ids';

const wall = {
  id: wid('wall_w'),
  wallTypeId: 'wt_concrete20',
  start: { x: 0, y: 0 },
  end: { x: 4, y: 0 },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
};

describe('validateDocument', () => {
  it('a document from before openings loads with none', () => {
    const old: Record<string, unknown> = { ...newDocument(), walls: [wall] };
    delete old.openings;
    expect(validateDocument(JSON.parse(JSON.stringify(old)))?.openings).toEqual([]);
  });

  it('valid openings load as saved', () => {
    // Typed ids (io/typed-ids.ts): ones without their kind's prefix are renamed on reading.
    const doc = { ...newDocument(), walls: [wall], openings: [newOpening(oid('opening_o'), wid('wall_w'), 'door', { kind: 'fromStart', distance: 0.5 })] };
    expect(validateDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it('an opening with a bad size, kind or rule is refused', () => {
    const good = newOpening(oid('opening_o'), wid('wall_w'), 'window', { kind: 'centered' });
    const bad = [
      { ...good, width: 0 },
      { ...good, height: -1 },
      { ...good, sill: Number.NaN },
      { ...good, kind: 'hatch' },
      { ...good, rule: { kind: 'fromStart' } },
      { ...good, rule: { kind: 'fromOpening', openingId: oid('x'), distance: 0.2, toward: 'up' } },
      { ...good, wallId: 3 },
    ];
    for (const o of bad) expect(validateDocument({ ...newDocument(), walls: [wall], openings: [o] })).toBeNull();
  });
});
