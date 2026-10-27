// Commands on columns. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import type { Column, ColumnShape } from './schema';

export const addColumn = (column: Column): Command<Doc> => ({
  label: 'cmd.addColumn',
  apply: (doc) => ({ ...doc, columns: [...doc.columns, column] }),
});

export type ColumnPatch = {
  readonly width?: number;
  readonly depth?: number;
  readonly angle?: number;
  readonly topOffset?: number;
  readonly shape?: ColumnShape;
  readonly plate?: number;
  /** Another level's floor, or null for its own level's top. */
  readonly topLevelId?: string | null;
};

/** Section, angle and top of the columns; a size not above zero changes nothing. */
export const updateColumns = (ids: readonly string[], patch: ColumnPatch): Command<Doc> => ({
  label: 'cmd.updateColumn',
  apply: (doc) => {
    if ((patch.width !== undefined && !(patch.width > 0)) || (patch.depth !== undefined && !(patch.depth > 0))) return doc;
    if ([patch.angle, patch.topOffset].some((v) => v !== undefined && !Number.isFinite(v))) return doc;
    if (patch.plate !== undefined && !(patch.plate > 0)) return doc;
    let changed = false;
    const columns = doc.columns.map((c) => {
      if (!ids.includes(c.id)) return c;
      // Its own level's top again: the field goes, rather than standing as null.
      const { topLevelId, ...rest } = patch;
      const { topLevelId: _old, ...base } = c;
      const next = { ...(topLevelId === null ? base : c), ...rest, ...(topLevelId ? { topLevelId } : {}) };
      if (JSON.stringify(next) === JSON.stringify(c)) return c;
      changed = true;
      return next;
    });
    return changed ? { ...doc, columns } : doc;
  },
});
