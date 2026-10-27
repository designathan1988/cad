// The ribbon shows only some of the library's objects (16 of them pushed the Rooms and Reference panels
// out of sight): the one being placed and those placed first, then the library's first ones.

import { describe, expect, it } from 'vitest';
import { RIBBON_OBJECTS, ribbonObjects } from '../../src/app/ribbon-tabs';
import { newDocument } from '../../src/app/document';

describe('ribbon objects', () => {
  const doc = newDocument();
  const ids = doc.definitions.map((d) => d.id);
  const appOf = (d: typeof doc, tool = 'select', objectDef: string | null = null) => ({ store: { get: () => d }, ui: { tool, objectDef } }) as never;

  it('a new project has more objects than the ribbon shows, and it shows the first ones', () => {
    expect(ids.length).toBeGreaterThan(RIBBON_OBJECTS);
    expect(ribbonObjects(appOf(doc)).map((d) => d.id)).toEqual(ids.slice(0, RIBBON_OBJECTS));
  });

  it('the one being placed and one placed are shown, in the library order', () => {
    const last = ids[ids.length - 1]!;
    const placed = ids[ids.length - 2]!;
    const object = { id: 'object_1', levelId: doc.levels[0]!.id, definitionId: placed, typeId: 'standard', at: { x: 0, y: 0 }, angle: 0, elevation: 0, values: {} };
    const shown = ribbonObjects(appOf({ ...doc, objects: [object] }, 'object', last)).map((d) => d.id);
    expect(shown).toHaveLength(RIBBON_OBJECTS);
    expect(shown.slice(-2)).toEqual([placed, last]);
    expect(shown.slice(0, -2)).toEqual(ids.slice(0, RIBBON_OBJECTS - 2));
  });
});
