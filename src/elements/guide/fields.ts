// The panel for selected guides, as fields (ui/fields.ts): what a guide is, and deleting the level's.

import type { Field } from '../../ui/fields';
import { t } from '../../ui/i18n';
import type { Guide } from './schema';

export function guideFields(clearGuides: () => void): Field<Guide>[] {
  return [
    { id: 'guideHint', label: 'guide.title', kind: 'note', text: () => t('guide.hint') },
    { id: 'clearGuides', label: 'ctx.clearGuides', kind: 'action', run: clearGuides },
  ];
}
