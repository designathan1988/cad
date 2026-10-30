// The fields guardrails show in the panel (ui/fields.ts builds the rows).

import { lengthText } from '../../i18n/units';
import type { Field } from '../fields';
import type { RailingPatch } from './commands';
import { type Railing, railingGap, type RailingInfill, railingLength } from './schema';
import { num, t } from '../../i18n/messages';

export interface RailingFieldActions {
  readonly updateRailings: (ids: readonly string[], patch: RailingPatch) => void;
}

export function railingFields(railings: readonly Railing[], act: RailingFieldActions): Field<Railing>[] {
  const ids = railings.map((r) => r.id);
  return [
    { id: 'height', label: 'railing.height', kind: 'number', min: 0.3, get: (r) => r.height, set: (v) => act.updateRailings(ids, { height: v }) },
    { id: 'baseOffset', label: 'railing.baseOffset', kind: 'number', get: (r) => r.baseOffset, set: (v) => act.updateRailings(ids, { baseOffset: v }) },
    {
      id: 'infill',
      label: 'railing.infill',
      kind: 'segmented',
      labelled: true,
      wide: true,
      options: (['rails', 'balusters', 'glass'] as const).map((v) => ({ value: v, label: t(`railing.infill.${v}`) })),
      get: (r) => r.infill ?? 'rails',
      set: (v) => act.updateRailings(ids, { infill: v as RailingInfill }),
    },
    { id: 'gap', label: 'railing.gap', kind: 'readout', text: (items) => (items.every((r) => railingGap(r) === railingGap(items[0]!)) ? `${num(railingGap(items[0]!) * 100, 1)} cm` : t('panel.varies')) },
    { id: 'length', label: 'railing.length', kind: 'readout', text: (items) => `${lengthText(items.reduce((s, r) => s + railingLength(r), 0))}` },
  ];
}
