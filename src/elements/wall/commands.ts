// Commands on walls. Each returns a new document; the store makes each one undo step.

import type { Doc, DocWall } from '../../app/document';
import type { Command } from '../../core/store';
import type { WallId } from './schema';

export const addWalls = (walls: readonly DocWall[]): Command<Doc> => ({
  label: 'cmd.addWalls',
  apply: (doc) => (walls.length === 0 ? doc : { ...doc, walls: [...doc.walls, ...walls] }),
});

export const deleteWalls = (ids: readonly WallId[]): Command<Doc> => ({
  label: 'cmd.deleteWalls',
  apply: (doc) => {
    const drop = new Set(ids);
    const walls = doc.walls.filter((w) => !drop.has(w.id));
    return walls.length === doc.walls.length ? doc : { ...doc, walls };
  },
});

/** Sets the same fields on every listed wall. Unknown ids are ignored; no change, no undo step. */
export const updateWalls = (ids: readonly WallId[], patch: Partial<Omit<DocWall, 'id'>>): Command<Doc> => ({
  label: 'cmd.updateWalls',
  apply: (doc) => {
    const set = new Set(ids);
    let changed = false;
    const walls = doc.walls.map((w) => {
      if (!set.has(w.id)) return w;
      const next = { ...w, ...patch };
      if (JSON.stringify(next) === JSON.stringify(w)) return w;
      changed = true;
      return next;
    });
    return changed ? { ...doc, walls } : doc;
  },
});
