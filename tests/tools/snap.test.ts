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

  it("a thick wall's end is taken from its outer corner too: within its reach (half its thickness) plus the radius", () => {
    // 25 cm wall: its outer corner at (6.125, 0.125) is 17.7 cm from the end, the click 6 mm past it.
    const thick = { segments: [{ start: vec(0, 0), end: vec(6, 0), reach: 0.125 }] };
    expect(snap(input([6.13, 0.128], thick))).toMatchObject({ kind: 'endpoint', point: { x: 6, y: 0 } });
    // Without the reach the same click is no end.
    expect(snap(input([6.13, 0.128])).kind).not.toBe('endpoint');
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

  it('the origin, where the drawn axes cross, catches a click a few pixels off it, on an empty plan', () => {
    const empty = { segments: [] };
    expect(snap(input([0.006, -0.004], empty))).toMatchObject({ kind: 'origin', point: { x: 0, y: 0 } });
    // Farther than the radius: only the grid.
    expect(snap(input([0.03, 0.02], empty)).kind).toBe('grid');
  });

  it('near an axis, away from the origin and any wall end: on the axis, with a guide from the origin', () => {
    const s = snap(input([0.007, 3.2], { segments: [] }));
    expect(s.kind).toBe('axis');
    expect(s.point.x).toBe(0);
    expect(s.point.y).toBeCloseTo(3.2, 12);
    expect(s.guideFrom).toEqual({ x: 0, y: 0 });
    // A wall end aligned the same way wins over the axis.
    const wall = { segments: [{ start: vec(0.008, 5), end: vec(4, 5) }] };
    expect(snap(input([0.004, 3.2], wall)).kind).toBe('aligned');
  });

  it('ending a partition on a wall along a snapped angle: where that direction meets the wall, so it stays square', () => {
    // From (2.03, -3) toward the wall y = 0, the cursor 0.4° off vertical and 4 mm from the wall.
    const s = snap(input([2.051, -0.004], { from: vec(2.03, -3) }));
    expect(s.kind).toBe('onWall');
    expect(s.point.x).toBeCloseTo(2.03, 12);
    expect(s.point.y).toBeCloseTo(0, 12);
  });

  it('starting on a wall: the distance along it on the 5 cm grid', () => {
    const s = snap(input([4.0612, 0.004]));
    expect(s.kind).toBe('onWall');
    expect(s.point.x).toBeCloseTo(4.05, 12);
  });

  it("on a thick wall's drawn body, off its axis by more than the radius: still on that wall", () => {
    // 15 cm wall: the cursor 6 cm from the axis, inside the body, 5 cm beyond the 1 cm radius.
    const thick = { segments: [{ start: vec(0, 0), end: vec(6, 0), reach: 0.075 }] };
    const s = snap(input([2.5, 0.06], thick));
    expect(s.kind).toBe('onWall');
    expect(s.point.y).toBeCloseTo(0, 12);
    // Past the body and the radius: not on it.
    expect(snap(input([2.5, 0.09], thick)).kind).not.toBe('onWall');
  });

  it("a wall face's edge (the measure tool): its ends are corners, its points on the face", () => {
    const face = { segments: [{ start: vec(0, 0.1), end: vec(6, 0.1), face: true }] };
    expect(snap(input([6.004, 0.103], face))).toMatchObject({ kind: 'corner', point: { x: 6, y: 0.1 } });
    expect(snap(input([2.5, 0.104], face))).toMatchObject({ kind: 'onFace' });
    // Its middle is no snap: a face's edge is a piece of a wall's body.
    expect(snap(input([3.004, 0.103], face)).kind).toBe('onFace');
  });
});

