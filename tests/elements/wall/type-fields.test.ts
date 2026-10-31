// The fields of a wall type in its dialog: name, top and base, read from the type and written as one
// command each. A top at the level's height and a base offset of 0 are the defaults: the type then
// keeps none, so its walls follow their level as they would without it.

import { describe, expect, it } from 'vitest';
import { wallTypeFields } from '../../../src/elements/wall/type-fields';
import type { WallTypePatch } from '../../../src/elements/wall/types';
import type { WallType } from '../../../src/elements/wall/schema';
import { fieldStates } from '../../../src/ui/fields';
import { mid, tid } from '../../ids';

const base: WallType = { id: tid('t'), name: 'Brick', layers: [{ thickness: 0.2, function: 'structure', materialId: mid('brick') }] };
const run = (type: WallType) => {
  const patches: WallTypePatch[] = [];
  const fields = wallTypeFields({ update: (p) => patches.push(p) });
  const states = new Map(fieldStates(fields, [type]).map((s) => [s.field.id, s]));
  const set = (id: string, v: number | string) => {
    const f = states.get(id)!.field as { set: (x: never) => void };
    f.set(v as never);
  };
  return { patches, states, set };
};

describe('wall type fields', () => {
  it('a type with no top or base shows the level height and 0, and no fixed height', () => {
    const { states } = run(base);
    expect(states.get('top')!.value).toBe('level');
    expect(states.get('topOffset')!.value).toBe(0);
    expect(states.get('baseOffset')!.value).toBe(0);
    expect(states.has('topHeight')).toBe(false);
  });

  it('a fixed top shows its height and not the offset', () => {
    const { states } = run({ ...base, top: { kind: 'fixed', height: 1.1 } });
    expect(states.get('top')!.value).toBe('fixed');
    expect(states.get('topHeight')!.value).toBe(1.1);
    expect(states.has('topOffset')).toBe(false);
  });

  it('setting values writes them; setting the defaults takes them off the type', () => {
    const { patches, set } = run(base);
    set('topOffset', 0.3);
    set('topOffset', 0);
    set('baseOffset', -0.1);
    set('baseOffset', 0);
    set('top', 'fixed');
    set('name', 'Brick 20');
    expect(patches).toEqual([
      { top: { kind: 'level', offset: 0.3 } },
      { top: undefined },
      { baseOffset: -0.1 },
      { baseOffset: undefined },
      { top: { kind: 'fixed', height: 2.8 } },
      { name: 'Brick 20' },
    ]);
  });
});
