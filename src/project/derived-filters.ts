// The derived geometry seen through the view's filters: the categories the project browser hides and
// the temporary hide or isolate of the chosen elements.

import type { DerivedGeometry } from './derive';
import { filterKinds } from '../elements/registry';

/** Categories of elements the project browser can hide from view (not from the document). Guides have no geometry: the plan and the snaps leave them out themselves. */
export type Category = 'walls' | 'openings' | 'rooms' | 'floors' | 'objects' | 'guides';

/** The geometry without the hidden categories; the same object when nothing is hidden. */
/**
 * Elements hidden or isolated for a while (Revit's Temporary Hide/Isolate, HH and HI): the document keeps
 * them, only the views leave them out. Hidden: those elements go, and the doors and windows of a hidden
 * wall with it. Isolated: only those stay, and the doors and windows of an isolated wall with it.
 */
export interface TemporaryView {
  readonly mode: 'hide' | 'isolate';
  readonly ids: ReadonlySet<string>;
}

/** Whether an element shows in a temporary view (its doors and windows go with a wall: applyTemporary). */
export const shownFor = (temp: TemporaryView | null, id: string): boolean => !temp || (temp.mode === 'hide' ? !temp.ids.has(id) : temp.ids.has(id));

export function applyTemporary(g: DerivedGeometry, temp: TemporaryView | null): DerivedGeometry {
  if (!temp) return g;
  const keep = (id: string) => shownFor(temp, id);
  const solids = new Map([...g.solids].filter(([id]) => keep(id)));
  const openings = new Map(
    [...g.openings].filter(([id, o]) => (temp.mode === 'hide' ? keep(id) && solids.has(o.opening.wallId) : keep(id) || solids.has(o.opening.wallId))),
  );
  return {
    ...g,
    solids,
    openings,
    rooms: new Map([...g.rooms].filter(([id]) => keep(id))),
    // One held by a wall (a door) goes with it hidden, and stays with it isolated.
    kinds: filterKinds(g.kinds, (k, x) => {
      const e = k.element(x) as { readonly id: string };
      const held = k.holders?.(e) ?? [];
      return temp.mode === 'hide' ? keep(e.id) && held.every(keep) : keep(e.id) || held.some(keep);
    }),
  };
}

export function hideCategories(g: DerivedGeometry, hidden: ReadonlySet<Category>): DerivedGeometry {
  if (hidden.size === 0) return g;
  return {
    ...g,
    solids: hidden.has('walls') ? new Map() : g.solids,
    openings: hidden.has('openings') ? new Map() : g.openings,
    rooms: hidden.has('rooms') ? new Map() : g.rooms,
    // Each kind with its category (structure with the walls, stairs and guardrails with the floors).
    kinds: filterKinds(g.kinds, (k) => k.category === null || !hidden.has(k.category)),
  };
}
