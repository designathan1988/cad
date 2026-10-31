// The section box (section-box.ts): faces, moving one, the first box, the drag on screen. By hand.

import { describe, expect, it } from 'vitest';
import { boxAround, boxCaps, boxEdges, dragDistance, faceCenter, faceNormal, MIN_BOX, moveFace, readBox, readSection, type SectionBox, sectionCaps, sectionLooks } from '../../src/model/section-box';

const box: SectionBox = { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 2, z: 3 } };

describe('section box', () => {
  it('the middle and the outward direction of each face', () => {
    expect(faceCenter(box, 'x-')).toEqual({ x: 0, y: 1, z: 1.5 });
    expect(faceCenter(box, 'z+')).toEqual({ x: 2, y: 1, z: 3 });
    expect(faceNormal('y-')).toEqual({ x: 0, y: -1, z: 0 });
    expect(faceNormal('x+')).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('a face moved out or in, never past the other face', () => {
    expect(moveFace(box, 'x+', 1).max.x).toBe(5);
    expect(moveFace(box, 'x-', 1).min.x).toBe(-1);
    expect(moveFace(box, 'z+', -1).max.z).toBe(2);
    expect(moveFace(box, 'y-', -10).min.y).toBeCloseTo(2 - MIN_BOX, 12);
    expect(moveFace(box, 'y+', -10).max.y).toBeCloseTo(MIN_BOX, 12);
  });

  it('first shown around the model with a margin', () => {
    expect(boxAround({ min: { x: 1, y: 2 }, max: { x: 5, y: 6 } }, 0, 5.6)).toEqual({ min: { x: 0.5, y: 1.5, z: -0.5 }, max: { x: 5.5, y: 6.5, z: 6.1 } });
  });

  it('twelve edges, each along one axis', () => {
    const e = boxEdges(box);
    expect(e).toHaveLength(12);
    for (const [a, b] of e) expect([a.x !== b.x, a.y !== b.y, a.z !== b.z].filter(Boolean)).toHaveLength(1);
  });

  it('the drag: the pointer move along where the face goes on screen, in metres', () => {
    // The face moves 50 px right for 1 m out: 100 px right is 2 m, 30 px down is nothing.
    expect(dragDistance({ x: 100, y: 30 }, { x: 50, y: 0 })).toBe(2);
    expect(dragDistance({ x: -25, y: 0 }, { x: 50, y: 0 })).toBe(-0.5);
    // Seen end on (the face's axis toward the eye): no drag.
    expect(dragDistance({ x: 100, y: 0 }, { x: 0, y: 0 })).toBe(0);
  });

  it('read back, anything that is not a box is none', () => {
    expect(readBox(box)).toEqual(box);
    expect(readBox({ min: box.max, max: box.min })).toBeNull();
    expect(readBox({ min: { x: 0, y: 0 }, max: box.max })).toBeNull();
    expect(readBox(undefined)).toBeNull();
  });
});

describe('where the box goes through the walls', () => {
  // A wall 4 m along x, 20 cm thick, 2.8 m high.
  const wall = { polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 0.2 }, { x: 0, y: 0.2 }], bottom: 0, top: 2.8 };
  const big: SectionBox = { min: { x: -1, y: -1, z: -1 }, max: { x: 5, y: 5, z: 5 } };

  it('a box around it all goes through nothing', () => {
    expect(boxCaps([wall], big)).toEqual([]);
  });

  it('a side face across the wall: its section, 20 cm by its height', () => {
    const caps = boxCaps([wall], { ...big, max: { ...big.max, x: 1.5 } });
    expect(caps).toEqual([
      [
        { x: 1.5, y: 0, z: 0 },
        { x: 1.5, y: 0.2, z: 0 },
        { x: 1.5, y: 0.2, z: 2.8 },
        { x: 1.5, y: 0, z: 2.8 },
      ],
    ]);
  });

  it('the top face through the wall: its outline at that height, and the side section only up to it', () => {
    const caps = boxCaps([wall], { min: big.min, max: { x: 1.5, y: 5, z: 1.2 } });
    expect(caps).toContainEqual(wall.polygon.map((q) => ({ ...q, z: 1.2 })));
    expect(caps).toContainEqual([
      { x: 1.5, y: 0, z: 0 },
      { x: 1.5, y: 0.2, z: 0 },
      { x: 1.5, y: 0.2, z: 1.2 },
      { x: 1.5, y: 0, z: 1.2 },
    ]);
  });

  it('a face through an L: one stretch for each arm it crosses', () => {
    // An L: 3 × 1 along x, with an arm 1 × 3 up y at its left. The line y = 2 crosses the arm only.
    const L = { polygon: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 3 }, { x: 0, y: 3 }], bottom: 0, top: 0.1 };
    const y2 = boxCaps([L], { ...big, max: { ...big.max, y: 2 } });
    expect(y2.map((q) => [q[0]!.x, q[1]!.x])).toEqual([[0, 1]]);
    // A U: the line y = 2 crosses both of its arms.
    const U = { polygon: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 3 }, { x: 0, y: 3 }], bottom: 0, top: 0.1 };
    const u2 = boxCaps([U], { ...big, max: { ...big.max, y: 2 } });
    expect(u2.map((q) => [q[0]!.x, q[1]!.x])).toEqual([[0, 1], [2, 3]]);
  });
});

describe('a vertical section through a line', () => {
  const wall = { polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 0.2 }, { x: 0, y: 0.2 }], bottom: 0, top: 2.8 };

  it('looks to the left of its line', () => {
    expect(sectionLooks({ point: { x: 0, y: 0 }, dir: { x: 1, y: 0 } })).toEqual({ x: -0, y: 1 });
  });

  it('across the wall: its section, 20 cm by its height, at the line', () => {
    // The line x = 1.5 going up the plan: it crosses the wall from y = 0 to 0.2.
    const caps = sectionCaps([wall], { point: { x: 1.5, y: -5 }, dir: { x: 0, y: 1 } });
    expect(caps).toHaveLength(1);
    const got = caps[0]!.map((p) => [p.x, p.y, p.z].map((v) => Math.round(v * 1e9) / 1e9 + 0));
    expect(got).toEqual([
      [1.5, 0, 0],
      [1.5, 0.2, 0],
      [1.5, 0.2, 2.8],
      [1.5, 0, 2.8],
    ]);
  });

  it('a diagonal line through a wall: the stretch between its two faces', () => {
    // At 45° through the 20 cm wall: the stretch is 0.2·√2 long.
    const r = Math.SQRT1_2;
    const [cap] = sectionCaps([wall], { point: { x: 1, y: -1 }, dir: { x: r, y: r } });
    expect(Math.hypot(cap![1]!.x - cap![0]!.x, cap![1]!.y - cap![0]!.y)).toBeCloseTo(0.2 * Math.SQRT2, 12);
  });

  it('a line past the wall goes through nothing', () => {
    expect(sectionCaps([wall], { point: { x: 0, y: 1 }, dir: { x: 1, y: 0 } })).toEqual([]);
  });

  it('read back with its direction made unit; anything else is none', () => {
    expect(readSection({ point: { x: 1, y: 2 }, dir: { x: 0, y: 3 } })).toEqual({ point: { x: 1, y: 2 }, dir: { x: 0, y: 1 } });
    expect(readSection({ point: { x: 1, y: 2 }, dir: { x: 0, y: 0 } })).toBeNull();
    expect(readSection(null)).toBeNull();
  });
});
