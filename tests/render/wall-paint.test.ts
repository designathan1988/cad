// What colours a wall block in 3D (the tester's D5): its layer's function, like the plan; the
// selection and the preview over it; the plain wall colour when the type is missing.

import { describe, expect, it } from 'vitest';
import { blockPaint, wallMeshKey } from '../../src/render/wall-paint';

const layers = [
  { thickness: 0.015, function: 'finish1' as const, materialId: 'plaster' },
  { thickness: 0.12, function: 'structure' as const, materialId: 'brick' },
];

describe('blockPaint', () => {
  it("a block takes its layer function's token, on its sides and its top", () => {
    expect(blockPaint(layers, 0, 'n')).toEqual({ side: '--layer-finish', top: '--layer-finish' });
    expect(blockPaint(layers, 1, 'n')).toEqual({ side: '--layer-structure', top: '--layer-structure' });
  });
  it('selected and preview cover the layers', () => {
    expect(blockPaint(layers, 1, 's')).toEqual({ side: 'sideSel', top: 'topSel' });
    expect(blockPaint(layers, 1, 'p')).toEqual({ side: 'preview', top: 'preview' });
  });
  it('no layer known (type missing): the plain wall colours', () => {
    expect(blockPaint([], 0, 'n')).toEqual({ side: 'side', top: 'top' });
  });
});

describe('wallMeshKey', () => {
  it('changes when only a layer function changes, so the colours follow a type edit', () => {
    const blocks = [{ layerIndex: 0, polygon: [], bottom: 0, top: 3 }];
    expect(wallMeshKey('n', blocks, layers)).not.toBe(wallMeshKey('n', blocks, [{ ...layers[0]!, function: 'thermal' }, layers[1]!]));
    expect(wallMeshKey('n', blocks, layers)).toBe(wallMeshKey('n', blocks, layers));
  });
});
