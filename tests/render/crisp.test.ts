// A 1 px seam along a screen axis lands on pixel centres, so it is drawn at full strength (the tester
// measured 2.95:1 for one drawn between two pixels, where the colours give 3.1).

import { describe, expect, it } from 'vitest';
import { byLayers, crisp } from '../../src/render/plan-view';

describe('crisp', () => {
  it('a vertical line between pixels moves onto the centre of one', () => {
    expect(crisp({ x: 10, y: 0 }, { x: 10, y: 50 })).toEqual([{ x: 10.5, y: 0 }, { x: 10.5, y: 50 }]);
    expect(crisp({ x: 10.2, y: 0 }, { x: 10.3, y: 50 })).toEqual([{ x: 10.5, y: 0 }, { x: 10.5, y: 50 }]);
  });
  it('a horizontal one too', () => {
    expect(crisp({ x: 0, y: 7.9 }, { x: 40, y: 8 })).toEqual([{ x: 0, y: 7.5 }, { x: 40, y: 7.5 }]);
  });
  it('a slanted one is left as it is', () => {
    expect(crisp({ x: 0, y: 0 }, { x: 30, y: 20 })).toEqual([{ x: 0, y: 0 }, { x: 30, y: 20 }]);
  });
});

// The tester's H06: at the limit, Concrete 20 was by layer while Masonry and Drywall were grey.
describe('byLayers', () => {
  it('one decision for the whole view, from the thinnest wall shown', () => {
    // 0.10 and 0.20 m walls: at 50 px/m the thin one is 5 px, so none is by layer; at 60, all are.
    expect(byLayers([0.2, 0.1], 50)).toBe(false);
    expect(byLayers([0.2, 0.1], 60)).toBe(true);
  });
  it('no wall shown: nothing to decide, false', () => {
    expect(byLayers([], 100)).toBe(false);
  });
});
