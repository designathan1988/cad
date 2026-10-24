// Keeping the selection in view (keep-in-view.ts): how far the plan moves so the selection's screen
// box, with its dimensions and handles, lies in the part of the view that nothing covers.

import { describe, expect, it } from 'vitest';
import { fitFactor, keepInView } from '../../src/app/keep-in-view';

const view = { w: 1000, h: 600 };
const none = { right: 0, bottom: 0 };
const room = { margin: 16, above: 48 };
const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });

describe('keepInView', () => {
  it('a box already inside the free part does not move', () => {
    expect(keepInView(box(100, 100, 300, 200), view, none, room)).toEqual({ dx: 0, dy: 0 });
  });
  it('a window that shrank: a box below the new bottom edge moves up, by just what it needs', () => {
    // 600 - 16 = 584 is the lowest the box may reach: 650 needs 66 px up.
    expect(keepInView(box(100, 500, 300, 650), view, none, room)).toEqual({ dx: 0, dy: -66 });
  });
  it('with nothing covering the view, a box past the right edge still moves left', () => {
    expect(keepInView(box(950, 100, 1100, 200), view, none, room)).toEqual({ dx: -116, dy: 0 });
  });
  it('the panel over the right and a sheet over the bottom shrink the free part', () => {
    expect(keepInView(box(600, 300, 700, 400), view, { right: 400, bottom: 250 }, room)).toEqual({ dx: -116, dy: -66 });
  });
  it('the browser drawer on the left: a box behind it moves right', () => {
    expect(keepInView(box(100, 100, 200, 200), view, { right: 0, bottom: 0, left: 260 }, room)).toEqual({ dx: 176, dy: 0 });
  });
  it('room above for the floating bar: a box near the top moves down', () => {
    // The top may be no higher than 16 + 48 = 64.
    expect(keepInView(box(100, 20, 200, 120), view, none, room)).toEqual({ dx: 0, dy: 44 });
  });
  it('a box larger than the free part keeps its top left corner in view', () => {
    expect(keepInView(box(-50, -80, 1500, 900), view, none, room)).toEqual({ dx: 66, dy: 144 });
  });
});

// The tester's P07: on a phone the free part was about 323 × 325 px and the arc did not fit; the view
// only panned. A box larger than the free part is zoomed out to fit first.
describe('fitFactor', () => {
  it('a box that fits: 1, no zoom', () => {
    expect(fitFactor(box(100, 100, 300, 200), view, none, room)).toBe(1);
  });
  it('a box twice as tall as the free part: zoomed out to fit it, with 5 % to spare', () => {
    // Free height 600 − 16 − 16 − 48 = 520; the box is 1040 tall: 520 / 1040 × 0.95.
    expect(fitFactor(box(100, 0, 200, 1040), view, none, room)).toBeCloseTo(0.475, 12);
  });
  it('the narrower way decides: free width 1000 − 400 − 32 = 568 for a 1136 wide box', () => {
    expect(fitFactor(box(0, 100, 1136, 200), view, { right: 400, bottom: 0 }, room)).toBeCloseTo(0.475, 12);
  });
});
