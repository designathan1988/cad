// Commands on the project's materials (docs/plano-de-escopo.md, phase 2). A wall layer stores only its
// material's id: changing a material repaints every layer made of it, in plan and in 3D, in one undo
// step. A command that would leave a material unusable (a colour that is not one, a finish outside 0..1)
// changes nothing.

import { definitionMaterials } from '../object/materials';
import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import { isPattern } from './pattern';
import { CUT_PATTERNS, isColor, type Material, type MaterialId } from './schema';

const unit = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;
const usable = (m: Material): boolean => isColor(m.color) && unit(m.roughness) && unit(m.metalness) && CUT_PATTERNS.includes(m.cut) && (m.pattern === undefined || isPattern(m.pattern));

export const addMaterial = (m: Material): Command<Doc> => ({
  label: 'cmd.addMaterial',
  apply: (doc) => (!usable(m) || doc.materials.some((x) => x.id === m.id) ? doc : { ...doc, materials: [...doc.materials, { ...m, name: m.name.trim() }] }),
});

export type MaterialPatch = Partial<Omit<Material, 'id' | 'pattern'>> & { readonly pattern?: Material['pattern'] | null };

/** Name, colour, finish, cut pattern or surface pattern (null: none). The same values, or unusable ones, change nothing. */
export const updateMaterial = (id: MaterialId, patch: MaterialPatch): Command<Doc> => ({
  label: 'cmd.updateMaterial',
  apply: (doc) => {
    const old = doc.materials.find((m) => m.id === id);
    if (!old) return doc;
    const { pattern, ...rest } = patch;
    const merged: Material = { ...old, ...rest, name: (patch.name ?? old.name).trim() };
    const { pattern: _was, ...plain } = merged;
    const next: Material = pattern === null ? plain : pattern !== undefined ? { ...merged, pattern } : merged;
    if (!usable(next) || JSON.stringify(next) === JSON.stringify(old)) return doc;
    return { ...doc, materials: doc.materials.map((m) => (m.id === id ? next : m)) };
  },
});

/**
 * How many things are made of it: wall type layers, floor layers, rooms' finishes and object
 * definitions. Counting only the walls' layers showed a floor's tiles or a table's wood as unused,
 * and let them be deleted.
 */
export const materialUses = (doc: Doc, id: MaterialId): number =>
  doc.wallTypes.reduce((n, t) => n + t.layers.filter((l) => l.materialId === id).length, 0) +
  doc.floors.reduce((n, f) => n + (f.layers ?? []).filter((l) => l.materialId === id).length, 0) +
  doc.rooms.reduce((n, r) => n + [r.finishes?.floor, r.finishes?.wall, r.finishes?.ceiling].filter((m) => m === id).length, 0) +
  doc.definitions.filter((d) => definitionMaterials([d]).has(id)).length;

/** Why a material cannot be deleted: layers use it, or it is the last one. Null when it can be. */
export function materialDeleteBlocker(doc: Doc, id: MaterialId): 'inUse' | 'last' | 'missing' | null {
  if (!doc.materials.some((m) => m.id === id)) return 'missing';
  if (doc.materials.length <= 1) return 'last';
  return materialUses(doc, id) > 0 ? 'inUse' : null;
}

export const deleteMaterial = (id: MaterialId): Command<Doc> => ({
  label: 'cmd.deleteMaterial',
  apply: (doc) => (materialDeleteBlocker(doc, id) === null ? { ...doc, materials: doc.materials.filter((m) => m.id !== id) } : doc),
});
