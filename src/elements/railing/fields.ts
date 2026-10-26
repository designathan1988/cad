// The fields guardrails show in the panel (ui/fields.ts builds the rows).

import type { Field } from '../../ui/fields';
import { num } from '../../ui/i18n';
import type { RailingPatch } from './commands';
import { type Railing, railingLength } from './schema';

export interface RailingFieldActions {
  readonly updateRailings: (ids: readonly string[], patch: RailingPatch) => void;
}

export function railingFields(railings: readonly Railing[], act: RailingFieldActions): Field<Railing>[] {
  const ids = railings.map((r) => r.id);
  return [
    { id: 'height', label: 'railing.height', kind: 'number', min: 0.3, get: (r) => r.height, set: (v) => act.updateRailings(ids, { height: v }) },
    { id: 'baseOffset', label: 'railing.baseOffset', kind: 'number', get: (r) => r.baseOffset, set: (v) => act.updateRailings(ids, { baseOffset: v }) },
    { id: 'length', label: 'railing.length', kind: 'readout', text: (items) => `${num(items.reduce((s, r) => s + railingLength(r), 0))} m` },
  ];
}
