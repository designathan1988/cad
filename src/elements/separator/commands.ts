// Commands on room separators. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../project/doc';
import type { Command } from '../../core/store';
import type { Separator } from './schema';

export const addSeparator = (s: Separator): Command<Doc> => ({
  label: 'cmd.addSeparator',
  apply: (doc) => ({ ...doc, separators: [...doc.separators, s] }),
});
