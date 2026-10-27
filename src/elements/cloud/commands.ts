// Commands on revision clouds. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import type { Cloud } from './schema';

export const addCloud = (c: Cloud): Command<Doc> => ({
  label: 'cmd.addCloud',
  apply: (doc) => ({ ...doc, clouds: [...doc.clouds, c] }),
});

/** The revision mark or the note of some clouds; an empty note is no note. */
export const updateClouds = (ids: readonly string[], patch: { readonly revision?: string; readonly note?: string }): Command<Doc> => ({
  label: 'cmd.updateCloud',
  apply: (doc) => {
    const set = new Set(ids);
    let changed = false;
    const clouds = doc.clouds.map((c) => {
      if (!set.has(c.id)) return c;
      const revision = patch.revision !== undefined ? patch.revision.trim() || c.revision : c.revision;
      const note = patch.note !== undefined ? patch.note.trim() : (c.note ?? '');
      const { note: _was, ...rest } = c;
      const next: Cloud = { ...rest, revision, ...(note ? { note } : {}) };
      if (JSON.stringify(next) === JSON.stringify(c)) return c;
      changed = true;
      return next;
    });
    return changed ? { ...doc, clouds } : doc;
  },
});
