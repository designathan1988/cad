// The fields stairs show in the panel (ui/fields.ts builds the rows).

import type { Field } from '../../ui/fields';
import { num, t } from '../../ui/i18n';
import type { StairPatch } from './commands';
import type { StairSolid } from './geometry';
import { RAMP_GRADE, type StairKind } from './schema';

export interface StairFieldActions {
  readonly updateStairs: (ids: readonly string[], patch: StairPatch) => void;
}

export function stairFields(stairs: readonly StairSolid[], act: StairFieldActions): Field<StairSolid>[] {
  const ids = stairs.map((s) => s.stair.id);
  const same = (f: (s: StairSolid) => string) => (items: readonly StairSolid[]) => (items.every((x) => f(x) === f(items[0]!)) ? f(items[0]!) : '—');
  return [
    {
      id: 'kind',
      label: 'stair.kind',
      icon: 'stair',
      kind: 'select',
      get: (s) => s.stair.kind,
      set: (v) => act.updateStairs(ids, { kind: v as StairKind }),
      options: (['straight', 'l', 'u', 'spiral', 'ramp'] as const).map((k) => ({ value: k, label: t(`stair.kind.${k}`) })),
    },
    {
      id: 'grade',
      label: 'stair.grade',
      icon: 'raise',
      kind: 'number',
      unit: '%',
      min: 0.5,
      when: (items) => items.every((s) => s.stair.kind === 'ramp'),
      get: (s) => s.stair.grade ?? RAMP_GRADE,
      set: (v) => act.updateStairs(ids, { grade: v }),
    },
    { id: 'width', label: 'stair.width', kind: 'number', min: 0.4, get: (s) => s.stair.width, set: (v) => act.updateStairs(ids, { width: v }) },
    {
      id: 'tread',
      label: 'stair.tread',
      icon: 'width',
      kind: 'number',
      min: 0.15,
      when: (items) => items.every((s) => s.stair.kind !== 'ramp'),
      get: (s) => s.stair.tread,
      set: (v) => act.updateStairs(ids, { tread: v }),
    },
    { id: 'height', label: 'stair.height', kind: 'number', min: 0.2, get: (s) => s.height, set: (v) => act.updateStairs(ids, { height: v }) },
    // What it comes to: how many risers, how high each, and the 2h + p rule (63 cm is comfortable).
    { id: 'risers', label: 'stair.risers', kind: 'readout', when: (items) => items.every((s) => s.stair.kind !== 'ramp'), text: same((s) => `${s.risers} × ${num(s.riser * 100, 1)} cm`) },
    { id: 'blondel', label: 'stair.blondel', kind: 'readout', when: (items) => items.every((s) => s.stair.kind !== 'ramp'), text: same((s) => `${num((2 * s.riser + s.stair.tread) * 100, 1)} cm`) },
    // A ramp: how many runs, each rising how much, and its whole length with the landings.
    {
      id: 'runs',
      label: 'stair.runs',
      kind: 'readout',
      when: (items) => items.every((s) => s.stair.kind === 'ramp'),
      text: same((s) => t('stair.runsText', { n: s.risers, h: num(s.riser * 100, 1), l: num(Math.hypot(s.walk.at(-1)!.x - s.walk[0]!.x, s.walk.at(-1)!.y - s.walk[0]!.y)) })),
    },
    {
      id: 'turn',
      label: 'stair.turn',
      icon: 'rotate',
      kind: 'segmented',
      when: (items) => items.every((s) => s.stair.kind !== 'straight' && s.stair.kind !== 'ramp'),
      get: (s) => s.stair.turn,
      set: (v) => act.updateStairs(ids, { turn: v === 'left' ? 'left' : 'right' }),
      options: [
        { value: 'left', label: t('stair.turn.left') },
        { value: 'right', label: t('stair.turn.right') },
      ],
      labelled: true,
    },
    {
      id: 'railing',
      label: 'stair.railing',
      kind: 'segmented',
      get: (s) => (s.stair.railing === false ? 'no' : 'yes'),
      set: (v) => act.updateStairs(ids, { railing: v === 'yes' }),
      options: [
        { value: 'yes', label: t('stair.railing.yes') },
        { value: 'no', label: t('stair.railing.no') },
      ],
      labelled: true,
    },
  ];
}
