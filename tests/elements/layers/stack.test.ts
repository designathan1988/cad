// A stack of layers, the same for wall types now and floor and slab types later: add, remove, move
// and change a layer, and what makes a stack unusable. Each operation returns a new list.

import { describe, expect, it } from 'vitest';
import { addLayer, moveLayer, removeLayer, setLayer, stackProblem } from '../../../src/elements/layers/stack';

const L = (thickness: number, fn = 'structure') => ({ thickness, function: fn, materialId: fn });
const three = [L(0.02, 'finish1'), L(0.15), L(0.01, 'finish2')];

describe('layer stack', () => {
  it('adds after a layer, a copy of it, so the new one starts from something sensible', () => {
    expect(addLayer(three, 1)).toEqual([L(0.02, 'finish1'), L(0.15), L(0.15), L(0.01, 'finish2')]);
  });
  it('removes one, never the last', () => {
    expect(removeLayer(three, 0)).toEqual([L(0.15), L(0.01, 'finish2')]);
    expect(removeLayer([L(0.1)], 0)).toEqual([L(0.1)]);
  });
  it('moves one up or down, inside the list', () => {
    expect(moveLayer(three, 2, 0)).toEqual([L(0.01, 'finish2'), L(0.02, 'finish1'), L(0.15)]);
    expect(moveLayer(three, 0, -1)).toBe(three);
    expect(moveLayer(three, 2, 3)).toBe(three);
  });
  it('changes one layer, leaving the others', () => {
    expect(setLayer(three, 1, { thickness: 0.2 })).toEqual([L(0.02, 'finish1'), L(0.2), L(0.01, 'finish2')]);
  });
  it('a stack with no layer, or a layer of no thickness, is unusable, and says why', () => {
    expect(stackProblem(three)).toBeNull();
    expect(stackProblem([])).toBe('noLayers');
    expect(stackProblem([L(0.1), L(0)])).toBe('badThickness');
    expect(stackProblem([L(Number.NaN)])).toBe('badThickness');
  });
});
