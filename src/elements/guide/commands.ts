// Guide commands: each one undo step. Guides are deleted with the other elements (deleteElements).

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import type { Guide } from './schema';

export const addGuide = (guide: Guide): Command<Doc> => ({
  label: 'cmd.addGuide',
  apply: (doc) => ({ ...doc, guides: [...doc.guides, guide] }),
});

/** Every guide of a level. */
export const clearGuides = (levelId: string): Command<Doc> => ({
  label: 'cmd.clearGuides',
  apply: (doc) => (doc.guides.some((g) => g.levelId === levelId) ? { ...doc, guides: doc.guides.filter((g) => g.levelId !== levelId) } : doc),
});
