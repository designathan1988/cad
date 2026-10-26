// Commands on text notes. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import type { Note } from './schema';

export const addNote = (note: Note): Command<Doc> => ({
  label: 'cmd.addNote',
  apply: (doc) => ({ ...doc, notes: [...doc.notes, note] }),
});

/** Text and height of the notes; an empty text or a height not above zero changes nothing. */
export const updateNotes = (ids: readonly string[], patch: { readonly text?: string; readonly height?: number }): Command<Doc> => ({
  label: 'cmd.updateNote',
  apply: (doc) => {
    if (patch.text !== undefined && patch.text.trim() === '') return doc;
    if (patch.height !== undefined && !(patch.height > 0)) return doc;
    let changed = false;
    const notes = doc.notes.map((n) => {
      if (!ids.includes(n.id)) return n;
      const next = { ...n, ...(patch.text !== undefined ? { text: patch.text.trim() } : {}), ...(patch.height !== undefined ? { height: patch.height } : {}) };
      if (next.text === n.text && next.height === n.height) return n;
      changed = true;
      return next;
    });
    return changed ? { ...doc, notes } : doc;
  },
});
