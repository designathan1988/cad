// Exchange, phase 11: a 3D model made a parametric object (its mesh in a unit box, stretched by its
// width, depth and height).

import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/project/doc';
import { evaluateObject } from '../../src/elements/object/evaluate';
import { pieceOutline } from '../../src/elements/object/piece-shape';
import { isDefinition } from '../../src/elements/object/valid';
import { hull, meshDefinition } from '../../src/io/import-mesh';
import { lid, objid } from '../ids';

/** A unit cube's twelve triangles, in centimetres, 80 × 40 × 120 cm, with its corner off the origin. */
function box(sx: number, sy: number, sz: number, ox = 0): number[] {
  const v = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ].map(([x, y, z]) => [ox + x! * sx, y! * sy, z! * sz]);
  const f = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
  return f.flatMap((i) => v[i]!);
}

describe('a 3D model as an object', () => {
  const ids = (() => {
    let n = 0;
    return (p: string) => `${p}_${++n}`;
  })();

  it('the hull of a square and the point in it: the square', () => {
    expect(hull([[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]])).toHaveLength(4);
  });

  it('a box in centimetres: its size read in metres, its width, depth and height parameters, a material a colour', () => {
    const made = meshDefinition('Armário', [{ positions: box(80, 40, 120, 30), color: '#aa5500' }, { positions: box(10, 2, 10, 30), color: '#222222' }], 'casework', ids)!;
    expect(made.unit).toBe(0.01);
    expect(made.triangles).toBe(24);
    const p = Object.fromEntries(made.definition.params.map((x) => [x.name, x.default]));
    expect(p.largura).toBeCloseTo(0.8, 9);
    expect(p.profundidade).toBeCloseTo(0.4, 9);
    expect(p.altura).toBeCloseTo(1.2, 9);
    expect(made.materials.map((m) => m.color)).toEqual(['#aa5500', '#222222']);
    expect(made.definition.parts).toHaveLength(2);
    expect(made.definition.meshes![0]!.positions.every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(isDefinition(made.definition)).toBe(true);
    // A part pointing at no mesh of its own is no definition.
    expect(isDefinition({ ...made.definition, meshes: [] })).toBe(false);
  });

  it('placed and stretched: its outline in plan grows with its width', () => {
    const made = meshDefinition('Caixa', [{ positions: box(1, 1, 1), color: '#808080' }], 'generic', ids)!;
    const doc = { ...newDocument(), materials: [...newDocument().materials, ...made.materials], definitions: [made.definition] };
    const ev = evaluateObject(made.definition, { id: objid('object_1'), levelId: lid('lvl_ground'), definitionId: made.definition.id, typeId: 'imported', at: { x: 5, y: 5 }, angle: 0, elevation: 0, values: { largura: 2 } }, { definitions: doc.definitions, materials: doc.materials });
    expect(ev.problems).toEqual([]);
    expect(ev.pieces).toHaveLength(1);
    const xs = pieceOutline(ev.pieces[0]!).map((q) => q.x);
    expect(Math.min(...xs)).toBeCloseTo(4, 6);
    expect(Math.max(...xs)).toBeCloseTo(6, 6);
    expect(ev.handles.length).toBe(5);
  });

  it('a glTF is in metres whatever its size: a 25 m building is not taken for centimetres', () => {
    const made = meshDefinition('Prédio', [{ positions: box(25, 12, 9), color: '#cccccc' }], 'generic', ids, true)!;
    expect(made.unit).toBe(1);
    const p = Object.fromEntries(made.definition.params.map((x) => [x.name, x.default]));
    expect(p.largura).toBeCloseTo(25, 9);
  });

  it('no triangles: nothing', () => {
    expect(meshDefinition('Nada', [{ positions: [], color: '#000000' }], 'generic', ids)).toBeNull();
  });
});
