// Commands on grid axes. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../project/doc';
import type { Command } from '../../core/store';
import type { Grid } from './schema';

export const addGrid = (grid: Grid): Command<Doc> => ({
  label: 'cmd.addGrid',
  apply: (doc) => ({ ...doc, grids: [...doc.grids, grid] }),
});

/** An axis's name; an empty one, or one another axis has, changes nothing (two "A"s would say nothing). */
export const renameGrid = (id: string, name: string): Command<Doc> => ({
  label: 'cmd.renameGrid',
  apply: (doc) => {
    const n = name.trim().toUpperCase();
    if (n === '' || doc.grids.some((g) => g.id !== id && g.name === n)) return doc;
    if (!doc.grids.some((g) => g.id === id && g.name !== n)) return doc;
    return { ...doc, grids: doc.grids.map((g) => (g.id === id ? { ...g, name: n } : g)) };
  },
});
