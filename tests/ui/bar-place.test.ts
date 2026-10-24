// Where the floating bar goes vertically: just above the selection, moved only past the boxes it
// would actually cover (in its own columns), repeated until free; below the selection when there
// is no room above.

import { describe, expect, it } from 'vitest';
import { placeBarY } from '../../src/ui/bar-place';

const bar = { left: 100, w: 120, h: 36 };
const view = { h: 800 };

describe('floating bar placement', () => {
  it('nothing in the way: 10 px above the selection', () => {
    expect(placeBarY(bar, { top: 500, bottom: 520 }, [], view)).toBe(500 - 10 - 36);
  });

  it('a dimension right above: just above that dimension, not above every label in the view', () => {
    const dim = { left: 140, right: 190, top: 470, bottom: 488 };
    const farLabel = { left: 600, right: 700, top: 100, bottom: 130 };
    expect(placeBarY(bar, { top: 500, bottom: 520 }, [dim, farLabel], view)).toBe(470 - 8 - 36);
  });

  it('stacked: a dimension, then a room tag just above it in the same columns: above both', () => {
    const dim = { left: 140, right: 190, top: 470, bottom: 488 };
    const tag = { left: 90, right: 160, top: 400, bottom: 432 };
    expect(placeBarY(bar, { top: 500, bottom: 520 }, [dim, tag], view)).toBe(400 - 8 - 36);
  });

  it('no room above (near the top): below the selection, past what is there', () => {
    const dimBelow = { left: 150, right: 200, top: 540, bottom: 556 };
    expect(placeBarY(bar, { top: 20, bottom: 520 }, [dimBelow], view)).toBe(556 + 8);
    expect(placeBarY(bar, { top: 20, bottom: 520 }, [], view)).toBe(520 + 10);
  });

  // The tester's R04 and T04: on a phone after F the selection fills the view; with no room above or
  // below, the bar was clamped to the bottom edge, onto the handle at the arc's end.
  it('no room above or below: the nearest free place, never on a box in its columns', () => {
    const handleTop = { left: 140, right: 164, top: 6, bottom: 30 };
    const handleBottom = { left: 140, right: 164, top: 770, bottom: 794 };
    const y = placeBarY(bar, { top: 10, bottom: 790 }, [handleTop, handleBottom], view);
    const meets = (b: { top: number; bottom: number }) => b.top < y + bar.h && y < b.bottom;
    expect(meets(handleTop) || meets(handleBottom)).toBe(false);
    expect(y).toBeGreaterThanOrEqual(8);
    expect(y + bar.h).toBeLessThanOrEqual(800 - 8);
  });
});
