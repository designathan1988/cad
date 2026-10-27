// Commands on sections and elevations. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import { DEPTH_MAX, DEPTH_MIN, type SectionMark } from './schema';

export const addSections = (marks: readonly SectionMark[]): Command<Doc> => ({
  label: marks.length === 1 && marks[0]!.kind === 'section' ? 'cmd.addSection' : 'cmd.addElevations',
  apply: (doc) => (marks.length === 0 ? doc : { ...doc, sections: [...doc.sections, ...marks] }),
});

/** A mark's name; an empty one, or one another mark has, changes nothing. */
export const renameSection = (id: string, name: string): Command<Doc> => ({
  label: 'cmd.renameSection',
  apply: (doc) => {
    const n = name.trim();
    if (n === '' || doc.sections.some((m) => m.id !== id && m.name === n) || !doc.sections.some((m) => m.id === id && m.name !== n)) return doc;
    return { ...doc, sections: doc.sections.map((m) => (m.id === id ? { ...m, name: n } : m)) };
  },
});

/** How far the marks see (m). */
export const setSectionDepth = (ids: readonly string[], depth: number): Command<Doc> => ({
  label: 'cmd.updateSection',
  apply: (doc) => {
    if (!Number.isFinite(depth) || depth < DEPTH_MIN || depth > DEPTH_MAX || !doc.sections.some((m) => ids.includes(m.id) && m.depth !== depth)) return doc;
    return { ...doc, sections: doc.sections.map((m) => (ids.includes(m.id) ? { ...m, depth } : m)) };
  },
});

/** The marks looking the other way: start and end traded. */
export const flipSections = (ids: readonly string[]): Command<Doc> => ({
  label: 'cmd.flipSection',
  apply: (doc) => (!doc.sections.some((m) => ids.includes(m.id)) ? doc : { ...doc, sections: doc.sections.map((m) => (ids.includes(m.id) ? { ...m, start: m.end, end: m.start } : m)) }),
});
