// Commands on wall types (ref/chat.txt:12, the tester's D5): create, duplicate, edit and delete. A
// wall takes its thickness and layers from its type, always derived, so editing a type changes every
// wall of it at once, in one undo step.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../../src/project/doc';
import { deriveGeometry } from '../../../src/project/derive';
import { createStore } from '../../../src/core/store';
import { addWallType, deleteWallType, duplicateWallType, typeDeleteBlocker, updateWallType } from '../../../src/elements/wall/types';

const wall = (id: string, typeId: string): DocWall => ({
  id,
  wallTypeId: typeId,
  start: { x: 0, y: 0 },
  end: { x: 4, y: 0 },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
});
const doc = (): Doc => ({ ...newDocument(), walls: [wall('a', 'wt_concrete20')] });
const layer = (thickness: number) => ({ thickness, function: 'structure' as const, materialId: 'concrete' });
const widthOf = (d: Doc, id: string) => {
  const ys = deriveGeometry(d).solids.get(id)!.pieces.flatMap((p) => p.polygon.map((v) => v.y));
  return Math.max(...ys) - Math.min(...ys);
};

describe('wall types', () => {
  it('a new type is added as given', () => {
    const t = { id: 'wt_new', name: 'Brick 25', layers: [layer(0.25)] };
    expect(addWallType(t).apply(doc()).wallTypes.at(-1)).toEqual(t);
  });

  it('a type with no layer or a layer of no thickness is not added', () => {
    const d = doc();
    expect(addWallType({ id: 'x', name: 'X', layers: [] }).apply(d)).toBe(d);
    expect(addWallType({ id: 'x', name: 'X', layers: [layer(0)] }).apply(d)).toBe(d);
    expect(addWallType({ id: 'wt_concrete20', name: 'Same id', layers: [layer(0.1)] }).apply(d)).toBe(d);
  });

  it('duplicating copies the layers, top and base, under a new id and name', () => {
    const d = duplicateWallType('wt_concrete20', 'wt_copy', 'Concrete 20 cm (2)').apply(doc());
    const src = d.wallTypes.find((t) => t.id === 'wt_concrete20')!;
    expect(d.wallTypes.at(-1)).toEqual({ ...src, id: 'wt_copy', name: 'Concrete 20 cm (2)' });
  });

  it('editing the layers changes every wall of the type: 20 cm becomes 30 cm, in one undo step', () => {
    const s = createStore(doc());
    expect(widthOf(s.get(), 'a')).toBeCloseTo(0.2, 9);
    s.dispatch(updateWallType('wt_concrete20', { layers: [layer(0.3)] }));
    expect(widthOf(s.get(), 'a')).toBeCloseTo(0.3, 9);
    s.undo();
    expect(widthOf(s.get(), 'a')).toBeCloseTo(0.2, 9);
  });

  it('a blank name, no layers or a bad thickness change nothing; the same values make no step', () => {
    const d = doc();
    expect(updateWallType('wt_concrete20', { name: '  ' }).apply(d)).toBe(d);
    expect(updateWallType('wt_concrete20', { layers: [] }).apply(d)).toBe(d);
    expect(updateWallType('wt_concrete20', { layers: [layer(-0.1)] }).apply(d)).toBe(d);
    const same = d.wallTypes.find((t) => t.id === 'wt_concrete20')!;
    expect(updateWallType('wt_concrete20', { name: same.name }).apply(d)).toBe(d);
  });

  it('a name is kept trimmed; top and base can be given to the type and taken back', () => {
    const d = updateWallType('wt_concrete20', { name: ' Concrete 22 ', top: { kind: 'fixed', height: 1.1 }, baseOffset: 0.1 }).apply(doc());
    const t = d.wallTypes.find((x) => x.id === 'wt_concrete20')!;
    expect(t.name).toBe('Concrete 22');
    expect(t.top).toEqual({ kind: 'fixed', height: 1.1 });
    const back = updateWallType('wt_concrete20', { top: undefined, baseOffset: undefined }).apply(d);
    expect(back.wallTypes.find((x) => x.id === 'wt_concrete20')!.top).toBeUndefined();
    expect('baseOffset' in back.wallTypes.find((x) => x.id === 'wt_concrete20')!).toBe(false);
  });

  it('a type in use, or the last one, is not deleted, and says why', () => {
    const d = doc();
    expect(typeDeleteBlocker(d, 'wt_concrete20')).toBe('inUse');
    expect(deleteWallType('wt_concrete20').apply(d)).toBe(d);
    const unused = d.wallTypes.find((t) => t.id !== 'wt_concrete20')!.id;
    expect(typeDeleteBlocker(d, unused)).toBeNull();
    expect(deleteWallType(unused).apply(d).wallTypes.some((t) => t.id === unused)).toBe(false);
    const one: Doc = { ...newDocument(), wallTypes: [newDocument().wallTypes[0]!] };
    expect(typeDeleteBlocker(one, one.wallTypes[0]!.id)).toBe('last');
  });
});
