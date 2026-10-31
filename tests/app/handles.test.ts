// Standard handles (ref/chat.txt:219): a square on each end of a selected wall moves that end; an
// arrow beyond each end of a straight wall stretches it along its line; an arc under the selection
// turns it. Each answers within a reach larger than its drawing.

import { describe, expect, it } from 'vitest';
import { doorFlips, handleAt, handlesFor } from '../../src/session/handles';
import type { DocWall } from '../../src/project/doc';
import type { WallId } from '../../src/elements/wall/schema';
import { lid, tid, wid } from '../ids';

const wall = (id: WallId, a: [number, number], b: [number, number], bulge = 0): DocWall => ({
  id,
  wallTypeId: tid('wt_concrete20'),
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  ...(bulge ? { bulge } : {}),
  referenceLine: 'centerline',
  levelId: lid('lvl_ground'),
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

// 100 px per metre, y down on screen, origin at (0, 500).
const toScreen = (p: { x: number; y: number }) => ({ x: p.x * 100, y: 500 - p.y * 100 });

describe('handles', () => {
  it('one straight wall: squares on its ends, arrows 20 px beyond them, the turn handle 28 px under the selection', () => {
    const h = handlesFor([wall(wid('w'), [1, 1], [4, 1])], toScreen);
    expect(h.squares.map((s) => s.at)).toEqual([{ x: 100, y: 400 }, { x: 400, y: 400 }]);
    expect(h.arrows.map((a) => [a.end, a.at])).toEqual([
      ['start', { x: 80, y: 400 }],
      ['end', { x: 420, y: 400 }],
    ]);
    expect(h.rotate).toEqual({ at: { x: 250, y: 428 }, pivot: { x: 2.5, y: 1 } });
  });

  it('an arc wall: squares, but no arrows (it has no single line to stretch along)', () => {
    const h = handlesFor([wall(wid('a'), [0, 0], [2, 0], 0.4)], toScreen);
    expect(h.squares).toHaveLength(2);
    expect(h.arrows).toEqual([]);
  });

  it("an arc wall: a curvature handle at the middle of the arc, and the turn handle under the arc's middle", () => {
    // Bulge 0.4 on a 2 m chord: sagitta 0.4, right of the chord, so the middle is (1, -0.4): (100, 540).
    const h = handlesFor([wall(wid('a'), [0, 0], [2, 0], 0.4)], toScreen);
    expect(h.bulge!.id).toBe('a');
    expect(h.bulge!.at.x).toBeCloseTo(100, 9);
    expect(h.bulge!.at.y).toBeCloseTo(540, 9);
    expect(h.rotate!.at.y).toBeCloseTo(540 + 28, 9);
    expect(handleAt(h, { x: 103, y: 538 }, 8)).toEqual({ kind: 'bulge', id: 'a' });
  });

  it('a major arc: the turn handle is centred under the whole arc, not under its chord', () => {
    // Bulge 2 on the chord (0, 0)-(2, 0): sweep 4·atan 2 = 253.7°, radius 1.25, centre (1, -0.75); the
    // arc spans x from -0.25 to 2.25 and goes down to y = -2: its middle x is 1, under y = -2: (100, 700).
    const h = handlesFor([wall(wid('a'), [0, 0], [2, 0], 2)], toScreen);
    // It runs counter-clockwise from 143.1° at (0, 0) to 36.8° at (2, 0) the long way, through 180°,
    // 270° and 360°, below the chord: the top of its circle (90°) is not on it. Extent in y: -2 to 0,
    // centre -1 (the ends alone gave 0); in x: -0.25 to 2.25, centre 1.
    expect(h.rotate!.pivot.x).toBeCloseTo(1, 6);
    expect(h.rotate!.pivot.y).toBeCloseTo(-1, 6);
    expect(h.rotate!.at.y).toBeCloseTo(700 + 28, 6);
  });

  it('a wall upright on screen: the turn handle goes under the arrow of its lower end, which stays reachable', () => {
    // From (1, 1) up to (1, 4): the start's arrow is 20 px under its end, at (100, 420); 28 px under the
    // wall, the turn handle fell on it (8 px away) and took its clicks.
    const h = handlesFor([wall(wid('w'), [1, 1], [1, 4])], toScreen);
    expect(h.arrows.find((a) => a.end === 'start')!.at).toEqual({ x: 100, y: 420 });
    expect(h.rotate!.at).toEqual({ x: 100, y: 448 });
    expect(handleAt(h, { x: 100, y: 422 }, 8)).toEqual({ kind: 'arrow', id: 'w', end: 'start' });
    expect(handleAt(h, { x: 100, y: 446 }, 8)).toEqual({ kind: 'rotate', pivot: { x: 1, y: 2.5 } });
  });

  it('a straight wall has no curvature handle', () => {
    expect(handlesFor([wall(wid('w'), [1, 1], [4, 1])], toScreen).bulge).toBeNull();
  });

  it('several walls: no end handles, only the turn handle, about the centre of them all', () => {
    const h = handlesFor([wall(wid('a'), [0, 0], [2, 0]), wall(wid('b'), [2, 0], [2, 2])], toScreen);
    expect(h.squares).toEqual([]);
    expect(h.arrows).toEqual([]);
    expect(h.rotate!.pivot).toEqual({ x: 1, y: 1 });
  });

  it('nothing selected: no handles', () => {
    expect(handlesFor([], toScreen)).toEqual({ squares: [], arrows: [], rotate: null, bulge: null, flips: [] });
  });

  it('which handle is under the pointer: within the reach, the turn handle first, then arrows, then squares', () => {
    const h = handlesFor([wall(wid('w'), [1, 1], [4, 1])], toScreen);
    expect(handleAt(h, { x: 252, y: 432 }, 8)).toEqual({ kind: 'rotate', pivot: { x: 2.5, y: 1 } });
    expect(handleAt(h, { x: 425, y: 402 }, 8)).toEqual({ kind: 'arrow', id: 'w', end: 'end' });
    expect(handleAt(h, { x: 103, y: 404 }, 8)).toEqual({ kind: 'square', id: 'w', end: 'start' });
    expect(handleAt(h, { x: 250, y: 300 }, 8)).toBeNull();
  });
});

describe('the turn handle and the temporary dimensions', () => {
  it('a value it would cover sends it just below the value; two stacked, below both', () => {
    // The handle of the 3 m wall above is at (250, 428), 13 px reach. A value 40 × 22 at (230, 420)
    // covers it: it goes to 442 + 13 + 2 = 457. A second value under that one, at (230, 450), sends it
    // to 472 + 15 = 487.
    const one = handlesFor([wall(wid('w'), [1, 1], [4, 1])], toScreen, [{ x: 230, y: 420, w: 40, h: 22 }]);
    expect(one.rotate!.at).toEqual({ x: 250, y: 457 });
    const two = handlesFor([wall(wid('w'), [1, 1], [4, 1])], toScreen, [
      { x: 230, y: 420, w: 40, h: 22 },
      { x: 230, y: 450, w: 40, h: 22 },
    ]);
    expect(two.rotate!.at).toEqual({ x: 250, y: 487 });
  });

  it('a value away from it leaves it where it was', () => {
    const h = handlesFor([wall(wid('w'), [1, 1], [4, 1])], toScreen, [{ x: 300, y: 300, w: 40, h: 22 }]);
    expect(h.rotate!.at).toEqual({ x: 250, y: 428 });
  });
});

describe("a door's flip controls", () => {
  // A door 0.9 m wide on the x axis from (1, 1) to (1.9, 1), faces at ±0.075 along +y, its leaf on +y:
  // at 100 px per metre, from (100, 400) to (190, 400), the face on screen at y = 392.5.
  const frame = { start: { x: 1, y: 1 }, end: { x: 1.9, y: 1 }, normal: { x: 0, y: 1 }, faces: [-0.075, 0.075] as const };

  it('on the side the leaf sweeps, 16 px out from the face: swing left of the middle, hinge right', () => {
    const [swing, hinge] = doorFlips('d', frame, 1, toScreen);
    expect(swing!.which).toBe('swing');
    expect(swing!.at.x).toBeCloseTo(145 - 12, 9);
    expect(swing!.at.y).toBeCloseTo(392.5 - 16, 9);
    expect(swing!.dir.y).toBeCloseTo(-1, 9);
    expect(hinge!.which).toBe('hinge');
    expect(hinge!.at.x).toBeCloseTo(145 + 12, 9);
    expect(hinge!.dir.x).toBeCloseTo(1, 9);
  });

  it('the leaf on the other side puts them there; a door under 36 px wide on screen has none', () => {
    const [swing] = doorFlips('d', frame, -1, toScreen);
    expect(swing!.at.y).toBeCloseTo(407.5 + 16, 9);
    expect(doorFlips('d', frame, 1, (p) => ({ x: p.x * 30, y: 500 - p.y * 30 }))).toEqual([]);
  });

  it('they answer before the other handles', () => {
    const flips = doorFlips('d', frame, 1, toScreen);
    const h = { squares: [], arrows: [], rotate: null, bulge: null, flips };
    expect(handleAt(h, { x: 134, y: 377 }, 8)).toEqual({ kind: 'flip', which: 'swing', id: 'd' });
    expect(handleAt(h, { x: 158, y: 376 }, 8)).toEqual({ kind: 'flip', which: 'hinge', id: 'd' });
  });
});
