// Exchange, phase 11: hatches as lines, the plan's and a section's DXF with them, and a 3D model made a
// parametric object (its mesh in a unit box, stretched by its width, depth and height).

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { modelSolids, sectionDrawing } from '../../src/app/section-drawing';
import { evaluateObject, pieceOutline } from '../../src/elements/object/evaluate';
import { isDefinition } from '../../src/elements/object/valid';
import type { SectionMark } from '../../src/elements/section/schema';
import { planDxf, sectionDxf } from '../../src/io/export-dxf';
import { hatchLines, patternOf } from '../../src/io/hatch-lines';
import { hull, meshDefinition } from '../../src/io/import-mesh';

const square = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

describe('hatches as lines', () => {
  it('level lines 0.25 apart across a unit square: three, each its width', () => {
    const l = hatchLines([square], 0, 0.25);
    expect(l).toHaveLength(3);
    for (const [a, b] of l) expect(Math.abs(b.x - a.x)).toBeCloseTo(1, 9);
  });

  it('a hole stays clear: a line through it is two pieces', () => {
    const hole = [
      { x: 0.4, y: 0.4 },
      { x: 0.6, y: 0.4 },
      { x: 0.6, y: 0.6 },
      { x: 0.4, y: 0.6 },
    ];
    const l = hatchLines([square, hole], 0, 0.25).filter(([a]) => Math.abs(a.y - 0.5) < 1e-9);
    expect(l).toHaveLength(2);
  });

  it('brick single at 45°, concrete crossed, plaster plain', () => {
    expect(patternOf('brick')!.angles).toHaveLength(1);
    expect(patternOf('concrete')!.angles).toHaveLength(2);
    expect(patternOf('solid')).toBeNull();
  });
});

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({ id, wallTypeId: 'wt_masonry15', start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, referenceLine: 'centerline', levelId: 'lvl_ground' });
const house: Doc = { ...newDocument(), walls: [wall('w1', [0, 0], [4, 0]), wall('w2', [4, 0], [4, 3]), wall('w3', [4, 3], [0, 3]), wall('w4', [0, 3], [0, 0])] };

describe('DXF with hatches, and of a section', () => {
  it("the plan's brick layers hatched on their own layer", () => {
    const text = planDxf(deriveGeometry(house), 'lvl_ground', { room: (n, s) => `${n} ${s}`, area: (a) => String(a) });
    const hatched = text.split('\r\n').filter((l, i, all) => l === 'A-WALL-HATC' && all[i - 1] === '8').length;
    expect(hatched).toBeGreaterThan(20);
    expect(text).toContain('A-WALL-HATC');
  });

  it("a section's cut outlined and hatched, what it sees, the ground and its levels marked", () => {
    const m: SectionMark = { id: 'sec_a', name: 'A', kind: 'section', start: { x: 1, y: -1 }, end: { x: 1, y: 4 }, depth: 5 };
    const d = sectionDrawing(house, modelSolids(house, deriveGeometry(house)), m);
    const text = sectionDxf(d, (n, z) => `${n} ${z}`);
    const on = (layer: string) => text.split('\r\n').filter((l, i, all) => l === layer && all[i - 1] === '8').length;
    expect(on('A-SECT-CUT')).toBeGreaterThan(0);
    expect(on('A-SECT-PATT')).toBeGreaterThan(10);
    expect(on('A-SECT-SEEN')).toBeGreaterThan(0);
    expect(on('A-SECT-LEVL')).toBeGreaterThan(1);
    expect(text).toContain('Ground floor 0');
    expect(text.trimEnd().endsWith('EOF')).toBe(true);
  });
});

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
    const ev = evaluateObject(made.definition, { id: 'object_1', levelId: 'lvl_ground', definitionId: made.definition.id, typeId: 'imported', at: { x: 5, y: 5 }, angle: 0, elevation: 0, values: { largura: 2 } }, { definitions: doc.definitions, materials: doc.materials });
    expect(ev.problems).toEqual([]);
    expect(ev.pieces).toHaveLength(1);
    const xs = pieceOutline(ev.pieces[0]!).map((q) => q.x);
    expect(Math.min(...xs)).toBeCloseTo(4, 6);
    expect(Math.max(...xs)).toBeCloseTo(6, 6);
    expect(ev.handles.length).toBe(5);
  });

  it('no triangles: nothing', () => {
    expect(meshDefinition('Nada', [{ positions: [], color: '#000000' }], 'generic', ids)).toBeNull();
  });
});
