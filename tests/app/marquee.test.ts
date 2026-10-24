// Window and crossing selection over screen outlines: walls, openings, rooms and floors alike.

import { describe, expect, it } from 'vitest';
import { marqueePick } from '../../src/app/select-drag';
import { vec } from '../../src/core/vector';

const rect = (x0: number, y0: number, x1: number, y1: number) => [vec(x0, y0), vec(x1, y0), vec(x1, y1), vec(x0, y1)];

// A wall 0..600 px long, 20 px thick; three windows inside it; an L-shaped room below it.
const items = [
  { id: 'wall', outlines: [rect(0, 0, 600, 20)] },
  { id: 'w1', outlines: [rect(60, 0, 180, 20)] },
  { id: 'w2', outlines: [rect(240, 0, 360, 20)] },
  { id: 'w3', outlines: [rect(420, 0, 540, 20)] },
  { id: 'room', outlines: [[vec(0, 20), vec(600, 20), vec(600, 100), vec(300, 100), vec(300, 300), vec(0, 300)]] },
];

describe('marquee', () => {
  it('a window around the three windows, not the whole wall, takes the three windows only', () => {
    expect(marqueePick(items, vec(50, -10), vec(550, 30)).sort()).toEqual(['w1', 'w2', 'w3']);
  });

  it('a crossing touching only the middle window and the wall takes those two', () => {
    expect(marqueePick(items, vec(300, 15), vec(250, -5)).sort()).toEqual(['w2', 'wall']);
  });

  it('a crossing inside the notch of the L room, touching none of its edges, does not take it', () => {
    expect(marqueePick(items, vec(500, 250), vec(400, 150))).toEqual([]);
  });

  it('a crossing wholly inside the room takes it: the rectangle is inside the outline', () => {
    expect(marqueePick(items, vec(200, 250), vec(100, 150))).toEqual(['room']);
  });
});
