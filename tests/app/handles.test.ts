// Standard handles (ref/chat.txt:219): a square on each end of a selected wall moves that end; an
// arrow beyond each end of a straight wall stretches it along its line; an arc under the selection
// turns it. Each answers within a reach larger than its drawing.

import { describe, expect, it } from 'vitest';
import { handleAt, handlesFor } from '../../src/app/handles';
import type { DocWall } from '../../src/app/document';

const wall = (id: string, a: [number, number], b: [number, number], bulge = 0): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  ...(bulge ? { bulge } : {}),
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

// 100 px per metre, y down on screen, origin at (0, 500).
const toScreen = (p: { x: number; y: number }) => ({ x: p.x * 100, y: 500 - p.y * 100 });

describe('handles', () => {
  it('one straight wall: squares on its ends, arrows 20 px beyond them, the turn handle 28 px under the selection', () => {
    const h = handlesFor([wall('w', [1, 1], [4, 1])], toScreen);
    expect(h.squares.map((s) => s.at)).toEqual([{ x: 100, y: 400 }, { x: 400, y: 400 }]);
    expect(h.arrows.map((a) => [a.end, a.at])).toEqual([
      ['start', { x: 80, y: 400 }],
      ['end', { x: 420, y: 400 }],
    ]);
    expect(h.rotate).toEqual({ at: { x: 250, y: 428 }, pivot: { x: 2.5, y: 1 } });
  });

  it('an arc wall: squares, but no arrows (it has no single line to stretch along)', () => {
    const h = handlesFor([wall('a', [0, 0], [2, 0], 0.4)], toScreen);
    expect(h.squares).toHaveLength(2);
    expect(h.arrows).toEqual([]);
  });

  it("an arc wall: a curvature handle at the middle of the arc, and the turn handle under the arc's middle", () => {
    // Bulge 0.4 on a 2 m chord: sagitta 0.4, right of the chord, so the middle is (1, -0.4): (100, 540).
    const h = handlesFor([wall('a', [0, 0], [2, 0], 0.4)], toScreen);
    expect(h.bulge!.id).toBe('a');
    expect(h.bulge!.at.x).toBeCloseTo(100, 9);
    expect(h.bulge!.at.y).toBeCloseTo(540, 9);
    expect(h.rotate!.at.y).toBeCloseTo(540 + 28, 9);
    expect(handleAt(h, { x: 103, y: 538 }, 8)).toEqual({ kind: 'bulge', id: 'a' });
  });

  it('a major arc: the turn handle is centred under the whole arc, not under its chord', () => {
    // Bulge 2 on the chord (0, 0)-(2, 0): sweep 4·atan 2 = 253.7°, radius 1.25, centre (1, -0.75); the
    // arc spans x from -0.25 to 2.25 and goes down to y = -2: its middle x is 1, under y = -2: (100, 700).
    const h = handlesFor([wall('a', [0, 0], [2, 0], 2)], toScreen);
    // It runs counter-clockwise from 143.1° at (0, 0) to 36.8° at (2, 0) the long way, through 180°,
    // 270° and 360°, below the chord: the top of its circle (90°) is not on it. Extent in y: -2 to 0,
    // centre -1 (the ends alone gave 0); in x: -0.25 to 2.25, centre 1.
    expect(h.rotate!.pivot.x).toBeCloseTo(1, 6);
    expect(h.rotate!.pivot.y).toBeCloseTo(-1, 6);
    expect(h.rotate!.at.y).toBeCloseTo(700 + 28, 6);
  });

  it('a straight wall has no curvature handle', () => {
    expect(handlesFor([wall('w', [1, 1], [4, 1])], toScreen).bulge).toBeNull();
  });

  it('several walls: no end handles, only the turn handle, about the centre of them all', () => {
    const h = handlesFor([wall('a', [0, 0], [2, 0]), wall('b', [2, 0], [2, 2])], toScreen);
    expect(h.squares).toEqual([]);
    expect(h.arrows).toEqual([]);
    expect(h.rotate!.pivot).toEqual({ x: 1, y: 1 });
  });

  it('nothing selected: no handles', () => {
    expect(handlesFor([], toScreen)).toEqual({ squares: [], arrows: [], rotate: null, bulge: null });
  });

  it('which handle is under the pointer: within the reach, the turn handle first, then arrows, then squares', () => {
    const h = handlesFor([wall('w', [1, 1], [4, 1])], toScreen);
    expect(handleAt(h, { x: 252, y: 432 }, 8)).toEqual({ kind: 'rotate', pivot: { x: 2.5, y: 1 } });
    expect(handleAt(h, { x: 425, y: 402 }, 8)).toEqual({ kind: 'arrow', id: 'w', end: 'end' });
    expect(handleAt(h, { x: 103, y: 404 }, 8)).toEqual({ kind: 'square', id: 'w', end: 'start' });
    expect(handleAt(h, { x: 250, y: 300 }, 8)).toBeNull();
  });
});
