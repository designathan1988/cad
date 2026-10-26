// Commands on columns. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import type { Column } from './schema';

export const addColumn = (column: Column): Command<Doc> => ({
  label: 'cmd.addColumn',
  apply: (doc) => ({ ...doc, columns: [...doc.columns, column] }),
});

export type ColumnPatch = { readonly width?: number; readonly depth?: number; readonly angle?: number; readonly topOffset?: number };

/** Section, angle and top of the columns; a size not above zero changes nothing. */
export const updateColumns = (ids: readonly string[], patch: ColumnPatch): Command<Doc> => ({
  label: 'cmd.updateColumn',
  apply: (doc) => {
    if ((patch.width !== undefined && !(patch.width > 0)) || (patch.depth !== undefined && !(patch.depth > 0))) return doc;
    if ([patch.angle, patch.topOffset].some((v) => v !== undefined && !Number.isFinite(v))) return doc;
    let changed = false;
    const columns = doc.columns.map((c) => {
      if (!ids.includes(c.id)) return c;
      const next = { ...c, ...patch };
      if (JSON.stringify(next) === JSON.stringify(c)) return c;
      changed = true;
      return next;
    });
    return changed ? { ...doc, columns } : doc;
  },
});
