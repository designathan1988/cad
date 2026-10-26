// The fields text notes show in the panel (ui/fields.ts builds the rows).

import type { Field } from '../../ui/fields';
import type { Note } from './schema';

export interface NoteFieldActions {
  readonly updateNotes: (ids: readonly string[], patch: { readonly text?: string; readonly height?: number }) => void;
}

export function noteFields(notes: readonly Note[], act: NoteFieldActions): Field<Note>[] {
  const ids = notes.map((n) => n.id);
  return [
    { id: 'text', label: 'note.text', kind: 'text', get: (n) => n.text, set: (v) => act.updateNotes(ids, { text: v }) },
    { id: 'height', label: 'note.height', kind: 'number', min: 0.02, get: (n) => n.height, set: (v) => act.updateNotes(ids, { height: v }) },
  ];
}
