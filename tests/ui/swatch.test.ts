// A wall type's thumbnail: its layers side by side, each as wide as its share of the thickness, in
// the colour of its material.

import { describe, expect, it } from 'vitest';
import { BUILT_IN_MATERIALS } from '../../src/elements/material/schema';
import { layerBands } from '../../src/elements/wall/swatch';
import { mid } from '../ids';

describe('wall type thumbnail', () => {
  it("plaster 2 + brick 16 + plaster 2 over 40 px: 4, 32 and 4 px, in plaster's and brick's colours", () => {
    const bands = layerBands(
      [
        { thickness: 0.02, function: 'finish1', materialId: mid('plaster') },
        { thickness: 0.16, function: 'structure', materialId: mid('brick') },
        { thickness: 0.02, function: 'finish2', materialId: mid('plaster') },
      ],
      40,
      BUILT_IN_MATERIALS,
    );
    expect(bands.map((b) => [b.x, b.w, b.fill])).toEqual([
      [0, 4, '#e7e1d6'],
      [4, 32, '#b9653f'],
      [36, 4, '#e7e1d6'],
    ]);
  });

  it('a thin layer still shows: at least 1 px', () => {
    const bands = layerBands(
      [
        { thickness: 0.001, function: 'finish1', materialId: mid('paint') },
        { thickness: 0.2, function: 'structure', materialId: mid('concrete') },
      ],
      40,
      BUILT_IN_MATERIALS,
    );
    expect(bands[0]!.w).toBe(1);
    expect(bands[1]!.x + bands[1]!.w).toBe(40);
  });
});
