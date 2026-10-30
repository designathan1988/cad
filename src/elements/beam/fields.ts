// The fields beams show in the panel (ui/fields.ts builds the rows).

import { lengthText } from '../../ui/units';
import { distance } from '../../model/vector';
import type { Field } from '../../ui/fields';
import type { BeamPatch } from './commands';
import { type Beam, BEAM_PLATE } from './schema';
import { t } from '../../ui/i18n';

export interface BeamFieldActions {
  readonly updateBeams: (ids: readonly string[], patch: BeamPatch) => void;
}

export function beamFields(beams: readonly Beam[], act: BeamFieldActions): Field<Beam>[] {
  const ids = beams.map((b) => b.id);
  return [
    {
      id: 'length',
      label: 'beam.length',
      kind: 'readout',
      text: (items) => {
        const l = items.map((b) => distance(b.start, b.end));
        return l.every((x) => Math.abs(x - l[0]!) < 1e-9) ? `${lengthText(l[0]!)}` : '—';
      },
    },
    { id: 'width', label: 'beam.width', kind: 'number', min: 0.05, get: (b) => b.width, set: (v) => act.updateBeams(ids, { width: v }) },
    { id: 'depth', label: 'beam.depth', icon: 'height', kind: 'number', min: 0.05, get: (b) => b.depth, set: (v) => act.updateBeams(ids, { depth: v }) },
    {
      id: 'shape',
      label: 'beam.shape',
      kind: 'segmented',
      labelled: true,
      options: [
        { value: 'rect', label: t('beam.shape.rect') },
        { value: 'I', label: t('beam.shape.I') },
      ],
      get: (b) => b.shape ?? 'rect',
      set: (v) => act.updateBeams(ids, { shape: v === 'I' ? 'I' : 'rect' }),
    },
    { id: 'plate', label: 'beam.plate', kind: 'number', sub: true, min: 0.002, decimals: 3, when: (bs) => bs.every((b) => b.shape === 'I'), get: (b) => b.plate ?? BEAM_PLATE, set: (v) => act.updateBeams(ids, { plate: v }) },
    { id: 'topOffset', label: 'beam.topOffset', kind: 'number', get: (b) => b.topOffset ?? 0, set: (v) => act.updateBeams(ids, { topOffset: v }) },
    // A sloping beam: its end's top, its start's when the same.
    { id: 'endOffset', label: 'beam.endOffset', kind: 'number', sub: true, get: (b) => b.endOffset ?? b.topOffset ?? 0, set: (v) => act.updateBeams(ids, { endOffset: v }) },
  ];
}
