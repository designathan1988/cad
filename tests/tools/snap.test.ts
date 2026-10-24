// Snaps, by hand. 1 mm per pixel, so the 10 px radius is 1 cm.

import { describe, expect, it } from 'vitest';
import { snap, type SnapInput } from '../../src/tools/snap';
import { vec } from '../../src/core/vector';

const input = (cursor: [number, number], extra: Partial<SnapInput> = {}): SnapInput => ({
  cursor: vec(cursor[0], cursor[1]),
  mpp: 0.001,
  segments: [{ start: vec(0, 0), end: vec(6, 0) }],
  from: null,
  chainStart: null,
  enabled: true,
  orthogonal: false,
  ...extra,
});

describe('snaps', () => {
  it('on the body of a straight wall, away from its ends and middle: on the wall, at the foot of the cursor', () => {
    const s = snap(input([1.5, 0.004]));
    expect(s.kind).toBe('onWall');
    expect(s.point.x).toBeCloseTo(1.5, 12);
    expect(s.point.y).toBeCloseTo(0, 12);
  });

  it('ends and middle still win over the wall body', () => {
    expect(snap(input([0.005, 0.003])).kind).toBe('endpoint');
    expect(snap(input([3.004, 0.002])).kind).toBe('midpoint');
  });

  it('aligned with an end, off any wall: the point moves onto the line through that end', () => {
    const s = snap(input([6.004, 2]));
    expect(s.kind).toBe('aligned');
    expect(s.point).toEqual(vec(6, 2));
  });

  it('on a 15° direction from the last point, alignment slides along that direction instead of leaving it', () => {
    // From (0, 3) at −45° (down and to the right); the end (6, 0) is in line vertically near x = 6.
    const from = vec(0, 3);
    // 2 mm per pixel here: the 5 cm length grid leaves the angle point 1 cm off x = 6.
    const s = snap(input([6.003, -3.003], { mpp: 0.002, from, segments: [{ start: vec(0, 0), end: vec(6, 0) }, { start: vec(-5, 3), end: vec(0, 3) }] }));
    expect(s.kind).toBe('aligned');
    expect(s.point.x).toBeCloseTo(6, 12);
    // Still on the −45° line from (0, 3).
    expect(s.point.y).toBeCloseTo(3 - 6, 12);
  });
});

describe('which wall a snap is on', () => {
  const two = [
    { id: 'a', start: vec(0, 0), end: vec(6, 0) },
    { id: 'b', start: vec(0, 3), end: vec(6, 3) },
  ];
  it('end, middle, body and alignment name the wall they come from', () => {
    expect(snap(input([6.004, 3.002], { segments: two })).wallId).toBe('b');
    expect(snap(input([3.002, 0.004], { segments: two })).wallId).toBe('a');
    expect(snap(input([1.5, 2.996], { segments: two })).wallId).toBe('b');
    const s = snap(input([6.004, 1.5], { segments: two }));
    expect([s.kind, s.wallId]).toEqual(['aligned', 'a']);
  });
});
