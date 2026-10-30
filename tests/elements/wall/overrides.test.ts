// A wall takes its base offset and top from its type unless it sets its own (ref/chat.txt:214): an
// own value differing from the type's is an override, shown as such, and can go back to the type.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument, wallBase, wallHeights, wallOverrides, wallTop } from '../../../src/project/doc';
import { resetWallsToType } from '../../../src/elements/wall/commands';

const base: Doc = {
  ...newDocument(),
  wallTypes: [
    ...newDocument().wallTypes,
    // A parapet type: 1.10 m high from its base.
    { id: 'wt_parapet', name: 'Parapet', layers: [{ thickness: 0.15, function: 'structure', materialId: 'brick' }], top: { kind: 'fixed', height: 1.1 }, baseOffset: 0 },
  ],
};
const wall = (id: string, typeId: string, own: Partial<DocWall> = {}): DocWall => ({
  id,
  wallTypeId: typeId,
  start: { x: 0, y: 0 },
  end: { x: 4, y: 0 },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  ...own,
});

describe('values from the type, and overrides', () => {
  it("a wall with no own values takes its type's: the parapet is 1.10 m high", () => {
    const w = wall('p', 'wt_parapet');
    const doc = { ...base, walls: [w] };
    expect(wallTop(doc, w)).toEqual({ kind: 'fixed', height: 1.1 });
    expect(wallBase(doc, w)).toBe(0);
    expect(wallHeights(doc, w)).toEqual({ bottom: 0, top: 1.1 });
    expect(wallOverrides(doc, w)).toEqual({ top: false, baseOffset: false });
  });

  it("a type with no values: the level's height and no offset", () => {
    const w = wall('c', 'wt_concrete20');
    expect(wallHeights({ ...base, walls: [w] }, w)).toEqual({ bottom: 0, top: 2.8 });
  });

  it("an own value different from the type's is an override; an equal one is not", () => {
    const doc = { ...base };
    expect(wallOverrides(doc, wall('p', 'wt_parapet', { top: { kind: 'fixed', height: 0.9 } }))).toEqual({ top: true, baseOffset: false });
    expect(wallOverrides(doc, wall('p', 'wt_parapet', { top: { kind: 'fixed', height: 1.1 }, baseOffset: 0.2 }))).toEqual({ top: false, baseOffset: true });
  });

  it('going back to the type removes the own values: one undo step, nothing else changed', () => {
    const w = wall('p', 'wt_parapet', { top: { kind: 'fixed', height: 0.9 }, baseOffset: 0.2 });
    const doc = { ...base, walls: [w] };
    const next = resetWallsToType(['p'], ['top']).apply(doc);
    expect(next.walls[0]).not.toHaveProperty('top');
    expect(next.walls[0]!.baseOffset).toBe(0.2);
    expect(resetWallsToType(['p'], ['top']).apply(next)).toBe(next);
  });
});