describe('snaps on guides', () => {
  // A guide 1.2 m above the wall, along it; another across it at x = 2.
  const along = { point: vec(0, 1.2), dir: vec(1, 0) };
  const across = { point: vec(2, -5), dir: vec(0, 1) };

  it('near a guide: on it, its distance along it on the 5 cm grid', () => {
    expect(snap(input([2.003, 1.205], { guides: [along] }))).toMatchObject({ kind: 'onGuide', point: { x: 2, y: 1.2 } });
  });

  it("where a guide crosses a wall's line, or another guide: that point, before the wall's body", () => {
    expect(snap(input([2.004, 0.003], { guides: [across] }))).toMatchObject({ kind: 'guideCross', point: { x: 2, y: 0 } });
    expect(snap(input([2.006, 1.204], { guides: [along, across] }))).toMatchObject({ kind: 'guideCross', point: { x: 2, y: 1.2 } });
  });

  it('drawing on a snapped angle, the point is where that direction meets the guide: a partition stops on it square', () => {
    const s = snap(input([1.002, 1.204], { guides: [along], from: vec(1, -2) }));
    expect(s.kind).toBe('onGuide');
    expect(s.point.x).toBeCloseTo(1, 12);
    expect(s.point.y).toBeCloseTo(1.2, 12);
  });

  it('with Shift, straight up from the last point, it stops on a guide crossed near the cursor', () => {
    const s = snap(input([1.3, 1.205], { guides: [along], from: vec(1, -2), orthogonal: true }));
    expect(s.kind).toBe('onGuide');
    expect(s.point.x).toBeCloseTo(1, 12);
    expect(s.point.y).toBeCloseTo(1.2, 12);
    // Farther than the radius from it: the right angle alone.
    expect(snap(input([1.3, 1.3], { guides: [along], from: vec(1, -2), orthogonal: true })).kind).toBe('angle');
  });
});

describe('snaps on an arc wall', () => {
  // A half circle from (0, 0) to (4, 0), bulge 1: centre (2, 0), radius 2, through (2, −2) below the chord.
  const arc = { segments: [{ start: vec(0, 0), end: vec(4, 0), bulge: 1 }] };

  it('its middle is on the arc, (2, −2), not on the chord', () => {
    expect(snap(input([2.004, -1.996], arc))).toMatchObject({ kind: 'midpoint', point: { x: 2, y: -2 } });
    // The chord's middle is nothing on this wall now.
    expect(snap(input([2.003, 0.002], arc)).kind).not.toBe('midpoint');
  });

  it('on its body: the foot on the arc, 2 m from the centre', () => {
    const s = snap(input([3.004, -1.733], arc));
    expect(s.kind).toBe('onWall');
    expect(Math.hypot(s.point.x - 2, s.point.y)).toBeCloseTo(2, 9);
  });

  it('off its sweep (the other half of the circle), nothing on it', () => {
    expect(snap(input([2.002, 2.001], arc)).kind).not.toBe('onWall');
  });

  it('drawing straight down from (3, 1), the point is where that direction cuts the arc: (3, −√3)', () => {
    const s = snap(input([3.004, -1.74], { ...arc, from: vec(3, 1) }));
    expect(s.kind).toBe('onWall');
    expect(s.point.x).toBeCloseTo(3, 9);
    expect(s.point.y).toBeCloseTo(-Math.sqrt(3), 9);
  });
});

describe('smart snaps', () => {
  it('intersection: where two walls would meet if they went on, (4, 0), before either reaches it', () => {
    const s = snap(input([4.004, 0.003], { segments: [{ start: vec(0, 0), end: vec(2, 0) }, { start: vec(4, 1), end: vec(4, 3) }] }));
    expect(s.kind).toBe('intersection');
    expect(s.point.x).toBeCloseTo(4, 12);
    expect(s.point.y).toBeCloseTo(0, 12);
  });

  it('perpendicular: from (1, 3) down to the wall, the foot (1, 0)', () => {
    const s = snap(input([1.004, 0.004], { from: vec(1, 3) }));
    expect(s.kind).toBe('perpendicular');
    expect(s.point).toEqual(vec(1, 0));
  });

  it('extension: 2 m past the wall end on its line, with the dashed line from that end', () => {
    const short = { segments: [{ start: vec(0, 0), end: vec(4, 0) }] };
    expect(snap(input([6.002, 0.004], short))).toMatchObject({ kind: 'extension', point: { x: 6, y: 0 }, guideFrom: { x: 4, y: 0 } });
  });

  it('parallel: drawing from (0, 3) along a wall at 14°, the direction is the wall’s exactly', () => {
    const wall = { start: vec(0, 0), end: vec(4, 1) };
    const s = snap(input([3, 3.75], { segments: [wall], from: vec(0, 3), mpp: 0.002 }));
    expect(s.kind).toBe('parallel');
    const d = Math.atan2(s.point.y - 3, s.point.x);
    expect(d).toBeCloseTo(Math.atan2(1, 4), 9);
  });
});
