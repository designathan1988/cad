// Commands on parametric objects (phase 3). Placing one, changing its values (a handle's drag is one
// command when let go), its type, its height off the floor. A value is held to its parameter's range
// and step here, so what is kept is what is drawn. A command that changes nothing returns the same doc.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import { held } from './evaluate';
import type { ObjectDefinition, ObjectId, ObjectInstance } from './schema';

export const addObject = (o: ObjectInstance): Command<Doc> => ({
  label: 'cmd.addObject',
  apply: (doc) => (doc.objects.some((x) => x.id === o.id) || !doc.definitions.some((d) => d.id === o.definitionId) ? doc : { ...doc, objects: [...doc.objects, o] }),
});

/** A value held to its parameter (a number to its range and step), or null for one it does not take. */
export function valueFor(def: ObjectDefinition, name: string, v: number | string): number | string | null {
  const p = def.params.find((x) => x.name === name);
  if (!p || p.formula !== undefined) return null;
  if (p.kind === 'material') return typeof v === 'string' && v !== '' ? v : null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? held(p, n) : null;
}

/**
 * Values set on the objects (each held to its parameter); `at` moves them too (a handle keeping the
 * opposite face where it was). One undo step for all of them.
 */
export const setObjectValues = (changes: readonly { readonly id: ObjectId; readonly values: Readonly<Record<string, number | string>>; readonly at?: { x: number; y: number }; readonly elevation?: number }[]): Command<Doc> => ({
  label: 'cmd.updateObject',
  apply: (doc) => {
    let changed = false;
    const objects = doc.objects.map((o) => {
      const c = changes.find((x) => x.id === o.id);
      const def = c && doc.definitions.find((d) => d.id === o.definitionId);
      if (!c || !def) return o;
      const values = { ...o.values };
      for (const [name, v] of Object.entries(c.values)) {
        const kept = valueFor(def, name, v);
        if (kept !== null) values[name] = kept;
      }
      const next: ObjectInstance = { ...o, values, ...(c.at ? { at: c.at } : {}), ...(c.elevation !== undefined ? { elevation: c.elevation } : {}) };
      if (JSON.stringify(next) === JSON.stringify(o)) return o;
      changed = true;
      return next;
    });
    return changed ? { ...doc, objects } : doc;
  },
});

/** Another type: its values replace the instance's own (as choosing a type in Revit does). */
export const setObjectType = (ids: readonly ObjectId[], typeId: string): Command<Doc> => ({
  label: 'cmd.updateObject',
  apply: (doc) => {
    let changed = false;
    const objects = doc.objects.map((o) => {
      const def = doc.definitions.find((d) => d.id === o.definitionId);
      if (!ids.includes(o.id) || !def?.types.some((t) => t.id === typeId) || (o.typeId === typeId && Object.keys(o.values).length === 0)) return o;
      changed = true;
      return { ...o, typeId, values: {} };
    });
    return changed ? { ...doc, objects } : doc;
  },
});

/** The instance's own value of a parameter taken off: it follows its type again. */
export const resetObjectValue = (ids: readonly ObjectId[], name: string): Command<Doc> => ({
  label: 'cmd.updateObject',
  apply: (doc) => {
    let changed = false;
    const objects = doc.objects.map((o) => {
      if (!ids.includes(o.id) || !(name in o.values)) return o;
      changed = true;
      const { [name]: _gone, ...values } = o.values;
      return { ...o, values };
    });
    return changed ? { ...doc, objects } : doc;
  },
});
