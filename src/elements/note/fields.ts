// The fields text notes show in the panel (ui/fields.ts builds the rows).

import type { Field } from '../fields';
import type { Note } from './schema';

export interface NoteFieldActions {
  readonly updateNotes: (ids: readonly string[], patch: { readonly text?: string; readonly height?: number; readonly offset?: number }) => void;
  readonly dropLeaders: (ids: readonly string[]) => void;
}

export function noteFields(notes: readonly Note[], act: NoteFieldActions): Field<Note>[] {
  const ids = notes.map((n) => n.id);
  const marks = notes.every((n) => n.elevation);
  const texts = notes.every((n) => !n.elevation);
  return [
    // A level mark's text is the height it says; its adjustment is what one sets.
    ...(texts ? [{ id: 'text', label: 'note.text', kind: 'text', get: (n: Note) => n.text, set: (v: string) => act.updateNotes(ids, { text: v }) } as const] : []),
    ...(marks
      ? [
          { id: 'elevation', label: 'note.says', kind: 'readout', text: (items: readonly Note[]) => (items.every((x) => x.text === items[0]!.text) ? items[0]!.text : '—') } as const,
          { id: 'offset', label: 'note.offset', kind: 'number', get: (n: Note) => n.elevation?.offset ?? 0, set: (v: number) => act.updateNotes(ids, { offset: v }) } as const,
        ]
      : []),
    { id: 'height', label: 'note.height', kind: 'number', min: 0.02, get: (n) => n.height, set: (v) => act.updateNotes(ids, { height: v }) },
    // A callout's arrow taken off, the text kept.
    { id: 'leader', label: 'note.dropLeader', kind: 'action', when: (items) => items.some((n) => n.leader), run: () => act.dropLeaders(ids) },
  ];
}
