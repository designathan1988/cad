// Every family of the library, in every type: a valid definition whose formulas all close, every part it
// draws of a size and in a built-in material, its handles and types naming its own parameters. A family
// added with a typo in a formula fails here, not in the user's drawing.

import { describe, expect, it } from 'vitest';
import { BUILT_IN_MATERIALS } from '../../src/elements/material/schema';
import { evaluateObject } from '../../src/elements/object/evaluate';
import { LIBRARY } from '../../src/elements/object/library';
import { isDefinition } from '../../src/elements/object/valid';
import { pieceSpan } from '../../src/elements/object/evaluate';

const context = { definitions: LIBRARY, materials: BUILT_IN_MATERIALS };

describe('the whole library', () => {
  it('ids are not repeated', () => {
    const ids = LIBRARY.map((d) => d.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  for (const def of LIBRARY) {
    it(`${def.name.en}: valid, every type closes and draws in built-in materials`, () => {
      expect(isDefinition(def)).toBe(true);
      const names = new Set(def.params.map((p) => p.name));
      expect(def.handles.filter((h) => !names.has(h.param)).map((h) => h.param)).toEqual([]);
      for (const type of def.types) {
        expect(Object.keys(type.values).filter((k) => !names.has(k)), `${type.id}: values of no parameter`).toEqual([]);
        const ev = evaluateObject(def, { id: 'o', levelId: 'l', definitionId: def.id, typeId: type.id, at: { x: 0, y: 0 }, angle: 0, elevation: 0, values: {} }, context);
        expect(ev.problems, `${type.id}`).toEqual([]);
        expect(ev.pieces.length, `${type.id}: draws something`).toBeGreaterThan(0);
        const unknown = ev.pieces.filter((p) => !BUILT_IN_MATERIALS.some((m) => m.id === p.material.id)).map((p) => p.material.id);
        expect(unknown, `${type.id}: materials`).toEqual([]);
        // Nothing under the floor (a leg leaning through it, a part placed below).
        const low = Math.min(...ev.pieces.filter((p) => !p.cut).map((p) => pieceSpan(p).bottom));
        expect(low, `${type.id}: lowest point`).toBeGreaterThan(-0.005);
        expect(ev.lost, `${type.id}: parts of no size`).toBe(0);
      }
    });

    it(`${def.name.en}: any length made tiny keeps the object whole`, () => {
      for (const p of def.params) {
        if (p.kind !== 'length' || p.formula !== undefined) continue;
        for (const type of def.types) {
          const ev = evaluateObject(def, { id: 'o', levelId: 'l', definitionId: def.id, typeId: type.id, at: { x: 0, y: 0 }, angle: 0, elevation: 0, values: { [p.name]: 0.001 } }, context);
          expect(ev.lost, `${type.id}, ${p.name} = 1 mm`).toBe(0);
          expect(ev.problems, `${type.id}, ${p.name} = 1 mm`).toEqual([]);
          const low = Math.min(...ev.pieces.filter((q) => !q.cut).map((q) => pieceSpan(q).bottom));
          expect(low, `${type.id}, ${p.name} = 1 mm: lowest point`).toBeGreaterThan(-0.005);
        }
      }
    });
  }
});
