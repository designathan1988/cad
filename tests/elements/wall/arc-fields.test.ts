// An arc's radius in the panel (the tester's review: radius, chord and length were read only): a
// number, at least half the chord, that keeps the ends.

import { describe, expect, it } from 'vitest';
import { type DocWall, newDocument } from '../../../src/app/document';
import { wallFields } from '../../../src/elements/wall/fields';
import { fieldStates } from '../../../src/ui/fields';

// A half circle on a 2 m chord: radius 1.
const arc: DocWall = { id: 'a', wallTypeId: 'wt_concrete20', start: { x: 0, y: 0 }, end: { x: 2, y: 0 }, bulge: 1, referenceLine: 'centerline', levelId: 'lvl_ground' };

describe('an arc in the panel', () => {
  it('its radius is a number, 1 m, with half the chord as its least value, and sets through updateRadius', () => {
    const asked: number[] = [];
    const act = { updateWalls: () => {}, resetToType: () => {}, editType: () => {}, updateRadius: (r: number) => asked.push(r) };
    const fields = wallFields({ ...newDocument(), walls: [arc] }, act).more;
    const radius = fieldStates(fields, [arc]).find((s) => s.field.id === 'radius')!;
    expect(radius.field.kind).toBe('number');
    expect(radius.value).toBeCloseTo(1, 12);
    const f = radius.field as Extract<typeof radius.field, { kind: 'number' }>;
    expect(typeof f.min === 'function' ? f.min([arc]) : f.min).toBe(1);
    f.set(2);
    expect(asked).toEqual([2]);
  });

  it('a straight wall has no radius field', () => {
    const straight = { ...arc, bulge: 0 };
    const act = { updateWalls: () => {}, resetToType: () => {}, editType: () => {}, updateRadius: () => {} };
    const fields = wallFields({ ...newDocument(), walls: [straight] }, act).more;
    expect(fieldStates(fields, [straight]).some((s) => s.field.id === 'radius')).toBe(false);
  });
});
