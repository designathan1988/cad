// Commands on text notes. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import type { Note } from './schema';

/** The notes' leaders taken off: plain texts again. */
export const dropLeaders = (ids: readonly string[]): Command<Doc> => ({
  label: 'cmd.updateNote',
  apply: (doc) =>
    !doc.notes.some((n) => ids.includes(n.id) && n.leader)
      ? doc
      : {
          ...doc,
          notes: doc.notes.map((n) => {
            if (!ids.includes(n.id) || !n.leader) return n;
            const { leader: _, ...rest } = n;
            return rest;
          }),
        },
});

export const addNote = (note: Note): Command<Doc> => ({
  label: 'cmd.addNote',
  apply: (doc) => ({ ...doc, notes: [...doc.notes, note] }),
});

/** Text and height of the notes; an empty text or a height not above zero changes nothing. */
export const updateNotes = (ids: readonly string[], patch: { readonly text?: string; readonly height?: number; readonly offset?: number }): Command<Doc> => ({
  label: 'cmd.updateNote',
  apply: (doc) => {
    if (patch.text !== undefined && patch.text.trim() === '') return doc;
    if (patch.height !== undefined && !(patch.height > 0)) return doc;
    if (patch.offset !== undefined && !Number.isFinite(patch.offset)) return doc;
    let changed = false;
    const notes = doc.notes.map((n) => {
      if (!ids.includes(n.id)) return n;
      const next = {
        ...n,
        ...(patch.text !== undefined && !n.elevation ? { text: patch.text.trim() } : {}),
        ...(patch.height !== undefined ? { height: patch.height } : {}),
        // Only a level mark has an adjustment.
        ...(patch.offset !== undefined && n.elevation ? { elevation: { offset: patch.offset } } : {}),
      };
      if (next.text === n.text && next.height === n.height && next.elevation?.offset === n.elevation?.offset) return n;
      changed = true;
      return next;
    });
    return changed ? { ...doc, notes } : doc;
  },
});
