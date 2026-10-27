// Libraries to share (phase 11, diferenciais 9): definitions with what they nest and the materials they
// use, read into another project with new ids where taken, and carried in a link.

import { describe, expect, it } from 'vitest';
import { type Doc, newDocument } from '../../src/app/document';
import type { Material } from '../../src/elements/material/schema';
import type { ObjectDefinition } from '../../src/elements/object/schema';
import { isDefinition } from '../../src/elements/object/valid';
import { libraryFromHash, libraryHash, libraryOf, materialsUsed, mergeLibrary } from '../../src/io/library-file';

const words = (s: string) => ({ pt: s, en: s });
const gold: Material = { id: 'mat_gold', name: 'Ouro', color: '#d4a937', roughness: 0.3, metalness: 1, cut: 'solid' };

// A handle in a finish of its own, and a door that nests it in another material.
const handle: ObjectDefinition = {
  id: 'def_handle',
  name: words('Puxador'),
  category: 'generic',
  params: [{ name: 'acabamento', label: words('Acabamento'), kind: 'material', default: 'mat_gold' }],
  parts: [{ kind: 'box', x: 0, y: 0, z: 0, w: 0.1, d: 0.02, h: 0.02, material: 'acabamento' }],
  handles: [],
  types: [{ id: 'type_1', name: words('Padrão'), values: {} }],
};
const door: ObjectDefinition = {
  id: 'def_door',
  name: words('Porta'),
  category: 'generic',
  params: [],
  parts: [
    { kind: 'box', x: 0, y: 0, z: 0, w: 0.8, d: 0.04, h: 2.1, material: 'wood' },
    { kind: 'object', definition: 'def_handle', x: 0.3, y: 0, z: 1, values: { acabamento: 'mat_gold' } },
  ],
  handles: [],
  types: [{ id: 'type_1', name: words('Padrão'), values: {} }],
};
const source: Doc = { ...newDocument(), materials: [...newDocument().materials, gold], definitions: [handle, door] };

describe('library files', () => {
  it('the test definitions are valid ones', () => {
    expect(isDefinition(handle)).toBe(true);
    expect(isDefinition(door)).toBe(true);
  });

  it('a definition comes with what it nests and the materials both use', () => {
    expect([...materialsUsed(door, source.definitions)].sort()).toEqual(['mat_gold', 'wood']);
    const lib = libraryOf(source, ['def_door']);
    expect(lib.definitions.map((d) => d.id).sort()).toEqual(['def_door', 'def_handle']);
    expect(lib.materials.map((m) => m.id).sort()).toEqual(['mat_gold', 'wood']);
    // A material alone.
    expect(libraryOf(source, [], ['mat_gold'])).toEqual({ cad2Library: 2, definitions: [], materials: [gold] });
  });

  it('into a project without them: added as they are, a material the project has the same not twice', () => {
    const r = mergeLibrary({ ...newDocument(), definitions: [] }, libraryOf(source, ['def_door']));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.definitions).toBe(2);
    // Wood is the project's own, the same: only the gold comes in.
    expect(r.materials).toBe(1);
    expect(r.doc.materials.filter((m) => m.id === 'wood')).toHaveLength(1);
    expect(r.doc.definitions.find((d) => d.id === 'def_door')).toEqual(door);
  });

  it('into a project with other things under the same ids: new ids, and what refers to them follows', () => {
    const silver: Material = { ...gold, name: 'Prata', color: '#c0c0c0' };
    const other: ObjectDefinition = { ...handle, name: words('Outro') };
    const target: Doc = { ...newDocument(), materials: [...newDocument().materials, silver], definitions: [other] };
    const r = mergeLibrary(target, libraryOf(source, ['def_door']));
    if (!r.ok) throw new Error('not read');
    expect(r.materials).toBe(1);
    const newGold = r.doc.materials.at(-1)!;
    expect(newGold.id).not.toBe('mat_gold');
    expect(newGold.color).toBe(gold.color);
    // The project's own stay as they were.
    expect(r.doc.materials.find((m) => m.id === 'mat_gold')).toEqual(silver);
    expect(r.doc.definitions[0]).toEqual(other);
    const [h, d] = r.doc.definitions.slice(1);
    expect(h!.id).not.toBe('def_handle');
    expect(h!.params[0]!.default).toBe(newGold.id);
    // The parameter's name is not a material: it stays.
    expect(h!.parts[0]!.material).toBe('acabamento');
    const nested = d!.parts[1]!;
    expect(nested.kind === 'object' && nested.definition).toBe(h!.id);
    expect(nested.kind === 'object' && nested.values?.acabamento).toBe(newGold.id);
    expect(d!.parts[0]!.material).toBe('wood');
  });

  it('the first library files (a list of definitions) are read; what is not a library is not', () => {
    const r = mergeLibrary({ ...newDocument(), definitions: [] }, [handle, { id: 'bad' }]);
    expect(r.ok && [r.definitions, r.bad]).toEqual([1, 1]);
    expect(mergeLibrary(newDocument(), { hello: 1 })).toEqual({ ok: false, error: 'notLibrary' });
  });

  it('a link carries the library and gives it back', async () => {
    const lib = libraryOf(source, ['def_door']);
    const hash = await libraryHash(lib);
    expect(hash.startsWith('#lib=')).toBe(true);
    expect(hash).toMatch(/^#lib=[A-Za-z0-9_-]+$/);
    expect(await libraryFromHash(hash)).toEqual(lib);
    expect(await libraryFromHash('#nothing')).toBeNull();
  });
});
