// Commands on tags. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import type { Tag } from './schema';

export const addTag = (tag: Tag): Command<Doc> => ({
  label: 'cmd.addTag',
  apply: (doc) => ({ ...doc, tags: [...doc.tags, tag] }),
});

/** What some tags say; an empty text keeps the one they had. */
export const setTagText = (ids: readonly string[], text: string): Command<Doc> => ({
  label: 'cmd.updateTag',
  apply: (doc) => {
    const set = new Set(ids);
    const next = text.trim();
    if (!next) return doc;
    let changed = false;
    const tags = doc.tags.map((x) => {
      if (!set.has(x.id) || x.text === next) return x;
      changed = true;
      return { ...x, text: next };
    });
    return changed ? { ...doc, tags } : doc;
  },
});
