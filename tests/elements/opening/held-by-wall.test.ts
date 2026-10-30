// A door or window placed or moved next to another is held by its wall, never measured from the other: so
// moving one never drags its neighbour, and two never end up measured from each other (one then vanished).

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../../src/project/doc';
import { hostsIn } from '../../../src/project/derive';
import { deriveOpenings } from '../../../src/elements/opening/derive';
import { detachedFrom, wallRule } from '../../../src/elements/opening/commands';
import { newOpening } from '../../../src/elements/opening/schema';

const wall: DocWall = { id: 'w', wallTypeId: 'wt_concrete20', start: { x: 0, y: 0 }, end: { x: 8, y: 0 }, referenceLine: 'centerline', levelId: 'lvl_ground', baseOffset: 0, top: { kind: 'level', offset: 0 } };
const door = newOpening('d', 'w', 'door', { kind: 'fromStart', distance: 2 });
const window = newOpening('k', 'w', 'window', { kind: 'fromOpening', openingId: 'd', distance: 1, toward: 'end' });
const doc: Doc = { ...newDocument(), walls: [wall], openings: [door, window] };
const at = (d: Doc, id: string) => deriveOpenings(d.openings, hostsIn(d), d.openingGroups).placed.get(id)!.start;

describe('held by its wall', () => {
  it('a rule from another opening becomes the distance from the nearer end, the opening where it was', () => {
    const r = wallRule(doc, window);
    expect(r.kind === 'fromStart' || r.kind === 'fromEnd').toBe(true);
    expect(at({ ...doc, openings: [door, { ...window, rule: r }] }, 'k')).toBeCloseTo(at(doc, 'k'), 9);
  });

  it('moving the door: the window measured from it is detached first and stays', () => {
    const before = at(doc, 'k');
    const openings = detachedFrom(doc, 'd').map((o) => (o.id === 'd' ? { ...o, rule: { kind: 'fromStart' as const, distance: 0.5 } } : o));
    const after = { ...doc, openings };
    expect(at(after, 'd')).toBeCloseTo(0.5, 9);
    expect(at(after, 'k')).toBeCloseTo(before, 9);
  });

  it('nothing measured from it: the same list', () => {
    expect(detachedFrom(doc, 'k')).toBe(doc.openings);
  });
});
