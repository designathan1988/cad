// Commands on walls. Each returns a new document; the store makes each one undo step.

import { type Doc, type DocWall, ownValuesOnly } from '../../app/document';
import type { Command } from '../../core/store';
import type { WallId } from './schema';

export const addWalls = (walls: readonly DocWall[]): Command<Doc> => ({
  label: 'cmd.addWalls',
  apply: (doc) => (walls.length === 0 ? doc : { ...doc, walls: [...doc.walls, ...walls] }),
});

/** Fields to set on walls: the same on each, or worked out from each wall (and the document it is in). */
export type WallPatch = Partial<Omit<DocWall, 'id'>> | ((wall: DocWall, doc: Doc) => Partial<Omit<DocWall, 'id'>>);

/** Sets the fields on every listed wall. Unknown ids are ignored; no change, no undo step. */
export const updateWalls = (ids: readonly WallId[], patch: WallPatch): Command<Doc> => ({
  label: 'cmd.updateWalls',
  apply: (doc) => {
    const set = new Set(ids);
    let changed = false;
    const walls = doc.walls.map((w) => {
      if (!set.has(w.id)) return w;
      // A value set equal to the type's is not kept: the wall follows its type for it.
      const next = ownValuesOnly({ ...w, ...(typeof patch === 'function' ? patch(w, doc) : patch) }, doc.wallTypes);
      if (JSON.stringify(next) === JSON.stringify(w)) return w;
      changed = true;
      return next;
    });
    return changed ? { ...doc, walls } : doc;
  },
});

/** Replaces the walls with the given ones (by id), as one step: a move or stretch with its followers. */
export const setWalls = (walls: readonly DocWall[], label = 'cmd.updateWalls'): Command<Doc> => ({
  label,
  apply: (doc) => {
    const next = new Map(walls.map((w) => [w.id, w]));
    let changed = false;
    const out = doc.walls.map((w) => {
      const n = next.get(w.id);
      if (!n || JSON.stringify(n) === JSON.stringify(w)) return w;
      changed = true;
      return n;
    });
    return changed ? { ...doc, walls: out } : doc;
  },
});

/** Takes the listed values off the walls, so they come from their type again. No change, no step. */
export const resetWallsToType = (ids: readonly WallId[], fields: readonly ('top' | 'baseOffset')[]): Command<Doc> => ({
  label: 'cmd.resetToType',
  apply: (doc) => {
    const set = new Set(ids);
    let changed = false;
    const walls = doc.walls.map((w) => {
      if (!set.has(w.id) || !fields.some((f) => w[f] !== undefined)) return w;
      changed = true;
      const next: Record<string, unknown> = { ...w };
      for (const f of fields) delete next[f];
      return next as unknown as DocWall;
    });
    return changed ? { ...doc, walls } : doc;
  },
});
