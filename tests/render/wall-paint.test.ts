// What colours a wall block in 3D (the tester's D5): its layer's material, like the plan; the
// selection and the preview over it; the plain wall colour when the type is missing.

import { describe, expect, it } from 'vitest';
import { BUILT_IN_MATERIALS } from '../../src/elements/material/schema';
import { blockPaint, wallMeshKey } from '../../src/render/wall-paint';

const plaster = BUILT_IN_MATERIALS.find((m) => m.id === 'plaster')!;
const brick = BUILT_IN_MATERIALS.find((m) => m.id === 'brick')!;
const materials = [plaster, brick];

describe('blockPaint', () => {
  it("a block takes its layer's material, on its sides and its top", () => {
    expect(blockPaint(materials, 0, 'n')).toEqual({ side: plaster, top: plaster });
    expect(blockPaint(materials, 1, 'n')).toEqual({ side: brick, top: brick });
  });
  it('selected and preview cover the layers', () => {
    expect(blockPaint(materials, 1, 's')).toEqual({ side: 'sideSel', top: 'topSel' });
    expect(blockPaint(materials, 1, 'p')).toEqual({ side: 'preview', top: 'preview' });
  });
  it('no layer known (type missing): the plain wall colours', () => {
    expect(blockPaint([], 0, 'n')).toEqual({ side: 'side', top: 'top' });
  });
});

describe('wallMeshKey', () => {
  it('changes when only a layer material changes, so the colours follow a type edit', () => {
    const blocks = [{ layerIndex: 0, polygon: [], bottom: 0, top: 3 }];
    expect(wallMeshKey('n', blocks, materials)).not.toBe(wallMeshKey('n', blocks, [brick, brick]));
    expect(wallMeshKey('n', blocks, materials)).toBe(wallMeshKey('n', blocks, materials));
  });
});
