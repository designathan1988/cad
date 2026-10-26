// The materials parametric objects use (phase 3): what their material parameters default to, what
// their types set, and the material ids their parts name directly. A project keeps these among its own
// materials, so each can be edited in the Materials dialog.

import type { ObjectDefinition } from './schema';

export function definitionMaterials(definitions: readonly ObjectDefinition[]): Set<string> {
  const ids = new Set<string>();
  for (const d of definitions) {
    const params = new Set(d.params.filter((p) => p.kind === 'material').map((p) => p.name));
    for (const p of d.params) if (p.kind === 'material' && typeof p.default === 'string') ids.add(p.default);
    for (const t of d.types) for (const [name, v] of Object.entries(t.values)) if (params.has(name) && typeof v === 'string') ids.add(v);
    for (const part of d.parts) if (part.material !== undefined && !params.has(part.material)) ids.add(part.material);
  }
  return ids;
}
