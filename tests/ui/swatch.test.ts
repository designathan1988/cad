// A wall type's thumbnail: its layers side by side, each as wide as its share of the thickness, in
// the colour of its function.

import { describe, expect, it } from 'vitest';
import { layerBands } from '../../src/ui/swatch';

describe('wall type thumbnail', () => {
  it('plaster 2 + brick 16 + plaster 2 over 40 px: 4, 32 and 4 px, finish, structure, finish', () => {
    const bands = layerBands(
      [
        { thickness: 0.02, function: 'finish1', materialId: 'plaster' },
        { thickness: 0.16, function: 'structure', materialId: 'brick' },
        { thickness: 0.02, function: 'finish2', materialId: 'plaster' },
      ],
      40,
    );
    expect(bands.map((b) => [b.x, b.w, b.fill])).toEqual([
      [0, 4, 'var(--layer-finish)'],
      [4, 32, 'var(--layer-structure)'],
      [36, 4, 'var(--layer-finish)'],
    ]);
  });

  it('a thin layer still shows: at least 1 px', () => {
    const bands = layerBands(
      [
        { thickness: 0.001, function: 'finish1', materialId: 'paint' },
        { thickness: 0.2, function: 'structure', materialId: 'concrete' },
      ],
      40,
    );
    expect(bands[0]!.w).toBe(1);
    expect(bands[1]!.x + bands[1]!.w).toBe(40);
  });
});
