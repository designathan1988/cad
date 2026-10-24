// Where a room's name goes: the point inside it farthest from its edges, so it is centred in the
// room as the room is now, and inside it even when the room is an L.

import { describe, expect, it } from 'vitest';
import { labelPoint } from '../../../src/elements/room/derive';

const near = (p: { x: number; y: number }, x: number, y: number, tol = 0.01) => {
  expect(Math.abs(p.x - x)).toBeLessThanOrEqual(tol);
  expect(Math.abs(p.y - y)).toBeLessThanOrEqual(tol);
};

describe('labelPoint', () => {
  it('a 4 × 3 rectangle: its centre', () => {
    near(labelPoint([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }]), 2, 1.5);
  });

  it('the rectangle grown to 8 m wide: the centre moves with it', () => {
    near(labelPoint([{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 3 }, { x: 0, y: 3 }]), 4, 1.5);
  });

  it('an L (6 × 6 less its 4 × 4 upper right): inside the L, in the square where its 2 m arms meet', () => {
    // The centroid, (2.07, 2.07), is outside the L. The widest place is on the corner square's
    // diagonal, where the distance t to the outer edges equals the distance to the inner corner (2, 2),
    // √2·(2 − t): t = 2√2 / (1 + √2) = 1.1716.
    const p = labelPoint([{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 6 }, { x: 0, y: 6 }]);
    near(p, 1.1716, 1.1716, 0.02);
  });

  it('clockwise or counter-clockwise, the same point', () => {
    const ccw = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
    near(labelPoint([...ccw].reverse()), 2, 1.5);
  });
});
