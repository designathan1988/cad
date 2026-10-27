// The 3D view's levels: which are shown, how far each is lifted when exploded, where the cut is.
// Three levels: ground at 0, first at 2.8, second at 5.6 (each 2.8 high, the plan cut at 1.2).

import { describe, expect, it } from 'vitest';
import type { Level } from '../../src/app/document';
import { cutAt, EXPLODE_GAP, liftOf, readView3D, shownLevels, VIEW_3D_DEFAULT } from '../../src/app/view-3d';

const levels: Level[] = [
  { id: 'second', name: 'Second', elevation: 5.6, height: 2.8 },
  { id: 'ground', name: 'Ground', elevation: 0, height: 2.8 },
  { id: 'first', name: 'First', elevation: 2.8, height: 2.8, cutHeight: 1.5 },
];

describe('levels shown in 3D', () => {
  it('all, the current one and those below it, or the current one only', () => {
    expect([...shownLevels(levels, 'first', 'all')].sort()).toEqual(['first', 'ground', 'second']);
    expect([...shownLevels(levels, 'first', 'below')].sort()).toEqual(['first', 'ground']);
    expect([...shownLevels(levels, 'first', 'current')]).toEqual(['first']);
    // A level that is gone shows them all rather than nothing.
    expect(shownLevels(levels, 'gone', 'current').size).toBe(3);
  });
});

describe('exploded', () => {
  it('each level lifted by the gap once for every level below it, in the order of their elevations', () => {
    expect(liftOf(levels, 'ground', true)).toBe(0);
    expect(liftOf(levels, 'first', true)).toBe(EXPLODE_GAP);
    expect(liftOf(levels, 'second', true)).toBe(2 * EXPLODE_GAP);
    expect(liftOf(levels, 'second', false)).toBe(0);
  });
});

describe('cut', () => {
  it("at the current level's own cut height, lifted with it", () => {
    expect(cutAt(levels, 'ground', { ...VIEW_3D_DEFAULT, cut: true })).toBeCloseTo(1.2, 12);
    expect(cutAt(levels, 'first', { ...VIEW_3D_DEFAULT, cut: true })).toBeCloseTo(4.3, 12);
    expect(cutAt(levels, 'first', { levels: 'all', explode: true, cut: true, xray: false, box: null, ortho: false, section: null, style: 'shaded', quality: 'medium' })).toBeCloseTo(4.3 + EXPLODE_GAP, 12);
    expect(cutAt(levels, 'first', VIEW_3D_DEFAULT)).toBeNull();
  });
});

describe('stored', () => {
  it('read back, anything else taken as the default', () => {
    expect(readView3D({ levels: 'below', explode: true, cut: false })).toEqual({ levels: 'below', explode: true, cut: false, xray: false, box: null, ortho: false, section: null, style: 'shaded', quality: 'medium' });
    expect(readView3D({ xray: true }).xray).toBe(true);
    // The visual style and the quality: one of theirs, else the default.
    expect(readView3D({ style: 'realistic', quality: 'ultra' })).toMatchObject({ style: 'realistic', quality: 'ultra' });
    expect(readView3D({ style: 'cartoon', quality: 9 })).toMatchObject({ style: 'shaded', quality: 'medium' });
    expect(readView3D({ xray: 'yes' }).xray).toBe(false);
    expect(readView3D({ levels: 'sideways', explode: 'yes' })).toEqual(VIEW_3D_DEFAULT);
    expect(readView3D(undefined)).toEqual(VIEW_3D_DEFAULT);
  });
});
